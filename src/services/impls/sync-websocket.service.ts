import { Inject, Injectable, Logger } from "@nestjs/common";
import { AuraTx } from "src/entities/aura-tx.entity";
import { REPOSITORY_INTERFACE } from "src/module.config";
import { IAuraTransactionRepository } from "src/repositories/iaura-tx.repository";
import { AuraTransactionRepository } from "src/repositories/impls/aura-tx.repository";
import { ConfigService } from "src/shared/services/config.service";
import * as WebSocket from "ws";
// import { ResponseDto } from "src/dtos/responses/response.dto";
// import { ErrorMap } from "../../common/error.map";
// import { MODULE_REQUEST, REPOSITORY_INTERFACE } from "../../module.config";
// import { ConfigService } from "src/shared/services/config.service";
// import { IMultisigWalletService } from "../imultisig-wallet.service";
// import { createMultisigThresholdPubkey, pubkeyToAddress, SinglePubkey } from "@cosmjs/amino";
import { ISyncWebsocketService } from "../isync-websocket.service";
@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private _websocketUrl: string;
    private _websocket: WebSocket;
    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY) private auraTxRepository: IAuraTransactionRepository,
    ) {
        this._logger.log("============== Constructor Sync Websocket Service ==============");
        this._websocketUrl = this.configService.get('WEBSOCKET_URL');
        this._websocket = new WebSocket(this._websocketUrl);

        let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        let self = this;

        this._websocket.on('open', function () {
            self.connectWebsocket(this)
        })

        this._websocket.on('message', function (message) {
            // console.log(message);
            self.handleMessage(message);
        });
    }

    async connectWebsocket(websocket) {
        console.log("connectWebsocket");
        let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        websocket.send(JSON.stringify(queryAllTransaction));
    }
    async handleMessage(message) {
        let buffer = Buffer.from(message);
        let response = JSON.parse(buffer.toString())
        console.log(response);
        console.log(JSON.stringify(response));
        if (Object.keys(response.result).length) {
            console.log("Saving to database")
            let data = response.result.data;
            var encoded = Buffer.from(JSON.stringify(data), 'base64');
            console.log("encoded:", encoded);
            let auraTx = {
                code: response.result.data.value.TxResult.result.code ?? 0,
                codeSpace: response.result.data.value.TxResult.result.codespace ?? "",
                data: "",
                gasUsed: response.result.data.value.TxResult.result.gas_used,
                gasWanted: response.result.data.value.TxResult.result.gas_wanted,
                height: response.result.events['tx.height'][0],
                info: "",
                logs: "",
                rawLogs: response.result.data.value.TxResult.result.log,
                timeStamp: "",
                tx: "",
                txHash: response.result.events['tx.hash'][0],
            };
            console.log(auraTx);
            let result = await this.auraTxRepository.findAll();
            console.log(result);
        }
    }

    createNewRecordTransactionFromWebsocket(message: any): void {
        console.log("createNewRecordTransactionFromWebsocket");
        console.log(message);
        let auraTx = {
            code: 0,
            codeSpace: 0,
            data: 0,
            gasUsed: 0,
            gasWanted: 0,
            height: 0,
            info: 0,
            logs: 0,
            rawLogs: 0,
            timeStamp: Date,
            tx: 0,
            txHash: 0,
        };
    }

}