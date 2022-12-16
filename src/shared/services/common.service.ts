/* eslint-disable prettier/prettier */
import { Inject, Logger } from '@nestjs/common';

import { CONST_CHAR, MESSAGE_ACTION } from '../../common';
import { AuraTx, Message } from '../../entities';
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
    ) {}

    async handleTransactions(listTx, safes, chain) {
        const syncTxs: any[] = [],
            syncTxMessages: any[] = [];
        try {
            listTx.map((txs) => {
                const listTxMessages: any[] = [];
                let auraTxAmount = null,
                    auraTxRewardAmount = null;

                txs.tx.body.messages
                    .filter((msg) =>
                        this.listMessageAction.includes(msg['@type']),
                    )
                    .map((msg, index) => {
                        const type = msg['@type'];
                        const txMessage = new Message();
                        switch (type) {
                            case MESSAGE_ACTION.MSG_SEND:
                                if (
                                    !safes[msg.to_address] &&
                                    !safes[msg.from_address]
                                )
                                    break;
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_SEND;
                                txMessage.fromAddress = msg.from_address;
                                txMessage.toAddress = msg.to_address;
                                txMessage.amount = msg.amount[0].amount;
                                auraTxAmount += parseFloat(
                                    msg.amount[0].amount,
                                );
                                listTxMessages.push(txMessage);
                                break;
                            case MESSAGE_ACTION.MSG_MULTI_SEND:
                                txMessage.typeUrl =
                                    MESSAGE_ACTION.MSG_MULTI_SEND;
                                txMessage.fromAddress = msg.inputs[0].address;
                                msg.outputs
                                    .filter(
                                        (output) =>
                                            safes[msg.inputs[0].address] ||
                                            safes[output.address],
                                    )
                                    .map((output) => {
                                        txMessage.toAddress = output.address;
                                        txMessage.amount =
                                            output.coins[0].amount;
                                        auraTxAmount += parseFloat(
                                            output.coins[0].amount,
                                        );
                                        listTxMessages.push(txMessage);
                                    });
                                break;
                            case MESSAGE_ACTION.MSG_DELEGATE:
                                if (!safes[msg.delegator_address]) break;
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
                                                    attr.key ===
                                                    CONST_CHAR.AMOUNT,
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
                                let withdraw_rewards = null;
                                txMessage.typeUrl =
                                    MESSAGE_ACTION.MSG_REDELEGATE;
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
                                                    attr.key ===
                                                    CONST_CHAR.AMOUNT,
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
                                    if (
                                        withdraw_rewards.attributes.length > 2
                                    ) {
                                        const txMessageDst = new Message();
                                        txMessageDst.typeUrl =
                                            MESSAGE_ACTION.MSG_REDELEGATE;
                                        txMessageDst.toAddress =
                                            msg.delegator_address;
                                        txMessageDst.fromAddress =
                                            txs.tx_response.logs[
                                                index
                                            ].events.find(
                                                (event) =>
                                                    event.type ===
                                                    CONST_CHAR.WITHDRAW_REWARDS,
                                            ).attributes[3].value;
                                        txMessageDst.amount =
                                            txs.tx_response.logs[index].events
                                                .find(
                                                    (event) =>
                                                        event.type ===
                                                        CONST_CHAR.WITHDRAW_REWARDS,
                                                )
                                                .attributes[2].value.match(
                                                    /\d+/g,
                                                )[0];
                                        auraTxRewardAmount += parseFloat(
                                            txMessageDst.amount,
                                        );
                                        listTxMessages.push(txMessageDst);
                                    }
                                }
                                break;
                            case MESSAGE_ACTION.MSG_UNDELEGATE:
                                if (!safes[msg.delegator_address]) break;
                                txMessage.typeUrl =
                                    MESSAGE_ACTION.MSG_UNDELEGATE;
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
                                                    attr.key ===
                                                    CONST_CHAR.AMOUNT,
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
                                                    attr.key ===
                                                    CONST_CHAR.AMOUNT,
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
                                txMessage.typeUrl = MESSAGE_ACTION.MSG_VOTE;
                                txMessage.fromAddress = msg.voter;
                                txMessage.amount = null;
                                txMessage.toAddress = null;
                                listTxMessages.push(txMessage);
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
                    auraTx.rawLogs = txs.tx_response.raw_log;
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
            });
            this._logger.log('Qualified Txs: ' + JSON.stringify(syncTxs));

            if (syncTxs.length > 0) {
                const txs = await this.auraTxRepository.insertBulkTransaction(
                    syncTxs,
                );
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
}
