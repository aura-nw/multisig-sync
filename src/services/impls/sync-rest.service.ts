import {
    isSearchBySentFromOrToQuery,
    SearchTxFilter,
    SearchTxQuery,
    StargateClient,
} from '@cosmjs/stargate';
import { HttpService } from '@nestjs/axios';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { catchError, firstValueFrom, retry, tap, throwError } from 'rxjs';
import { REPOSITORY_INTERFACE } from 'src/module.config';
import { IAuraTransactionRepository } from 'src/repositories/iaura-tx.repository';
import { IChainRepository } from 'src/repositories/ichain.repository';
import { IMultisigTransactionRepository } from 'src/repositories/imultisig-transaction.repository';
import { ISafeRepository } from 'src/repositories/isafe.repository';
import { ConfigService } from 'src/shared/services/config.service';
import { ISyncRestService } from '../isync-rest.service';
@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private listChain;
    private listSafeAddress;
    private listChainIdSubscriber;
    private config: ConfigService = new ConfigService();
    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
    ) {
        this._logger.log(
            '============== Constructor Sync Rest Service ==============',
        );
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.initSyncRest();
    }

    async initSyncRest() {
        let listSafe = await this.safeRepository.findAll();
        this.listChain = await this.chainRepository.findChainByChainId(
            this.listChainIdSubscriber,
        );
        //add address for each chain
        listSafe.forEach((safe) => {
            let chainId = safe.chainId;
            let chain = this.listChain.find((x) => x.id == chainId);
            if (chain && safe.safeAddress) {
                if (chain['safeAddresses'])
                    chain['safeAddresses'].push(safe.safeAddress);
                else chain['safeAddresses'] = [safe.safeAddress];
            }
        });

        for (let network of this.listChain) {
            this.syncFromNetwork(network, network.safeAddresses);
            this.findTxByHash(network);
        }
    }

    async getLatestBlockHeight(chainId) {
        const lastHeight = await this.auraTxRepository.getLatestBlockHeight(chainId);
        return lastHeight;
    }

    async syncFromNetwork(network, listAddress) {
        // console.log('hello123: ', network);
        const client = await StargateClient.connect(network.rpc);
        // Get the current block height received from websocket
        let height = (await client.getBlock()).header.height;
        let chainId = network.id;
        // Get the last block height from DB
        let lastHeight = await this.getLatestBlockHeight(chainId);
        // Query each address in network to search for lost transactions
        for (let address of listAddress) {
            // console.log(address);
            let lostTransations = [];
            if (!address) continue;
            const query: SearchTxQuery = {
                sentFromOrTo: address,
            };
            const filter: SearchTxFilter = {
                minHeight: lastHeight,
                maxHeight: height,
            };
            const res = await client.searchTx(query, filter);
            // console.log(res);
            for (let i = 0; i < res.length; i++) {
                let log: any = res[i].rawLog;
                let message = {
                    recipient: '',
                    sender: '',
                    denom: '',
                    amount: 0,
                };
                console.log(log);
                log = JSON.parse(log)[0].events;

                let attributes = log.find(
                    (x) => x.type == 'transfer',
                ).attributes;
                message = {
                    recipient: attributes.find((x) => x.key == 'recipient')
                        .value,
                    sender: attributes.find((x) => x.key == 'sender').value,
                    denom: attributes
                        .find((x) => x.key == 'amount')
                        .value.match(/[a-zA-Z]+/g)[0],
                    amount: attributes
                        .find((x) => x.key == 'amount')
                        .value.match(/\d+/g)[0],
                };
                let auraTx = {
                    code: res[i].code ?? 0,
                    data: '',
                    gasUsed: res[i].gasUsed,
                    gasWanted: res[i].gasWanted,
                    height: res[i].height,
                    info: '',
                    logs: '',
                    rawLogs: res[i].rawLog,
                    tx: '',
                    txHash: res[i].hash,
                    timeStamp: null,
                    chainId: chainId,
                    fromAddress: message.sender,
                    toAddress: message.recipient,
                    amount: message.amount,
                    denom: message.denom,
                };
                lostTransations.push(auraTx);
                this._logger.log(auraTx.txHash, 'TxHash being synced');
            }
            // Bulk insert transactions into DB
            if (lostTransations.length > 0)
                await this.auraTxRepository.insertBulkTransaction(
                    lostTransations,
                );
        }
    }
    // @Cron(CronExpression.EVERY_SECOND)
    async startSyncRest() {
        this._logger.log('call every second');
    }

    // @Cron(CronExpression.EVERY_5_SECONDS)
    async findTxByHash(network) {
        if(!network) 
            network = JSON.parse(this.config.get("CHAIN_SUBCRIBE"));
        const chain = await this.chainRepository.findChainByChainId([network.chainId ? network.chainId : network[0]]);
        let pendingTransations = [];
        const client = await StargateClient.connect(chain[0].rpc);
        const listPendingTx = await this.multisigTransactionRepository.findPendingMultisigTransaction(chain[0].id);
        if(listPendingTx.length > 0) {
            for(let i = 0; i < listPendingTx.length; i++) {
                console.log(listPendingTx[i].txHash)
                const tx = await client.getTx(listPendingTx[i].txHash);
                console.log(tx);

                let message = {
                    recipient: '',
                    sender: '',
                    denom: '',
                    amount: 0,
                };
                try {
                    const log = JSON.parse(tx.rawLog)[0].events;

                    let attributes = log.find(
                        (x) => x.type == 'transfer',
                    ).attributes;
                    // let param = this.findAttribute(log, 'transfer', 'recipient');
                    // console.log('param: ', param);

                    message = {
                        recipient: attributes.find((x) => x.key == 'recipient')
                            .value,
                        sender: attributes.find((x) => x.key == 'sender').value,
                        denom: attributes
                            .find((x) => x.key == 'amount')
                            .value.match(/[a-zA-Z]+/g)[0],
                        amount: attributes
                            .find((x) => x.key == 'amount')
                            .value.match(/\d+/g)[0],
                    };
                } catch (error) {
                    this._logger.error('this is error transaction');
                    this._logger.error(error);
                    // message.sender = response.result.events['transfer.sender'][0];
                    // message.recipient =
                    //     response.result.events['transfer.recipient'][0];
                    // message.denom =
                    //     response.result.events['transfer.amount'][0].match(
                    //         /[a-zA-Z]+/g,
                    //     )[0];
                    // message.amount =
                    //     response.result.events['transfer.amount'][0].match(
                    //         /\d+/g,
                    //     )[0];
                }

                if(tx) {
                    let auraTx = {
                        code: tx.code ?? 0,
                        data: '',
                        gasUsed: tx.gasUsed ?? 0,
                        gasWanted: tx.gasWanted ?? 0,
                        height: tx.height,
                        info: '',
                        logs: '',
                        rawLogs: tx.rawLog,
                        tx: '',
                        txHash: tx.hash,
                        timeStamp: null,
                        chainId: network.chainId,
                        fromAddress: message.sender,
                        toAddress: message.recipient,
                        amount: message.amount,
                        denom: message.denom,
                    };
                    pendingTransations.push(auraTx);
                    this._logger.log(auraTx.txHash, 'Pending Tx being updated');
                }
            }
        }
        // Bulk insert transactions into DB
        if (pendingTransations.length > 0)
        await this.auraTxRepository.insertBulkTransaction(
            pendingTransations,
        );
        client.disconnect();
    }
}
