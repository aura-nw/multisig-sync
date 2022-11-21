import { OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger, Inject } from "@nestjs/common";
import * as axios from 'axios';
import { Job } from "bull";
import { CommonService } from "../shared/services/common.service";
import { CONST_CHAR } from "../common";
import { REPOSITORY_INTERFACE } from "../module.config";
import {
    IMultisigTransactionRepository
} from "../repositories";
import { ConfigService } from "../shared/services/config.service";

@Processor('sync-rest')
export class SyncRestProcessor {
    private readonly logger = new Logger(SyncRestProcessor.name);
    private horoscopeApi;

    constructor(
        private configService: ConfigService,
        private commonService: CommonService,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository
    ) {
        this.logger.log(
            '============== Constructor Sync Rest Processor Service ==============',
        );

        this.horoscopeApi = this.configService.get('HOROSCOPE_API');
    }

    @Process({
        name: 'sync-tx-by-height',
        concurrency: 10
    })
    async handleQueryTxByHeight(job: Job) {
        // this.logger.log(`Handle Job: ${JSON.stringify(job.data)}`);
        let syncTxs: any[] = [], syncTxMessages: any[] = [], listQueries: any[] = [];
        let result = [];
        let height = job.data.height;
        let safes = job.data.safeAddresses;
        let network = job.data.network;
        const param = `transaction?chainid=${network.chainId}&blockHeight=${height}&pageLimit=100`;
        let urlToCall = param;
        let done = false;
        let resultCallApi;
        while (!done) {
            resultCallApi = await axios.default.get(this.horoscopeApi + urlToCall);
            if (resultCallApi.data.data.transactions.length > 0)
                resultCallApi.data.data.transactions.map(res => {
                    result.push({
                        code: parseInt(res.tx_response.code, 10),
                        txHash: res.tx_response.txhash
                    });
                });
            if (resultCallApi.data.data.nextKey === null) {
                done = true;
            } else {
                urlToCall = `${param}&nextKey=${encodeURIComponent(
                    resultCallApi.data.data.nextKey,
                )}`;
            }
        }
        this.logger.log(`Txs of block ${height}: ${JSON.stringify(result)}`);

        try {
            if (result.length > 0) {
                result.map(res => {
                    listQueries.push(axios.default.get(
                        this.horoscopeApi + `transaction?chainid=${network.chainId}&txHash=${res.txHash}&pageLimit=100`
                    ))
                });
                result = await Promise.all(listQueries);

                await this.commonService.handleTransactions(result.map(res => res.data.data.transactions[0]), safes, network);
            }
        } catch (error) {
            this.logger.error(error);
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
    }

    @OnQueueCompleted()
    onComplete(job: Job, result: any) {
        this.logger.log(`Completed job ${job.id} of type ${job.name}`);
        this.logger.log(`Result: ${result}`);
    }

    @OnQueueError()
    onError(job: Job, error: Error) {
        this.logger.error(`Job: ${job}`);
        this.logger.error(`Error job ${job.id} of type ${job.name}`);
        this.logger.error(`Error: ${error}`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Failed job ${job.id} of type ${job.name}`);
        this.logger.error(`Error: ${error}`);
    }

    async checkTxFail(listData, network) {
        let queries = [];
        listData.map((data) => queries.push(this.multisigTransactionRepository.updateMultisigTransactionsByHashes(
            data, network.id
        )));
        await Promise.all(queries);
    }

    getCoinReceiveAttribute(log: any) {
        const coin_received_event = log.events.find(e => e.type === CONST_CHAR.COIN_RECEIVED);
        if (coin_received_event) return coin_received_event.attributes;
        return null;
    } 
}