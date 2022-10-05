import { decodeTxRaw } from '@cosmjs/proto-signing';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ErrorMap } from 'src/common/error.map';
import { ResponseDto } from 'src/dtos/responses/response.dto';
import { MODULE_REQUEST, REPOSITORY_INTERFACE } from 'src/module.config';
import { IAuraTransactionRepository } from 'src/repositories/iaura-tx.repository';
import { IChainRepository } from 'src/repositories/ichain.repository';
import { ISafeRepository } from 'src/repositories/isafe.repository';
import { ConfigService } from 'src/shared/services/config.service';
import { ISyncWebsocketService } from '../isync-websocket.service';
import { MESSAGE_ACTION } from 'src/common/constants/app.constant';
import { StargateClient } from '@cosmjs/stargate';
import { AuraTx } from 'src/entities/aura-tx.entity';
import * as WebSocket from 'socket.io-client';
@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private chain: any = {};
    private listAddress = [];
    private chainIdSubscriber = '';
    private websocketSubscriber;
    private listMessageAction = [
        MESSAGE_ACTION.MSG_EXECUTE_CONTRACT,
        MESSAGE_ACTION.MSG_INSTANTIATE_CONTRACT,
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_STORE_CODE,
    ];

    constructor(
        private configService: ConfigService,
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
        this.chainIdSubscriber = JSON.parse(this.configService.get('CHAIN_SUBCRIBE'));
        this.websocketSubscriber = this.configService.get('WEBSOCKET_URL');
        // this.startSyncWebsocket();
    }

    async startSyncWebsocket() {
        this._logger.log('syncFromNetwork');
        let websocketUrl = this.websocketSubscriber;
        let self = this;
        this.chain = await this.chainRepository.findChainByChainId(this.chainIdSubscriber);
        let websocket = WebSocket.io(websocketUrl);
        websocket.on('connect', () => {
            console.log('Connected to websocket');
        });
        websocket.on('broadcast-safe-message', (data) => {
            self.handleMessage(data);
        });
        websocket.on('error', (error) => {
            self._logger.error(error);
            websocket.close();
            process.exit(1);
        });
        websocket.on('close', () => {
            self._logger.log('closed');
            websocket.close();
            process.exit(1);
        });

        return websocket;
    }

    async handleMessage(listTx) {
        this._logger.log(listTx);
        let syncTxs: any[] = [];
        try {
            listTx.map(txs => {
                txs.tx.body.messages.map(msg => {
                    const type = msg['@type'];
                    let auraTx = new AuraTx();
                    auraTx.txHash = txs.tx_response.txhash;
                    auraTx.height = parseInt(txs.tx_response.height, 10);
                    auraTx.code = txs.tx_response.code;
                    auraTx.gasWanted = parseInt(txs.tx_response.gas_wanted, 10);
                    auraTx.gasUsed = parseInt(txs.tx_response.gas_used, 10);
                    auraTx.fee = parseInt(txs.tx.auth_info.fee.amount[0].amount, 10);
                    auraTx.rawLogs = txs.tx_response.raw_log;
                    auraTx.timeStamp = new Date(txs.tx_response.timestamp);
                    auraTx.internalChainId = this.chain.id;
                    switch (type) {
                        case MESSAGE_ACTION.MSG_SEND:
                            auraTx.fromAddress = msg.from_address;
                            auraTx.toAddress = msg.to_address;
                            auraTx.amount = parseInt(msg.amount[0].amount, 10);
                            auraTx.denom = msg.amount[0].denom;
                            syncTxs.push(auraTx);
                            break;
                        case MESSAGE_ACTION.MSG_MULTI_SEND:
                            auraTx.fromAddress = msg.inputs[0].address;
                            msg.outputs.map(output => {
                                auraTx.toAddress = output.address;
                                auraTx.amount = parseInt(output.coins[0].amount, 10);
                                auraTx.denom = output.coins[0].denom;
                                syncTxs.push(auraTx);
                            });
                            break;
                    }
                });
            });
    
            let existSafes = await this.safeRepository.findSafeByInternalChainId(this.chain.id);
            syncTxs = syncTxs.filter(tx => existSafes.find(safe => safe.safeAddress === tx.toAddress));
            this._logger.log('Qualified Txs: ' + JSON.stringify(syncTxs));
    
            if (syncTxs.length > 0) await this.auraTxRepository.insertBulkTransaction(syncTxs);
        } catch (error) {
            this._logger.error(error);
        }
    }

    async searchTxRest(txHash: string, rpc: string) {
        this._logger.log('Search in rest... txHash: ' + txHash);
        const client = await StargateClient.connect(rpc);
        return client.getTx(txHash);
    }
}
