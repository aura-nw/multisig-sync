import { StargateClient } from '@cosmjs/stargate';
import * as axios from 'axios';
import { CacheContainer } from 'node-ts-cache'
import { MemoryStorage } from 'node-ts-cache-storage-memory'
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ISyncRestService } from '../isync-rest.service';
import { CONST_CHAR, MESSAGE_ACTION, TRANSACTION_STATUS } from '../../common';
import { ConfigService } from '../../shared/services/config.service';
import { REPOSITORY_INTERFACE } from '../../module.config';
import {
    IAuraTransactionRepository,
    IChainRepository,
    IMultisigTransactionRepository,
    ISafeRepository,
    IMessageRepository
} from '../../repositories';
import { AuraTx, Message } from '../../entities';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
const _ = require('lodash');

@Injectable()
export class SyncRestService implements ISyncRestService {
    private readonly _logger = new Logger(SyncRestService.name);
    private chain;
    private listSafeAddress;
    private listChainIdSubscriber;
    private listMessageAction = [
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_DELEGATE,
        MESSAGE_ACTION.MSG_REDELEGATE,
        MESSAGE_ACTION.MSG_UNDELEGATE,
        MESSAGE_ACTION.MSG_WITHDRAW_REWARDS,
    ];
    private cacheHeight = new CacheContainer(new MemoryStorage());;
    private cacheKey;

    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY)
        private messageRepository: IMessageRepository,
        @InjectQueue('sync-rest') private readonly syncQueue: Queue
    ) {
        this._logger.log(
            '============== Constructor Sync Rest Service ==============',
        );
        this.listChainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.cacheKey = this.configService.get('LAST_BLOCK_HEIGHT');
        this.syncRest();
    }

    @Cron(CronExpression.EVERY_10_SECONDS)
    async syncRest() {
        this.chain = await this.chainRepository.findChainByChainId(this.listChainIdSubscriber[0]);
        this.listSafeAddress = await this.safeRepository.findSafeByInternalChainId(this.chain.id);
        //add address for each chain
        this.listSafeAddress.map((safe) => {
            if (this.chain && safe.safeAddress) {
                if (this.chain['safeAddresses'])
                    this.chain['safeAddresses'].push(safe);
                else this.chain['safeAddresses'] = [safe];
            }
        });
        if (this.chain.rest.slice(-1) !== '/') this.chain.rest = this.chain.rest + '/';

        await this.findTxByHash(this.chain);
        if (this.chain.safeAddresses !== undefined) {
            this.syncFromNetwork(this.chain, this.chain.safeAddresses);
        }
    }

    async getLatestBlockHeight(chainId) {
        const lastHeight = await this.auraTxRepository.getLatestBlockHeight(chainId);
        return lastHeight;
    }

    async syncFromNetwork(network, listSafes) {
        try {
            const safes = _.keyBy(listSafes, 'safeAddress');
            const client = await StargateClient.connect(network.rpc);
            // Get the current block height received from websocket
            let height = (await client.getBlock()).header.height;
            // Get the last block height from cache (if exists) minus 2 blocks
            const cacheLastHeight: Number = await this.cacheHeight.getItem<Number>(this.cacheKey);
            let lastHeight = (cacheLastHeight ? cacheLastHeight : (await this.getLatestBlockHeight(network.id))) - 2;
            this._logger.log(`Last height from cache: ${cacheLastHeight} with key ${this.cacheKey}`);
            // set cache last height to the latest block height
            await this.cacheHeight.setItem(this.cacheKey, height, { isCachedForever: true });

            // Query lost transactions
            for (let i = lastHeight; i <= height; i++) {
                this.syncQueue.add('sync-tx-by-height', {
                    height: i,
                    safes,
                    network,
                });
            }
        } catch (error) {
            this._logger.error(error);
        }
    }

    async checkTxFail(listTxHashes) {
        let txs = await this.multisigTransactionRepository.findMultisigTransactionsByHashes(listTxHashes, this.chain.id);
        txs.map(tx => tx.status = TRANSACTION_STATUS.FAILED);
        await this.multisigTransactionRepository.update(txs);
    }

    async findTxByHash(network) {
        let pendingTransations = [], listQueries: any[] = [], pendingTxMessages: any[] = [];
        const listPendingTx = await this.multisigTransactionRepository.findPendingMultisigTransaction(this.chain.id);
        if (listPendingTx.length > 0) {
            listPendingTx.map(tx =>
                listQueries.push(axios.default.get(
                    network.rest + this.configService.get('PARAM_TX_BY_HASH') + tx.txHash
                ))
            );

            let result: any = await Promise.all(listQueries);
            this.checkTxFail(result.filter(res => res.tx_response.code !== 0).map(res => res.tx_response.txhash));
            await Promise.all(result.map(async res => {
                let listTxMessages: any[] = [];
                await Promise.all(res.data.tx.body.messages.filter(msg =>
                    this.listMessageAction.includes(msg['@type']) && res.data.tx_response.code === 0
                ).map(async (msg, index) => {
                    const type = msg['@type'];
                    let txMessage = new Message();
                    switch (type) {
                        case MESSAGE_ACTION.MSG_SEND:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_SEND;
                            txMessage.fromAddress = msg.from_address;
                            txMessage.toAddress = msg.to_address;
                            txMessage.amount = msg.amount[0].amount;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_MULTI_SEND:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_MULTI_SEND;
                            txMessage.fromAddress = msg.inputs[0].address;
                            msg.outputs.map(output => {
                                txMessage.toAddress = output.address;
                                txMessage.amount = output.coins[0].amount;
                                listTxMessages.push(txMessage);
                            });
                            break;
                        case MESSAGE_ACTION.MSG_DELEGATE:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_DELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_delegate = res.data.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_delegate && coin_received_delegate.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_delegate.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_delegate[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_REDELEGATE:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_REDELEGATE;
                            txMessage.toAddress = msg.delegator_address;
                            let valSrcAddr = msg.validator_src_address;
                            let valDstAddr = msg.validator_dst_address;
                            let coin_received_redelegate = res.data.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_redelegate && coin_received_redelegate.find(x => x.value === msg.delegator_address)) {
                                const paramVal = this.configService.get('PARAM_GET_VALIDATOR') + valSrcAddr;
                                let resultVal: any = await axios.default.get(network.rest + paramVal);
                                let redelegate_claimed_reward = coin_received_redelegate.find(x => x.key === CONST_CHAR.AMOUNT);
                                txMessage.amount = redelegate_claimed_reward.value.match(/\d+/g)[0];
                                if (Number(resultVal.validator.commission.commission_rates.rate) !== 1) {
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
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_UNDELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_unbond = res.data.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_unbond && coin_received_unbond.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_unbond.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_unbond[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_WITHDRAW_REWARDS:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_WITHDRAW_REWARDS;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            let coin_received_claim = res.data.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_claim && coin_received_claim.find(x => x.value === msg.delegator_address)) {
                                txMessage.amount = coin_received_claim.find(x => x.key = CONST_CHAR.AMOUNT)
                                    .value.match(/\d+/g)[0];
                                listTxMessages.push(txMessage);
                            }
                            break;
                    }
                }));

                if (listTxMessages.length > 0) {
                    pendingTxMessages.push(listTxMessages);
                    let auraTx = new AuraTx();
                    auraTx.txHash = res.data.tx_response.txhash;
                    auraTx.height = parseInt(res.data.tx_response.height, 10);
                    auraTx.code = res.data.tx_response.code;
                    auraTx.gasWanted = parseInt(res.data.tx_response.gas_wanted, 10);
                    auraTx.gasUsed = parseInt(res.data.tx_response.gas_used, 10);
                    auraTx.fee = parseInt(res.data.tx.auth_info.fee.amount[0].amount, 10);
                    auraTx.rawLogs = res.data.tx_response.raw_log;
                    auraTx.denom = network.denom;
                    auraTx.timeStamp = new Date(res.data.tx_response.timestamp);
                    auraTx.internalChainId = network.id;
                    pendingTransations.push(auraTx);
                    this._logger.log(auraTx.txHash, 'Pending Tx being updated');
                }
            }));

            if (pendingTransations.length > 0) {
                let txs = await this.auraTxRepository.insertBulkTransaction(pendingTransations);
                let id = txs.insertId;
                pendingTxMessages.map(txMessage => txMessage.map(tm => tm.auraTxId = id++));
                await this.messageRepository.insertBulkTransaction(pendingTxMessages.flat());
            }
        }
    }
}
