import { isSearchBySentFromOrToQuery, SearchTxFilter, SearchTxQuery, StargateClient } from "@cosmjs/stargate";
import { HttpService } from "@nestjs/axios";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { catchError, firstValueFrom, retry, tap, throwError } from "rxjs";
import { REPOSITORY_INTERFACE } from "src/module.config";
import { IAuraTransactionRepository } from "src/repositories/iaura-tx.repository";
import { IChainRepository } from "src/repositories/ichain.repository";
import { ISafeRepository } from "src/repositories/isafe.repository";
import { ConfigService } from "src/shared/services/config.service";
import { ISyncRestService } from "../isync-rest.service";
@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private listChain;
    private listSafeAddress;
    constructor(
        private configService: ConfigService,
        private httpService: HttpService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY) private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY) private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY) private chainRepository: IChainRepository,
    ) {
        this._logger.log("============== Constructor Sync Websocket Service ==============");
        this.initSyncRest();

    }

    async initSyncRest() {
        let listSafe = await this.safeRepository.findAll();
        this.listChain = await this.chainRepository.findAll();
        
        //add address for each chain
        listSafe.forEach(safe => {
            let chainId = safe.chainId;
            let chain = this.listChain.find(x => x.id == chainId);
            if(chain) {
                if(chain['safeAddresses']) 
                    chain['safeAddresses'].push(safe.safeAddress);
                else chain['safeAddresses'] = [safe.safeAddress];
            }
        })
        
        for (let network of this.listChain) {
            this.syncFromNetwork(network, network.safeAddresses);
        }
    }

    async getLatestBlockHeight(listAddress) {
        let lastHeight = 0;
        for(let address of listAddress) {
            if(!address) continue;
            const blockHeight = await this.auraTxRepository.getLatestBlockHeight(address);
            if(blockHeight > lastHeight) lastHeight = blockHeight;
        }
        return lastHeight;
    }

    async syncFromNetwork(network, listAddress) {
        const client = await StargateClient.connect(network.rpc);
        console.log(await client.getBlock());
        let height = (await client.getBlock()).header.height;
        const lastHeight = await this.getLatestBlockHeight(listAddress);
        let chainId = network.chainId;
        let lostTransations = [];
        for(let address of listAddress) {
            if(!address) continue;
            const query: SearchTxQuery = {
                sentFromOrTo: address
            };
            const filter: SearchTxFilter = {
                minHeight: lastHeight,
                maxHeight: height
            }
            const res = await client.searchTx(query, filter);
            for(let i = 0; i < res.length; i++) {
                let log: any = res[i].rawLog;
                let message = {
                    recipient: '',
                    sender: '',
                    denom: '',
                    amount: 0,
                }
                log = JSON.parse(log)[0].events
                let attributes = log.find(x => x.type == 'transfer').attributes
                message = {
                    recipient: attributes.find(x => x.key == 'recipient').value,
                    sender: attributes.find(x => x.key == 'sender').value,
                    denom: attributes.find(x => x.key == 'amount').value.match(/[a-zA-Z]+/g)[0],
                    amount: attributes.find(x => x.key == 'amount').value.match(/\d+/g)[0],
                }
                let auraTx = {
                    code: res[i].code ?? 0,
                    data: "",
                    gasUsed: res[i].gasUsed,
                    gasWanted: res[i].gasWanted,
                    height: res[i].height,
                    info: "",
                    logs: "",
                    rawLogs: res[i].rawLog,
                    tx: "", 
                    txHash: res[i].hash,
                    timeStamp: null,
                    chainId: chainId,
                    fromAddress: message.sender,
                    toAddress: message.recipient,
                    amount: message.amount,
                    denom: message.denom,
                }
                lostTransations.push(auraTx);
            }
            await this.auraTxRepository.insertLostTransaction(lostTransations);
        }
    }
    // @Cron(CronExpression.EVERY_SECOND)
    async startSyncRest() {
        this._logger.log("call every second")
    }

}