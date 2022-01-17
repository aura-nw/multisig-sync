import { StargateClient } from "@cosmjs/stargate";
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
        this.listSafeAddress = listSafe.map(x => x.address);
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

    async syncFromNetwork(network) {
        const client = await StargateClient.connect(network.rpc);
        console.log(await client.getBlock());
        let height = (await client.getBlock()).header.height;
        // client.searchTx()
    }
    // @Cron(CronExpression.EVERY_SECOND)
    async startSyncRest() {
        this._logger.log("call every second")
    }

}