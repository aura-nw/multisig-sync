import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPOSITORY_INTERFACE } from '../../module.config';
import { StargateClient } from '@cosmjs/stargate';
import * as WebSocket from 'socket.io-client';
import * as axios from 'axios';
import { ISyncWebsocketService } from '../isync-websocket.service';
import { CONST_CHAR, MESSAGE_ACTION, TRANSACTION_STATUS } from '../../common';
import { ConfigService } from '../../shared/services/config.service';
import {
    IAuraTransactionRepository,
    IChainRepository,
    ISafeRepository,
    IMessageRepository,
    IMultisigTransactionRepository
} from '../../repositories';
import { AuraTx, Message } from '../../entities';
const _ = require('lodash');

@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private chain: any = {};
    private chainIdSubscriber = '';
    private websocketSubscriber;
    private listMessageAction = [
        MESSAGE_ACTION.MSG_EXECUTE_CONTRACT,
        MESSAGE_ACTION.MSG_INSTANTIATE_CONTRACT,
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_STORE_CODE,
        MESSAGE_ACTION.DELEGATE,
        MESSAGE_ACTION.REDELEGATE,
        MESSAGE_ACTION.UNDELEGATE,
        MESSAGE_ACTION.REWARD,
    ];

    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY)
        private messageRepository: IMessageRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
    ) {
        this._logger.log(
            '============== Constructor Sync Websocket Service ==============',
        );
        this.chainIdSubscriber = JSON.parse(this.configService.get('CHAIN_SUBCRIBE'));
        this.websocketSubscriber = this.configService.get('WEBSOCKET_URL');
        this.startSyncWebsocket();
    }

    async startSyncWebsocket() {
        this._logger.log('syncFromNetwork');
        this._logger.log(JSON.stringify(network));
        // this._logger.debug(JSON.stringify(network));
        let websocketUrl = network.websocket;
        let self = this;
        this.chain = await this.chainRepository.findChainByChainId(this.chainIdSubscriber);
        if (this.chain.rest.slice(-1) !== '/') this.chain.rest = this.chain.rest + '/';
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
        let syncTxs: any[] = [], syncTxMessages: any[] = [];
        try {
            if (listTx.filter(res => res.tx_response.code !== 0).length > 0)
                this.checkTxFail(listTx.filter(res => res.tx_response.code !== 0).map(res => {
                    return {
                        code: res.tx_response.code,
                        txHash: res.tx_response.txhash
                    }
                }));

            let existSafes = await this.safeRepository.findSafeByInternalChainId(this.chain.id);
            const safes = _.keyBy(existSafes, 'safeAddress');

            await Promise.all(listTx.map(async txs => {
                let listTxMessages: any[] = [];

                // for tx with auto claim reward amount == 0
                let hasToInsert = false;

                await Promise.all(txs.tx.body.messages.filter(msg =>
                    this.listMessageAction.includes(msg['@type']) && txs.tx_response.code === 0
                ).map(async (msg, index) => {
                    const type = msg['@type'];
                    let txMessage = new Message();
                    switch (type) {
                        case MESSAGE_ACTION.MSG_SEND:
                            if (!safes[msg.to_address] && !safes[msg.from_address]) break;
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_SEND;
                            txMessage.fromAddress = msg.from_address;
                            txMessage.toAddress = msg.to_address;
                            txMessage.amount = msg.amount[0].amount;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_MULTI_SEND:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_MULTI_SEND;
                            txMessage.fromAddress = msg.inputs[0].address;
                            msg.outputs.filter(output => safes[msg.inputs[0].address] || safes[output.address])
                                .map(output => {
                                    txMessage.toAddress = output.address;
                                    txMessage.amount = output.coins[0].amount;
                                    listTxMessages.push(txMessage);
                                });
                            break;
                        case MESSAGE_ACTION.MSG_DELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            hasToInsert = true;

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_DELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_delegate = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_delegate && coin_received_delegate.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_delegate.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_delegate[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_REDELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            hasToInsert = true;

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_REDELEGATE;
                            txMessage.toAddress = msg.delegator_address;
                            let valSrcAddr = msg.validator_src_address;
                            let valDstAddr = msg.validator_dst_address;
                            let coin_received_redelegate = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_redelegate && coin_received_redelegate.find(x => x.value === msg.delegator_address)) {
                                const paramVal = this.configService.get('PARAM_GET_VALIDATOR') + valSrcAddr;
                                let resultVal: any = await axios.default.get(this.chain.rest + paramVal);
                                let redelegate_claimed_reward = coin_received_redelegate.find(x => x.key === CONST_CHAR.AMOUNT);
                                txMessage.amount = redelegate_claimed_reward.value.match(/\d+/g)[0];
                                if (Number(resultVal.data.validator.commission.commission_rates.rate) !== 1) {
                                    txMessage.fromAddress = valSrcAddr;
                                    listTxMessages.push(txMessage);
                                } else {
                                    txMessage.fromAddress = valDstAddr;
                                    listTxMessages.push(txMessage);
                                }
                                if (coin_received_redelegate.length > 2) {
                                    txMessage.fromAddress = valDstAddr;
                                    txMessage.amount = coin_received_redelegate[3].value.match(/\d+/g)[0];
                                    listTxMessages.push(txMessage);
                                }
                            }
                            break;
                        case MESSAGE_ACTION.MSG_UNDELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            hasToInsert = true;

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_UNDELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_unbond = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_unbond && coin_received_unbond.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_unbond.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_unbond[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_WITHDRAW_REWARDS:
                            if (!safes[msg.delegator_address]) break;
                            hasToInsert = true;

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_WITHDRAW_REWARDS;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_claim = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_claim && coin_received_claim.find(x => x.value === msg.delegator_address)) {
                                txMessage.amount = coin_received_claim.find(x => x.key = CONST_CHAR.AMOUNT)
                                    .value.match(/\d+/g)[0];
                                listTxMessages.push(txMessage);
                            }
                            break;
                    }
                }));
                if (hasToInsert || listTxMessages.length > 0) {
                    syncTxMessages.push(listTxMessages);
                    let auraTx = new AuraTx();
                    auraTx.txHash = txs.tx_response.txhash;
                    auraTx.height = parseInt(txs.tx_response.height, 10);
                    auraTx.code = txs.tx_response.code;
                    auraTx.gasWanted = parseInt(txs.tx_response.gas_wanted, 10);
                    auraTx.gasUsed = parseInt(txs.tx_response.gas_used, 10);
                    auraTx.fee = parseInt(txs.tx.auth_info.fee.amount[0].amount, 10);
                    auraTx.rawLogs = txs.tx_response.raw_log;
                    auraTx.fromAddress = listTxMessages[0].fromAddress;
                    auraTx.toAddress = listTxMessages[0].toAddress;
                    auraTx.denom = this.chain.denom;
                    auraTx.timeStamp = new Date(txs.tx_response.timestamp);
                    auraTx.internalChainId = this.chain.id;
                    syncTxs.push(auraTx);
                }
            }));
            this._logger.log('WEBSOCKET Qualified Txs: ' + JSON.stringify(syncTxs));

            if (syncTxs.length > 0) {
                let txs = await this.auraTxRepository.insertBulkTransaction(syncTxs);
                let id = txs.insertId;
                syncTxMessages.map(txMessage => txMessage.map(tm => tm.auraTxId = id++));
                await this.messageRepository.insertBulkTransaction(syncTxMessages.flat());
            }
        } catch (error) {
            this._logger.error(error);
        }
    }

    async checkTxFail(listData) {
        let queries = [];
        listData.map((data) => queries.push(this.multisigTransactionRepository.updateMultisigTransactionsByHashes(
            data, this.chain.id
        )));
        await Promise.all(queries);
    }

    async searchTxRest(txHash: string, rpc: string) {
        this._logger.log('Search in rest... txHash: ' + txHash);
        const client = await StargateClient.connect(rpc);
        return client.getTx(txHash);
    }
}
