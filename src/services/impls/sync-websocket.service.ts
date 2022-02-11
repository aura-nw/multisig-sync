import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ErrorMap } from 'src/common/error.map';
import { ResponseDto } from 'src/dtos/responses/response.dto';
import { MODULE_REQUEST, REPOSITORY_INTERFACE } from 'src/module.config';
import { IAuraTransactionRepository } from 'src/repositories/iaura-tx.repository';
import { IChainRepository } from 'src/repositories/ichain.repository';
import { ISafeRepository } from 'src/repositories/isafe.repository';
import * as WebSocket from 'ws';
// import { ResponseDto } from "src/dtos/responses/response.dto";
// import { ErrorMap } from "../../common/error.map";
// import { MODULE_REQUEST, REPOSITORY_INTERFACE } from "../../module.config";
// import { ConfigService } from "src/shared/services/config.service";
// import { IMultisigWalletService } from "../imultisig-wallet.service";
// import { createMultisigThresholdPubkey, pubkeyToAddress, SinglePubkey } from "@cosmjs/amino";
import { ISyncWebsocketService } from '../isync-websocket.service';
@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private listChain = [];
    Chain;
    private listAddress = [];
    constructor(
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
        this.startSyncWebsocket();
    }

    async addNewAddressOnNetwork(
        request: MODULE_REQUEST.SubcribeNewAddressRequest,
    ): Promise<ResponseDto> {
        let chain = await this.chainRepository.findOne(request.chainId);
        const res = new ResponseDto();
        try {
            let self = this;
            let websocketUrl = chain.websocket;
            console.log(websocketUrl);
            let websocket = new WebSocket(websocketUrl);
            websocket.on('open', function () {
                let queryTransactionFromAddress = {
                    jsonrpc: '2.0',
                    method: 'subscribe',
                    id: '0',
                    params: {
                        query: `tm.event='Tx' AND transfer.sender = '${request.address}'`,
                    },
                };
                let queryTransactionToAddress = {
                    jsonrpc: '2.0',
                    method: 'subscribe',
                    id: '0',
                    params: {
                        query: `tm.event='Tx' AND transfer.recipient = '${request.address}'`,
                    },
                };

                this.send(JSON.stringify(queryTransactionFromAddress));
                this.send(JSON.stringify(queryTransactionToAddress));
            });
            websocket.on('message', function (message) {
                self.handleMessage(websocketUrl, message);
            });
            websocket.on('error', (error) => {
                self._logger.error(error);
            });
        } catch (error) {
            this._logger.error(
                `${ErrorMap.E500.Code}: ${ErrorMap.E500.Message}`,
            );
            this._logger.error(`${error.name}: ${error.message}`);
            this._logger.error(`${error.stack}`);
            return res.return(ErrorMap.E500);
        }
    }

    @Cron(CronExpression.EVERY_5_SECONDS)
    async addNewSafeNeedToSync() {
        this._logger.debug('addNewSafeNeedToSync');
        let listNewSafe = await this.safeRepository.findSafeNotInListAddress(
            this.listAddress,
        );
        this._logger.debug(JSON.stringify(listNewSafe));

        listNewSafe.forEach((safe) => {
            let chainId = safe.chainId;
            let chain = this.listChain.find((x) => x.id == chainId);
            if (chain && safe.safeAddress) {
                this.listAddress.push(safe.safeAddress);
                this.syncFromNetwork({
                    websocket: chain.websocket,
                    safeAddresses: [safe.safeAddress],
                });
            }
        });
    }

    async startSyncWebsocket() {
        this.listChain = await this.chainRepository.findAll();
        let listSafe = await this.safeRepository.findAll();

        // add address for each chain
        listSafe.forEach((safe) => {
            let chainId = safe.chainId;
            let chain = this.listChain.find((x) => x.id == chainId);

            if (chain && safe.safeAddress) {
                this.listAddress.push(safe.safeAddress);
                if (chain['safeAddresses']) {
                    chain['safeAddresses'].push(safe.safeAddress);
                } else {
                    chain['safeAddresses'] = [safe.safeAddress];
                }
            }
        });

        // start sync ws for each chain and address
        for (let network of this.listChain) {
            this.syncFromNetwork(network);
        }
    }
    async syncFromNetwork(network) {
        this._logger.log('syncFromNetwork');
        this._logger.log(JSON.stringify(network));
        // this._logger.debug(JSON.stringify(network));
        let websocketUrl = network.websocket;
        let self = this;
        let websocket = new WebSocket(websocketUrl);
        websocket.on('open', function () {
            self.connectWebsocket(this, network.safeAddresses);
        });
        websocket.on('message', function (message) {
            self.handleMessage(network.websocket, message);
        });
        websocket.on('error', (error) => {
            self._logger.error(error);
        });
    }
    async connectWebsocket(websocket, listAddress) {
        this._logger.log(`connectWebsocket ${websocket._url}`);
        this._logger.log(JSON.stringify(listAddress));
        if (listAddress) {
            listAddress.forEach((address) => {
                let queryTransactionFromAddress = {
                    jsonrpc: '2.0',
                    method: 'subscribe',
                    id: '0',
                    params: {
                        query: `tm.event='Tx' AND transfer.sender = '${address}'`,
                    },
                };
                let queryTransactionToAddress = {
                    jsonrpc: '2.0',
                    method: 'subscribe',
                    id: '0',
                    params: {
                        query: `tm.event='Tx' AND transfer.recipient = '${address}'`,
                    },
                };
                try {
                    websocket.send(JSON.stringify(queryTransactionFromAddress));
                    websocket.send(JSON.stringify(queryTransactionToAddress));
                } catch (error) {
                    this._logger.error(error);
                }
            });
        } else {
            this._logger.log('There is no address to connect websocket');
        }
    }
    async handleMessage(source, message) {
        let buffer = Buffer.from(message);
        let response = JSON.parse(buffer.toString());
        // this._logger.debug(response);
        if (response?.result && Object.keys(response.result).length) {
            // let listAddress = []
            let sender = response.result.events['coin_spent.spender'] ?? [];
            let receiver =
                response.result.events['coin_received.receiver'] ?? [];
            let fee = response.result.events['tx.fee'];
            let log = response.result.data.value.TxResult.result.log;
            // [0].events
            let message = {
                recipient: '',
                sender: '',
                denom: '',
                amount: 0,
            };
            try {
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
            } catch (error) {
                this._logger.error('this is error transaction');
            }

            let listAddress = [...sender, ...receiver];
            if (listAddress.length > 0) {
                let checkExistsSafeAddress =
                    await this.safeRepository.checkExistsSafeAddress(
                        listAddress,
                    );
            }

            let chainId = this.listChain.find((x) => x.websocket == source).id;
            // console.log("chainId", chainId)
            let auraTx = {
                code: response.result.data.value.TxResult.result.code ?? 0,
                codeSpace:
                    response.result.data.value.TxResult.result.codespace ?? '',
                data: '',
                gasUsed: response.result.data.value.TxResult.result.gas_used,
                gasWanted:
                    response.result.data.value.TxResult.result.gas_wanted,
                height: response.result.events['tx.height'][0],
                info: '',
                logs: '',
                rawLogs: response.result.data.value.TxResult.result.log,
                tx: '',
                txHash: response.result.events['tx.hash'][0],
                timeStamp: null,
                chainId: chainId,
                fromAddress: message.sender,
                toAddress: message.recipient,
                amount: message.amount,
                denom: message.denom,
            };
            // let result = await this.auraTxRepository.findAll();

            await this.auraTxRepository.insertBulkTransaction([auraTx]);
        }
    }
}
