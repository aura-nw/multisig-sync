import { Inject, Injectable, Logger } from "@nestjs/common";
// import { AuraTx } from "src/entities/aura-tx.entity";
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
    private listChain = []Chain;
    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY) private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY) private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY) private chainRepository: IChainRepository,
    ) {
        this._logger.log("============== Constructor Sync Websocket Service ==============");
        this.startSyncWebsocket();

    }
    async startSyncWebsocket() {
        this.listChain = await this.chainRepository.findAll();
        console.log(this.listChain);
        console.log(await this.listChain.find(x => x.websocket == 'ws://18.138.28.51:26657/websocket'))
        // let listSafe = await this.safeRepository.findAll();
        for (let network of this.listChain) {
            this.syncFromNetwork(network);
        }
    }
    async syncFromNetwork(network) {
        this._logger.log("syncFromNetwork");
        this._logger.debug(JSON.stringify(network));
        // let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        let websocketUrl = network.websocket;
        let self = this;
        let websocket = new WebSocket(websocketUrl);
        websocket.on('open', function () {
            self.connectWebsocket(this)
        })
        websocket.on('message', function (message) {
            self.handleMessage(network.websocket, message);
        });
        websocket.on('error', (error) => {
            self._logger.error(error)
        })
    }
    async connectWebsocket(websocket) {
        this._logger.log(`connectWebsocket ${websocket._url}`);
        let queryAllTransaction = { "jsonrpc": "2.0", "method": "subscribe", "id": "0", "params": { "query": "tm.event='Tx'" } };
        try {
            websocket.send(JSON.stringify(queryAllTransaction));
        } catch (error) {
            this._logger.error(error);
        }
    }
    async handleMessage(source, message) {
        let buffer = Buffer.from(message);
        let response = JSON.parse(buffer.toString())
        // this._logger.debug(response);
        if (Object.keys(response.result).length) {
            // let listAddress = []
            let sender = response.result.events['coin_spent.spender'] ?? []
            let receiver = response.result.events['coin_received.receiver'] ?? []
            let fee = response.result.events['tx.fee']
            let log = response.result.data.value.TxResult.result.log
            // [0].events
            let message = {
                recipient: '',
                sender: '',
                denom: '',
                amount: 0,
            }
            if (typeof (log) == 'string') {

            } else if (typeof (JSON.parse(log)) == 'object') {
                log = JSON.parse(log)[0].events
                let attributes = log.find(x => x.type == 'transfer').attributes
                message = {
                    recipient: attributes.find(x => x.key == 'recipient').value,
                    sender: attributes.find(x => x.key == 'sender').value,
                    denom: attributes.find(x => x.key == 'amount').value.match(/[a-zA-Z]+/g)[0],
                    amount: attributes.find(x => x.key == 'amount').value.match(/\d+/g)[0],
                }
            }

            this._logger.debug(message);

            let listAddress = [...sender, ...receiver]
            if (listAddress.length > 0) {
                let checkExistsSafeAddress = await this.safeRepository.checkExistsSafeAddress(listAddress)

            }

            let chainId = this.listChain.find(x => x.websocket == source).id;
            console.log("chainId", chainId)
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
                tx: "",
                txHash: response.result.events['tx.hash'][0],
                timeStamp: new Date(),
                chainId: chainId,
                fromAddress: message.sender,
                toAddress: message.recipient,
                amount: message.amount,
                denom: message.denom,
            };
            let result = await this.auraTxRepository.findAll();

            // await this.auraTxRepository.create(auraTx);
        }
    }

}