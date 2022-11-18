import { OnQueueActive, OnQueueCompleted, OnQueueError, OnQueueFailed, Process, Processor } from "@nestjs/bull";
import { Logger, Inject } from "@nestjs/common";
import * as axios from 'axios';
import { Job } from "bull";
import { CONST_CHAR, MESSAGE_ACTION, TRANSACTION_STATUS } from "../common";
import { AuraTx, Message } from "../entities";
import { REPOSITORY_INTERFACE } from "../module.config";
import {
    IAuraTransactionRepository,
    IMessageRepository,
    IMultisigTransactionRepository,
} from "../repositories";
import { ConfigService } from "../shared/services/config.service";

@Processor('sync-rest')
export class SyncRestProcessor {
    private readonly logger = new Logger(SyncRestProcessor.name);
    private listMessageAction = [
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_DELEGATE,
        MESSAGE_ACTION.MSG_REDELEGATE,
        MESSAGE_ACTION.MSG_UNDELEGATE,
        MESSAGE_ACTION.MSG_WITHDRAW_REWARDS,
        MESSAGE_ACTION.MSG_VOTE,
    ];
    private horoscopeApi;

    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY)
        private messageRepository: IMessageRepository,
    ) {
        this.logger.log(
            '============== Constructor Sync Rest Processor Service ==============',
        );

        this.horoscopeApi = this.configService.get('HOROSCOPE_API');
    }

    @Process({
        name: 'sync-tx-by-height',
        concurrency: 10
    })
    async handleQueryTxByHeight(job: Job) {
        // this.logger.log(`Handle Job: ${JSON.stringify(job.data)}`);
        let syncTxs: any[] = [], syncTxMessages: any[] = [], listQueries: any[] = [];
        let result = [];
        let height = job.data.height;
        let safes = job.data.safeAddresses;
        let network = job.data.network;
        const param = `transaction?chainid=${network.chainId}&blockHeight=${height}&pageLimit=100`;
        let urlToCall = param;
        let done = false;
        let resultCallApi;
        while (!done) {
            resultCallApi = await axios.default.get(this.horoscopeApi + urlToCall);
            if (resultCallApi.data.data.transactions.length > 0)
                resultCallApi.data.data.transactions.map(res => {
                    result.push({
                        code: parseInt(res.tx_response.code, 10),
                        txHash: res.tx_response.txhash
                    });
                });
            if (resultCallApi.data.data.nextKey === null) {
                done = true;
            } else {
                urlToCall = `${param}&nextKey=${encodeURIComponent(
                    resultCallApi.data.data.nextKey,
                )}`;
            }
        }
        this.logger.log(`Txs of block ${height}: ${JSON.stringify(result)}`);

        try {
            if (result.length > 0) {
                // if (result.filter(res => res.code !== 0).length > 0)
                //     this.checkTxFail(result.filter(res => res.code !== 0), network);

                result.map(res => {
                    listQueries.push(axios.default.get(
                        this.horoscopeApi + `transaction?chainid=${network.chainId}&txHash=${res.txHash}&pageLimit=100`
                    ))
                });
                result = await Promise.all(listQueries);

                await Promise.all(result.map(res => res.data.data.transactions[0]).map(async res => {
                    let listTxMessages: any[] = [];
                    await Promise.all(res.tx.body.messages.filter(msg =>
                        this.listMessageAction.includes(msg['@type'])
                        //  && res.tx_response.code === '0'
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
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_DELEGATE;
                                txMessage.fromAddress = msg.validator_address;
                                txMessage.toAddress = msg.delegator_address;
                                txMessage.amount = null;
                                if (res.tx_response.logs.length > 0 ) {
                                    let coin_received_delegate = res.tx_response.logs[index].events
                                    .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                                    if (coin_received_delegate && coin_received_delegate.find(x => x.value === msg.delegator_address)) {
                                        const index_reward = coin_received_delegate.findIndex(x => x.value === msg.delegator_address);
                                        const claimed_reward = coin_received_delegate[index_reward + 1].value.match(/\d+/g)[0];
                                        txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                        listTxMessages.push(txMessage);
                                    }
                                }
                                // listTxMessages.push(txMessage);
                                break;
                            case MESSAGE_ACTION.MSG_REDELEGATE:
                                if (!safes[msg.delegator_address]) break;
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_REDELEGATE;
                                txMessage.toAddress = msg.delegator_address;
                                let valSrcAddr = msg.validator_src_address;
                                let valDstAddr = msg.validator_dst_address;
                                txMessage.fromAddress = null;
                                txMessage.amount = null;

                                if (res.tx_response.logs.length > 0 ) {
                                    let coin_received_redelegate = res.tx_response.logs[index].events
                                    .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;

                                    if (coin_received_redelegate && coin_received_redelegate.find(x => x.value === msg.delegator_address)) {
                                        const paramVal = this.configService.get('PARAM_GET_VALIDATOR') + valSrcAddr;
                                        let resultVal: any = await axios.default.get(network.rest + paramVal);
                                        let redelegate_claimed_reward = coin_received_redelegate.find(x => x.key === CONST_CHAR.AMOUNT);
                                        txMessage.amount = redelegate_claimed_reward.value.match(/\d+/g)[0];
                                        if (Number(resultVal.data.validator.commission.commission_rates.rate) !== 1) {
                                            txMessage.fromAddress = valSrcAddr;
                                            // listTxMessages.push(txMessage);
                                        } else {
                                            txMessage.fromAddress = valDstAddr;
                                            // listTxMessages.push(txMessage);
                                        }
                                        if (coin_received_redelegate.length > 2) {
                                            txMessage.fromAddress = valDstAddr;
                                            txMessage.amount = coin_received_redelegate[3].value.match(/\d+/g)[0];
                                            // listTxMessages.push(txMessage);
                                        }
                                    }
                                }
                                listTxMessages.push(txMessage);
                                break;
                            case MESSAGE_ACTION.MSG_UNDELEGATE:
                                if (!safes[msg.delegator_address]) break;
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_UNDELEGATE;
                                txMessage.fromAddress = msg.validator_address;
                                txMessage.toAddress = msg.delegator_address;
                                txMessage.amount = null;

                                if (res.tx_response.logs.length > 0 ) {
                                    let coin_received_unbond = res.tx_response.logs[index].events
                                        .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                                    if (coin_received_unbond && coin_received_unbond.find(x => x.value === msg.delegator_address)) {
                                        const index_reward = coin_received_unbond.findIndex(x => x.value === msg.delegator_address);
                                        const claimed_reward = coin_received_unbond[index_reward + 1].value.match(/\d+/g)[0];
                                        txMessage.amount = claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward;
                                        // listTxMessages.push(txMessage);
                                    }
                                }
                                listTxMessages.push(txMessage);
                                break;
                            case MESSAGE_ACTION.MSG_WITHDRAW_REWARDS:
                                if (!safes[msg.delegator_address]) break;
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_WITHDRAW_REWARDS;
                                txMessage.fromAddress = msg.validator_address;
                                txMessage.toAddress = msg.delegator_address;
                                txMessage.amount = null;

                                if (res.tx_response.logs.length > 0 ) {
                                    const coin_received_claim = res.tx_response.logs[index].events
                                        .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                                    if (coin_received_claim && coin_received_claim.find(x => x.value === msg.delegator_address)) {
                                        txMessage.amount = coin_received_claim.find(x => x.key === CONST_CHAR.AMOUNT)
                                            .value.match(/\d+/g)[0];
                                        // listTxMessages.push(txMessage);
                                    }
                                }
                                listTxMessages.push(txMessage);
                                break;
                            case MESSAGE_ACTION.MSG_VOTE:
                                if (!safes[msg.voter]) break;
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_VOTE;
                                txMessage.fromAddress = msg.voter;
                                txMessage.amount = null;
                                txMessage.toAddress = null;
                                listTxMessages.push(txMessage);
                                break;
                        }
                    }));

                    if (listTxMessages.length > 0) {
                        syncTxMessages.push(listTxMessages);
                        let auraTx = new AuraTx();
                        auraTx.txHash = res.tx_response.txhash;
                        auraTx.height = parseInt(res.tx_response.height, 10);
                        auraTx.code = res.tx_response.code;
                        auraTx.gasWanted = parseInt(res.tx_response.gas_wanted, 10);
                        auraTx.gasUsed = parseInt(res.tx_response.gas_used, 10);
                        auraTx.fee = parseInt(res.tx.auth_info.fee.amount[0].amount, 10);
                        auraTx.rawLogs = res.tx_response.raw_log;
                        auraTx.fromAddress = listTxMessages[0].fromAddress;
                        auraTx.toAddress = listTxMessages[0].toAddress;
                        auraTx.denom = network.denom;
                        auraTx.timeStamp = new Date(res.tx_response.timestamp);
                        auraTx.internalChainId = network.id;
                        syncTxs.push(auraTx);
                    }
                }));
                this.logger.log('REST Qualified Txs: ' + JSON.stringify(syncTxs));
            }

            if (syncTxs.length > 0) {

                // Save Txs
                let txs = await this.auraTxRepository.insertBulkTransaction(syncTxs);
                let id = txs.insertId;

                // Save TxMessages
                syncTxMessages.map(txMessage => txMessage.map(tm => tm.auraTxId = id++));
                await this.messageRepository.insertBulkMessage(syncTxMessages.flat());

                // Update status of multisig txs
                // TODO: Use nestjs instead of mysql trigger
                // const affectedRows = await this.multisigTransactionRepository.updateMultisigTxStatusByAuraTx(syncTxs);
                // this.logger.log('Affected rows: ' + affectedRows);
            }
        } catch (error) {
            this.logger.error(error);
        }
    }

    @OnQueueActive()
    onActive(job: Job) {
        this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
    }

    @OnQueueCompleted()
    onComplete(job: Job, result: any) {
        this.logger.log(`Completed job ${job.id} of type ${job.name}`);
        this.logger.log(`Result: ${result}`);
    }

    @OnQueueError()
    onError(job: Job, error: Error) {
        this.logger.error(`Job: ${job}`);
        this.logger.error(`Error job ${job.id} of type ${job.name}`);
        this.logger.error(`Error: ${error}`);
    }

    @OnQueueFailed()
    onFailed(job: Job, error: Error) {
        this.logger.error(`Failed job ${job.id} of type ${job.name}`);
        this.logger.error(`Error: ${error}`);
    }

    async checkTxFail(listData, network) {
        let queries = [];
        listData.map((data) => queries.push(this.multisigTransactionRepository.updateMultisigTransactionsByHashes(
            data, network.id
        )));
        await Promise.all(queries);
    }
}