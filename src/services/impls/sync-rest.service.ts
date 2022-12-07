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
    ISafeRepository,
} from '../../repositories';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { RedisService } from '../../shared/services/redis.service';
import { SafeInfo } from '../../dtos/responses/get-safe-by-chain.response';
const _ = require('lodash');

@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private chain;
    // private listSafeAddress;
    private listSafe: SafeInfo[];
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
        @InjectQueue('sync-rest') private readonly syncQueue: Queue,
    ) {
        this._logger.log(
            '============== Constructor Sync Rest Service ==============',
        );

        this.listSafe = [];
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.horoscopeApi = this.configService.get('HOROSCOPE_API');
        this.cacheKey = this.configService.get('LAST_BLOCK_HEIGHT');
        this.syncRest();
    }

    @Cron(CronExpression.EVERY_5_MINUTES)
    async findTxByHash() {
        try {
            const listPendingTx =
                await this.multisigTransactionRepository.findPendingMultisigTransaction(
                    this.chain.id,
                );
            const result = await Promise.all(
                listPendingTx.map((tx) =>
                    axios.default.get(
                        this.horoscopeApi +
                        `transaction?chainid=${this.chain.chainId}&txHash=${tx.txHash}&pageLimit=100`,
                    ),
                ),
            );
            const txs = result
                .filter((res) => res.data.data.transactions.length > 0)
                .map((tx) => {
                    return {
                        code: parseInt(
                            tx.data.data.transactions[0].tx_response.code,
                            10,
                        ),
                        txHash: tx.data.data.transactions[0].tx_response.txhash,
                    };
                });
            if (txs.length > 0) {
                await this.updateMultisigTxStatus(txs);
            }
        } catch (error) {
            this._logger.error('findTxByHash: ', error);
        }
    }

    @Cron(CronExpression.EVERY_5_SECONDS)
    async syncRest() {
        [this.chain, this.redisClient] = await Promise.all([
            this.chainRepository.findChainByChainId(
                this.listChainIdSubscriber[0],
            ),
            this.redisService.getRedisClient(this.redisClient),
        ]);
        const newSafes = await this.safeRepository.findSafeByInternalChainId(
            this.chain.id,
            this.listSafe.length > 0 ? this.listSafe[0].id : 0,
        );
        this.listSafe.push(...newSafes);

        if (this.chain.rest.slice(-1) !== '/')
            this.chain.rest = this.chain.rest + '/';

        if (this.listSafe.length > 0) {
            this.syncFromNetwork(this.chain, this.listSafe);
        }
    }

    async syncFromNetwork(network, listSafes: SafeInfo[]) {
        try {
            const safeAddresses = _.keyBy(listSafes, 'safeAddress');
            // Get the current latest block height on network
            let height = (
                await axios.default.get(
                    this.horoscopeApi +
                    `block?chainid=${network.chainId}&pageLimit=1`,
                )
            ).data.data.blocks[0].block.header.height;

            // Get the last block height from cache (if exists) minus 2 blocks
            let cacheLastHeight = await this.redisClient.get(this.cacheKey);
            // if height from cache is too far behind current height, then set cacheLastHeight = height in network - 19 blocks
            if (cacheLastHeight)
                if (height - cacheLastHeight > 1000) cacheLastHeight = height - 19;

            // get the last block height from db
            let lastHeightFromDB = await this.getLatestBlockHeight(network.id);
            // if height from db is zero or is too far behind current height, then set lastHeightFromDB = height in network - 19 blocks
            if (lastHeightFromDB === 0 || height - lastHeightFromDB > 50000) lastHeightFromDB = height - 19;

            let lastHeight = Number(cacheLastHeight
                ? cacheLastHeight
                : lastHeightFromDB);
            this._logger.log(
                `Last height from cache: ${cacheLastHeight}, query from ${lastHeight} to current height: ${height}`,
            );

            // set cache last height to the latest block height
            await this.redisClient.set(this.cacheKey, height);
            for (let i = lastHeight; i <= height; i++) {
                this.syncQueue.add('sync-tx-by-height', {
                    height: i,
                    safeAddresses,
                    network,
                });
            }

        } catch (error) {
            this._logger.error('syncFromNetwork: ', error);
        }
    }

    async getLatestBlockHeight(chainId) {
        const lastHeight = await this.auraTxRepository.getLatestBlockHeight(
            chainId,
        );
        return lastHeight;
    }

    async updateMultisigTxStatus(listData) {
        let queries = [];
        listData.map((data) =>
            queries.push(
                this.multisigTransactionRepository.updateMultisigTransactionsByHashes(
                    data,
                    this.chain.id,
                ),
            ),
        );
        await Promise.all(queries);
    }
}
