import { Inject, Injectable, Logger } from "@nestjs/common";
import { AuraTx } from "src/entities/aura-tx.entity";
import { REPOSITORY_INTERFACE } from "src/module.config";
import { IAuraTransactionRepository } from "src/repositories/iaura-tx.repository";
import { IChainRepository } from "src/repositories/ichain.repository";
import { AuraTxRepository } from "src/repositories/impls/aura-tx.repository";
import { ISafeRepository } from "src/repositories/isafe.repository";
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
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY) private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY) private chainRepository: IChainRepository,
    ) {
        this._logger.log("============== Constructor Sync Websocket Service ==============");
        let listWebsocket: WebSocket[];
        let self = this;
        
        this.hello();



        // this._websocketUrl = this.configService.get('WEBSOCKET_URL');
        // this._websocket = new WebSocket(this._websocketUrl);

        // let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        // let self = this;

        // this._websocket.on('open', function () {
        //     self.connectWebsocket(this)
        // })

        // this._websocket.on('message', function (message) {
        //     self.handleMessage(message);
        // });
    }
    async hello() {
        console.log(12);
        let listChain = await this.chainRepository.findAll();
        let listSafe = await this.safeRepository.findAll();
        console.log(listChain);
        console.log(listSafe);
        for (let network of listChain) {
            let ws = this.syncFromNetwork(network);
            
        }
        // this.chainRepository.findAll().then((result) => {
        //     console.log("result");
        //     console.log(result);
        //     for (let network of result) {
        //         let ws = this.syncFromNetwork(network);
                
        //     }

        //     // listWebsocket.forEach(websocket => {
        //     //     websocket.on('message', function (message) {
        //     //         self.handleMessage(message);
        //     //     });
        //     // });
        // })
    }
    async syncFromNetwork(network): Promise<WebSocket> {
        console.log("syncFromNetwork");
        console.log(network);
        let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        let websocketUrl;
        // websocketUrl = 'ws://0.0.0.0:26657/websocket'
        if (network.id == 1) {
            websocketUrl = 'ws://0.0.0.0:26657/websocket'
        } else {
            websocketUrl = 'ws://18.138.28.51:26657/websocket'
        }
        let self = this;
        let websocket = new WebSocket(websocketUrl);
        websocket.on('open', function () {
            self.connectWebsocket(this)
        })
        websocket.on('message', function (message) {
            self.handleMessage(message);
        });
        return websocket;
    }
    async connectWebsocket(websocket) {
        console.log("connectWebsocket");
        let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" }, "source": "123" };
        websocket.send(JSON.stringify(queryAllTransaction));
    }
    async handleMessage(message) {
        let buffer = Buffer.from(message);
        let response = JSON.parse(buffer.toString())
        console.log(buffer.toString());
        if (Object.keys(response.result).length) {
            // let listAddress = []
            let sender = response.result.events['coin_spent.spender']
            let receiver = response.result.events['coin_received.receiver']
            let listAddress = [...sender, ...receiver]
            let checkExistsSafeAddress = await this.safeRepository.checkExistsSafeAddress(listAddress)

            console.log("Saving to database")
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
                // timeStamp: "",
                tx: "",
                txHash: response.result.events['tx.hash'][0],
                timeStamp: new Date(),
            };
            let result = await this.auraTxRepository.findAll();
            await this.auraTxRepository.create(auraTx);
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