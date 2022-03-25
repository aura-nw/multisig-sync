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
import { ISafeRepository } from 'src/repositories/isafe.repository';
import { ConfigService } from 'src/shared/services/config.service';
import { ISyncRestService } from '../isync-rest.service';
@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private listChain;
    private listSafeAddress;
    private listChainIdSubscriber;
    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
    ) {
        this._logger.log(
            '============== Constructor Sync Websocket Service ==============',
        );
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        // this.initSyncRest();
        this.findTxByHash('72BCF08D08CF4288BF7E1DEA751C3F4E56AC49764F8037AF0F5FB60C78B2CAC0', 'https://tendermint-testnet.aura.network');
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
        console.log(lastHeight);
        console.log(height);

        lastHeight = 500000
        // height = 930386
        // Query each address in network to search for lost transactions
        // for (let address of listAddress) {
            // console.log(network)
            let address = 'aura1328x7tacz28w96zl4j50qnfg4gqjdd56wqd3ke'
            if(address == 'aura1328x7tacz28w96zl4j50qnfg4gqjdd56wqd3ke') {
                console.log(address);
            let lostTransations = [];
            // if (!address) continue;
            const query: SearchTxQuery = {
                sentFromOrTo: address,
                // height: 930386
            };
            console.log(query)
            const filter: SearchTxFilter = {
                minHeight: lastHeight,
                maxHeight: height,
            };
            console.log(filter)
            const res = await client.searchTx(query, filter);
            console.log(res);
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
        // }
    }
    // @Cron(CronExpression.EVERY_SECOND)
    async startSyncRest() {
        this._logger.log('call every second');
    }

    async findTxByHash(txHash, rpc) {
        const client = await StargateClient.connect(rpc);
        const tx = await client.getTx(txHash);
        console.log(tx);
        client.disconnect();
    }
}
