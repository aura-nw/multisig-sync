import { StargateClient } from '@cosmjs/stargate';
import * as axios from 'axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISyncRestService } from '../isync-rest.service';
import { ConfigService } from '../../shared/services/config.service';
import { REPOSITORY_INTERFACE } from '../../module.config';
import {
    IAuraTransactionRepository,
    IChainRepository,
    IMultisigTransactionRepository,
    ISafeRepository
} from '../../repositories';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../shared/services/redis.service';
const _ = require('lodash');

@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private chain;
    private listSafeAddress;
    private listChainIdSubscriber;
    private cacheKey;
    private horoscopeApi;
    private redisClient;

    constructor(
        private configService: ConfigService,
        private redisService: RedisService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
        @InjectQueue('sync-rest') private readonly syncQueue: Queue
    ) {
        this._logger.log(
            '============== Constructor Sync Rest Service ==============',
        );
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.horoscopeApi = this.configService.get('HOROSCOPE_API');
        this.cacheKey = this.configService.get('LAST_BLOCK_HEIGHT');
        this.syncRest();
    }

    @Cron(CronExpression.EVERY_30_SECONDS)
    async syncRest() {
        [this.chain, this.redisClient] = await Promise.all([
            this.chainRepository.findChainByChainId(this.listChainIdSubscriber[0]),
            this.redisService.getRedisClient(this.redisClient)
        ]);
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
            // Get the current latest block height on network
            let height = (await axios.default.get(
                this.horoscopeApi + `block?chainid=${network.chainId}&pageLimit=1`
            )).data.data.blocks[0].block.header.height;
            // Get the last block height from cache (if exists) minus 2 blocks
            let cacheLastHeight = await this.redisClient.get(this.cacheKey);
            let lastHeightFromDB = await this.getLatestBlockHeight(network.id);
            if (lastHeightFromDB === 0) lastHeightFromDB = height - 15;
            let lastHeight = (cacheLastHeight ? cacheLastHeight : lastHeightFromDB) - 5;
            this._logger.log(`Last height from cache: ${cacheLastHeight}, query from ${lastHeight} to current height: ${height}`);
            // set cache last height to the latest block height
            await this.redisClient.set(this.cacheKey, height);

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
        let listQueries: any[] = [];
        const listPendingTx = await this.multisigTransactionRepository.findPendingMultisigTransaction(this.chain.id);
        if (listPendingTx.length > 0) {
            listPendingTx.map(tx =>
                listQueries.push(axios.default.get(
                    this.horoscopeApi + `transaction?chainid=${network.chainId}&txHash=${tx.txHash}&pageLimit=100`
                ))
            );

            let result: any = await Promise.all(listQueries);
            await this.updateMultisigTxStatus(result.map(res => {
                return {
                    code: parseInt(res.data.data.transactions[0].tx_response.code, 10),
                    txHash: res.data.data.transactions[0].tx_response.txhash
                }
            }));
        }
    }
}
