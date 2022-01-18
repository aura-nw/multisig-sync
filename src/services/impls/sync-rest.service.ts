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
        this.listSafeAddress = listSafe.map(x => x.safeAddress);
        this.listChain = await this.chainRepository.findAll();
        // for (let index = 0; index < listChain.length; index++) {
        //     const res = await firstValueFrom(this.httpService.get(`${listChain[index].rest}/blocks/latest`))
        //     listChain[index].height = res.data.block.header.height;
        // }
        // this.listChain = listChain;
        // console.log(listChain);
        for (let network of this.listChain) {
            this.syncFromNetwork(network);
        }
    }

    async getLatestBlockHeight() {
        let lastHeight = 0;
        for(let address of this.listSafeAddress) {
            if(!address) continue;
            const blockHeight = await this.auraTxRepository.getLatestBlockHeight(address);
            if(blockHeight > lastHeight) lastHeight = blockHeight;
        }
        return lastHeight;
    }

    async syncFromNetwork(network) {
        const client = await StargateClient.connect(network.rpc);
        console.log(await client.getBlock());
        let height = (await client.getBlock()).header.height;
        const lastHeight = await this.getLatestBlockHeight();
        let chainId = network.chainId;
        let lostTransations = [];
        for(let address of this.listSafeAddress) {
            if(!address) continue;
            const query: SearchTxQuery = {
                sentFromOrTo: 'aura15f6wn3nymdnhnh5ddlqletuptjag09tryrtpq5'
            };
            const filter: SearchTxFilter = {
                minHeight: 79000,
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