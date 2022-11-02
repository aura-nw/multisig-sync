import { StargateClient } from '@cosmjs/stargate';
import * as axios from 'axios';
import { CacheContainer } from 'node-ts-cache'
import { MemoryStorage } from 'node-ts-cache-storage-memory'
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISyncRestService } from '../isync-rest.service';
import { CONST_CHAR, MESSAGE_ACTION, TRANSACTION_STATUS } from '../../common';
import { ConfigService } from '../../shared/services/config.service';
import { REPOSITORY_INTERFACE } from '../../module.config';
import {
    IAuraTransactionRepository,
    IChainRepository,
    IMultisigTransactionRepository,
    ISafeRepository,
    IMessageRepository
} from '../../repositories';
import { AuraTx, Message } from '../../entities';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import e from 'express';
const _ = require('lodash');

@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private chain;
    private listSafeAddress;
    private listChainIdSubscriber;
    private listMessageAction = [
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_DELEGATE,
        MESSAGE_ACTION.MSG_REDELEGATE,
        MESSAGE_ACTION.MSG_UNDELEGATE,
        MESSAGE_ACTION.MSG_WITHDRAW_REWARDS,
    ];
    private cacheHeight = new CacheContainer(new MemoryStorage());;
    private cacheKey;

    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY)
        private messageRepository: IMessageRepository,
        @InjectQueue('sync-rest') private readonly syncQueue: Queue
    ) {
        this._logger.log(
            '============== Constructor Sync Rest Service ==============',
        );
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.cacheKey = this.configService.get('LAST_BLOCK_HEIGHT');
        this.syncRest();
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async syncRest() {
        this.chain = await this.chainRepository.findChainByChainId(this.listChainIdSubscriber[0]);
        this.listSafeAddress = await this.safeRepository.findSafeByInternalChainId(this.chain.id);
        //add address for each chain
        this.listSafeAddress.map((safe) => {
            if (this.chain && safe.safeAddress) {
                if (this.chain['safeAddresses'])
                    this.chain['safeAddresses'].push(safe);
                else this.chain['safeAddresses'] = [safe];
            }
        });
        if (this.chain.rest.slice(-1) !== '/') this.chain.rest = this.chain.rest + '/';

        await this.findTxByHash(this.chain);
        if (this.chain.safeAddresses !== undefined) {
            this.syncFromNetwork(this.chain, this.chain.safeAddresses);
        }
    }

    async getLatestBlockHeight(chainId) {
        const lastHeight = await this.auraTxRepository.getLatestBlockHeight(chainId);
        return lastHeight;
    }

    async syncFromNetwork(network, listSafes) {
        try {
            const safes = _.keyBy(listSafes, 'safeAddress');
            const client = await StargateClient.connect(network.rpc);
            // Get the current block height received from websocket
            let height = (await client.getBlock()).header.height;
            // Get the last block height from cache (if exists) minus 2 blocks
            const cacheLastHeight: Number = await this.cacheHeight.getItem<Number>(this.cacheKey);
            let lastHeight = (cacheLastHeight ? cacheLastHeight : (await this.getLatestBlockHeight(network.id))) - 2;
            this._logger.log(`Last height from cache: ${cacheLastHeight} with key ${this.cacheKey}`);
            // set cache last height to the latest block height
            await this.cacheHeight.setItem(this.cacheKey, height, { isCachedForever: true });

            // Query lost transactions
            for (let i = lastHeight; i <= height; i++) {
                this.syncQueue.add('sync-tx-by-height', {
                    height: i,
                    safes,
                    network,
                });
            }
        } catch (error) {
            this._logger.error(error);
        }
    }

    async updateMultisigTxStatus(listData) {
        let queries = [];
        listData.map((data) => queries.push(this.multisigTransactionRepository.updateMultisigTransactionsByHashes(
            data, this.chain.id
        )));
        await Promise.all(queries);
    }

    async findTxByHash(network) {
        let pendingTransations = [], listQueries: any[] = [], pendingTxMessages: any[] = [];
        const listPendingTx = await this.multisigTransactionRepository.findPendingMultisigTransaction(this.chain.id);
        if (listPendingTx.length > 0) {
            listPendingTx.map(tx =>
                listQueries.push(axios.default.get(
                    network.rest + this.configService.get('PARAM_TX_BY_HASH') + tx.txHash
                ))
            );

            let result: any = await Promise.all(listQueries);
            this._logger.log(`Result find pending tx: ${result}`);
            await this.updateMultisigTxStatus(result.map(res => {
                return {
                    code: res.data.tx_response.code,
                    txHash: res.data.tx_response.txhash
                }
            }));
        }
    }
}
