/* eslint-disable prettier/prettier */
import { Inject, Logger } from '@nestjs/common';
import { uniq } from 'lodash';
import { Input, Output } from 'cosmjs-types/cosmos/bank/v1beta1/bank';
import { ITransactionHistoryRepository } from 'src/repositories/itx-history.repository';

import { CONST_CHAR, MESSAGE_ACTION } from '../../common';
import { AuraTx, Message, TransactionHistory } from '../../entities';
import { REPOSITORY_INTERFACE } from '../../module.config';
import {
    IAuraTransactionRepository,
    IMessageRepository,
    IMultisigTransactionRepository,
} from '../../repositories';

export class CommonService {
    private readonly _logger = new Logger(CommonService.name);
    private listMessageAction = [
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_DELEGATE,
        MESSAGE_ACTION.MSG_REDELEGATE,
        MESSAGE_ACTION.MSG_UNDELEGATE,
        MESSAGE_ACTION.MSG_WITHDRAW_REWARDS,
        MESSAGE_ACTION.MSG_VOTE,
        MESSAGE_ACTION.EXECUTE_CONTRACT,
    ];
    private listMessageStake = [
        MESSAGE_ACTION.MSG_DELEGATE,
        MESSAGE_ACTION.MSG_REDELEGATE,
        MESSAGE_ACTION.MSG_UNDELEGATE,
        MESSAGE_ACTION.MSG_WITHDRAW_REWARDS,
    ];

    constructor(
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY)
        private multisigTransactionRepository: IMultisigTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY)
        private messageRepository: IMessageRepository,
        @Inject(REPOSITORY_INTERFACE.ITX_HISTORY_REPOSITORY)
        private txHistoryRepository: ITransactionHistoryRepository,
    ) {}

    async handleTransactions(listTx, safes, chain) {
        // const safeAddresses = Object.keys(safes);
        const syncTxs: any[] = [],
            syncTxMessages: any[] = [],
            txsHistory: TransactionHistory[] = [];
        try {
            listTx.map((txs) => {
                const listTxMessages: any[] = [];
                let relatedSafeAddress: string[] = [];
                let auraTxAmount = null;
                let auraTxRewardAmount = null;

                txs.tx.body.messages.map((msg, index) => {
                    const type = msg['@type'];
                    const txMessage = new Message();
                    switch (type) {
                        case MESSAGE_ACTION.MSG_SEND:
                            relatedSafeAddress.push(
                                ...[msg.from_address, msg.to_address].filter(
                                    (address) => safes[address],
                                ),
                            );

                            if (relatedSafeAddress.length === 0) break;

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_SEND;
                            txMessage.fromAddress = msg.from_address;
                            txMessage.toAddress = msg.to_address;
                            txMessage.amount = msg.amount[0].amount;
                            auraTxAmount += parseFloat(msg.amount[0].amount);
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_MULTI_SEND:
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_MULTI_SEND;
                            txMessage.fromAddress = msg.inputs[0].address;
                            msg.outputs
                                .filter(
                                    (output) =>
                                        safes[msg.inputs[0].address] ||
                                        safes[output.address],
                                )
                                .map((output) => {
                                    txMessage.toAddress = output.address;
                                    txMessage.amount = output.coins[0].amount;
                                    auraTxAmount += parseFloat(
                                        output.coins[0].amount,
                                    );
                                    listTxMessages.push(txMessage);
                                });

                            relatedSafeAddress = [
                                ...msg.inputs.map(
                                    (input: Input) => input.address,
                                ),
                                ...msg.outputs.map(
                                    (output: Output) => output.address,
                                ),
                            ].filter((address: string) => safes[address]);
                            break;
                        case MESSAGE_ACTION.MSG_DELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            relatedSafeAddress.push(msg.delegator_address);

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_DELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.amount = null;
                            auraTxAmount += parseFloat(msg.amount.amount);
                            if (txs.tx_response.logs.length > 0) {
                                if (
                                    txs.tx_response.logs[index].events.find(
                                        (event) =>
                                            event.type ===
                                            CONST_CHAR.WITHDRAW_REWARDS,
                                    )
                                ) {
                                    txMessage.amount = txs.tx_response.logs[
                                        index
                                    ].events
                                        .find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        )
                                        .attributes.find(
                                            (attr) =>
                                                attr.key === CONST_CHAR.AMOUNT,
                                        )
                                        .value.match(/\d+/g)[0];
                                    auraTxRewardAmount += parseFloat(
                                        txMessage.amount,
                                    );
                                }
                            }
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_REDELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            relatedSafeAddress.push(msg.delegator_address);

                            let withdraw_rewards = null;
                            txMessage.typeUrl = MESSAGE_ACTION.MSG_REDELEGATE;
                            txMessage.fromAddress = null;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.amount = null;
                            auraTxAmount += parseFloat(msg.amount.amount);
                            if (txs.tx_response.logs.length > 0) {
                                if (
                                    txs.tx_response.logs[index].events.find(
                                        (event) =>
                                            event.type ===
                                            CONST_CHAR.WITHDRAW_REWARDS,
                                    )
                                ) {
                                    txMessage.fromAddress =
                                        txs.tx_response.logs[index].events
                                            .find(
                                                (event) =>
                                                    event.type ===
                                                    CONST_CHAR.WITHDRAW_REWARDS,
                                            )
                                            .attributes.find(
                                                (attr) =>
                                                    attr.key ===
                                                    CONST_CHAR.VALIDATOR,
                                            ).value;
                                    txMessage.amount = txs.tx_response.logs[
                                        index
                                    ].events
                                        .find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        )
                                        .attributes.find(
                                            (attr) =>
                                                attr.key === CONST_CHAR.AMOUNT,
                                        )
                                        .value.match(/\d+/g)[0];
                                    auraTxRewardAmount += parseFloat(
                                        txMessage.amount,
                                    );
                                    withdraw_rewards = txs.tx_response.logs[
                                        index
                                    ].events.find(
                                        (event) =>
                                            event.type ===
                                            CONST_CHAR.WITHDRAW_REWARDS,
                                    );
                                }
                            }
                            listTxMessages.push(txMessage);
                            if (withdraw_rewards) {
                                if (withdraw_rewards.attributes.length > 2) {
                                    const txMessageDst = new Message();
                                    txMessageDst.typeUrl =
                                        MESSAGE_ACTION.MSG_REDELEGATE;
                                    txMessageDst.toAddress =
                                        msg.delegator_address;
                                    txMessageDst.fromAddress =
                                        txs.tx_response.logs[index].events.find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        ).attributes[3].value;
                                    txMessageDst.amount = txs.tx_response.logs[
                                        index
                                    ].events
                                        .find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        )
                                        .attributes[2].value.match(/\d+/g)[0];
                                    auraTxRewardAmount += parseFloat(
                                        txMessageDst.amount,
                                    );
                                    listTxMessages.push(txMessageDst);
                                }
                            }
                            break;
                        case MESSAGE_ACTION.MSG_UNDELEGATE:
                            if (!safes[msg.delegator_address]) break;
                            relatedSafeAddress.push(msg.delegator_address);

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_UNDELEGATE;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.amount = null;
                            auraTxAmount += parseFloat(msg.amount.amount);
                            if (txs.tx_response.logs.length > 0) {
                                if (
                                    txs.tx_response.logs[index].events.find(
                                        (event) =>
                                            event.type ===
                                            CONST_CHAR.WITHDRAW_REWARDS,
                                    )
                                ) {
                                    txMessage.amount = txs.tx_response.logs[
                                        index
                                    ].events
                                        .find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        )
                                        .attributes.find(
                                            (attr) =>
                                                attr.key === CONST_CHAR.AMOUNT,
                                        )
                                        .value.match(/\d+/g)[0];
                                    auraTxRewardAmount += parseFloat(
                                        txMessage.amount,
                                    );
                                }
                            }
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_WITHDRAW_REWARDS:
                            if (!safes[msg.delegator_address]) break;
                            relatedSafeAddress.push(msg.delegator_address);

                            txMessage.typeUrl =
                                MESSAGE_ACTION.MSG_WITHDRAW_REWARDS;
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.amount = null;
                            if (txs.tx_response.logs.length > 0) {
                                if (
                                    txs.tx_response.logs[index].events.find(
                                        (event) =>
                                            event.type ===
                                            CONST_CHAR.WITHDRAW_REWARDS,
                                    )
                                ) {
                                    txMessage.amount = txs.tx_response.logs[
                                        index
                                    ].events
                                        .find(
                                            (event) =>
                                                event.type ===
                                                CONST_CHAR.WITHDRAW_REWARDS,
                                        )
                                        .attributes.find(
                                            (attr) =>
                                                attr.key === CONST_CHAR.AMOUNT,
                                        )
                                        .value.match(/\d+/g)[0];
                                    auraTxRewardAmount += parseFloat(
                                        txMessage.amount,
                                    );
                                }
                            }
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_VOTE:
                            if (!safes[msg.voter]) break;
                            relatedSafeAddress.push(msg.voter);

                            txMessage.typeUrl = MESSAGE_ACTION.MSG_VOTE;
                            txMessage.fromAddress = msg.voter;
                            txMessage.amount = null;
                            txMessage.toAddress = null;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.EXECUTE_CONTRACT:
                            let toAddress = '';
                            const addrs: string[] = [];
                            if (safes[msg.msg?.transfer?.recipient]) {
                                toAddress = msg.msg?.transfer?.recipient;
                                addrs.push(toAddress);
                            }
                            if (safes[msg.sender]) addrs.push(msg.sender);

                            if (addrs.length === 0) break;

                            relatedSafeAddress.push(...addrs);

                            txMessage.typeUrl = MESSAGE_ACTION.EXECUTE_CONTRACT;
                            txMessage.fromAddress = msg.sender;
                            txMessage.amount = null;
                            txMessage.toAddress = toAddress;
                            txMessage.contractAddress = msg.contract;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.IBC_TRANSFER:
                            if (!safes[msg.sender]) break;
                            relatedSafeAddress.push(msg.sender);

                            txMessage.typeUrl = MESSAGE_ACTION.IBC_TRANSFER;
                            txMessage.fromAddress = msg.sender;
                            txMessage.toAddress = msg.receiver;
                            txMessage.amount = msg.token.amount;
                            txMessage.denom = msg.token.denom;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.IBC_RECEIVE:
                            const eventLog = txs.tx_response.logs[
                                index
                            ].events.find((e) => e.type === 'transfer');
                            if (eventLog) {
                                const sender = eventLog.attributes.find(
                                    (att) => att.key === 'sender',
                                ).value;
                                const recipient = eventLog.attributes.find(
                                    (att) => att.key === 'recipient',
                                ).value;
                                const amountDenom = eventLog.attributes.find(
                                    (att) => att.key === 'amount',
                                ).value;
                                relatedSafeAddress.push(
                                    ...[sender, recipient].filter(
                                        (address) => safes[address],
                                    ),
                                );
                                if (relatedSafeAddress.length === 0) break;

                                txMessage.typeUrl = MESSAGE_ACTION.IBC_RECEIVE;
                                txMessage.fromAddress = sender;
                                txMessage.toAddress = recipient;
                                const [amount, denom] =
                                    amountDenom.split('ibc');
                                txMessage.amount = amount;
                                txMessage.denom = `ibc${denom}`;
                                auraTxAmount += parseFloat(amount);

                                listTxMessages.push(txMessage);
                                break;
                            }

                        default:
                            const relatedSafeAddr = this.getRelatedAddrOnAnyMsg(
                                safes,
                                msg,
                            );
                            if (relatedSafeAddr) {
                                // save any msg
                                relatedSafeAddress.push(relatedSafeAddr);
                                txMessage.typeUrl = type;
                                txMessage.fromAddress = relatedSafeAddr;
                                txMessage.amount = null;
                                txMessage.toAddress = null;
                                listTxMessages.push(txMessage);
                            }
                            break;
                    }
                });
                if (listTxMessages.length > 0) {
                    syncTxMessages.push(listTxMessages);
                    const auraTx = new AuraTx();
                    auraTx.txHash = txs.tx_response.txhash;
                    auraTx.height = parseInt(txs.tx_response.height, 10);
                    auraTx.code = txs.tx_response.code;
                    auraTx.gasWanted = parseInt(txs.tx_response.gas_wanted, 10);
                    auraTx.gasUsed = parseInt(txs.tx_response.gas_used, 10);
                    auraTx.fee = parseInt(
                        txs.tx.auth_info.fee.amount[0].amount,
                        10,
                    );
                    // Remove single quote
                    auraTx.rawLogs = txs.tx_response.raw_log.replaceAll(
                        "'",
                        '',
                    );
                    auraTx.fromAddress = this.listMessageStake.includes(
                        listTxMessages[0].typeUrl,
                    )
                        ? listTxMessages[0].toAddress
                        : listTxMessages[0].fromAddress;
                    auraTx.toAddress = this.listMessageStake.includes(
                        listTxMessages[0].typeUrl,
                    )
                        ? null
                        : listTxMessages[0].toAddress;
                    auraTx.amount = auraTxAmount;
                    auraTx.rewardAmount = auraTxRewardAmount;
                    auraTx.denom = chain.denom;
                    auraTx.timeStamp = new Date(txs.tx_response.timestamp);
                    auraTx.internalChainId = chain.id;
                    syncTxs.push(auraTx);
                }
                uniq(relatedSafeAddress).forEach((address) => {
                    txsHistory.push(
                        new TransactionHistory(
                            chain.id,
                            address,
                            txs.tx_response.txhash,
                            txs.tx_response.timestamp,
                        ),
                    );
                });
            });
            this._logger.log('Qualified Txs: ' + JSON.stringify(syncTxs));

            if (syncTxs.length > 0) {
                const txs = await this.auraTxRepository.insertBulkTransaction(
                    syncTxs,
                );

                // Insert tx history
                await this.txHistoryRepository.create(txsHistory);

                let id = txs.insertId;
                syncTxMessages.map((txMessage) => {
                    txMessage.map((tm) => (tm.auraTxId = id));
                    id++;
                });
                await this.messageRepository.insertBulkMessage(
                    syncTxMessages.flat(),
                );

                // Update status of multisig txs
                const affectedRows =
                    await this.multisigTransactionRepository.updateMultisigTxStatusByAuraTx(
                        syncTxs,
                    );
                this._logger.log('Affected rows: ' + affectedRows);
            }
        } catch (error) {
            throw error;
        }
    }

    private getRelatedAddrOnAnyMsg(safes: any, msg: any): string {
        for (const key of Object.keys(msg)) {
            const value = msg[key];
            if (typeof value === 'string' && safes[value]) return value;
        }
        return undefined;
    }
}
