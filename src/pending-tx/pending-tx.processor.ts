import { Process, Processor, OnQueueActive } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import fetch from 'node-fetch';

interface SyncTxJobData {
    txHash: string;
    chainId: string;
}

@Processor('pyxis-sync-tx')
export class SyncTxProcessor {
    private readonly logger = new Logger(SyncTxProcessor.name);

    constructor(
        @InjectQueue('pyxis-sync-tx') private pyxisSyncTxQueue: Queue,
    ) {}

    // @OnQueueActive({ name: 'pending-tx' })
    // onActive(job: Job<SyncTxJobData>) {
    //     console.log(
    //         `Processing sync tx job ${job.id} of type ${job.name} with txHash ${job.data.txHash}...`,
    //     );
    // }

    @Process({ name: 'pending-tx', concurrency: 2 })
    async handleTranscode(job: Job<SyncTxJobData>) {
        const indexerUrl = 'https://indexer.dev.aurascan.io';
        const { txHash, chainId } = job.data;
        this.logger.debug(`Start crawl tx: ${chainId} ${txHash}...`);
        // try {
        const response = await this.requestAPI(
            new URL(
                `/api/v1/transaction?chainid=${chainId}&txHash=${txHash}`,
                indexerUrl,
            ).href,
        );
        const tx = response.data.transactions[0];
        if (tx) {
            if (tx.tx_response.code === '0') {
                this.logger.debug(`successful tx: ${txHash}`);
            } else {
                this.logger.debug(`failed tx: ${txHash}`);
            }
        } else {
            throw new Error(`tx ${txHash} not found, try again`);
        }
    }

    async requestAPI(url: string, method = 'GET', body?: any) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
            },
        };
        if (body) {
            options['body'] = JSON.stringify(body);
        }
        const result = await fetch(url, options);
        return result.json();
    }
}
