import { Column, Entity } from "typeorm";
import { BaseEntityAutoId } from "./base/base.entity";

@Entity({ name: 'MultisigTransaction' })
export class MultisigTransaction extends BaseEntityAutoId {
    @Column({name: 'SafeId'})
    safeId: number;
 
    @Column({name: 'FromAddress'})
    fromAddress: string;

    @Column({name: 'ToAddress'})
    toAddress: string;

    @Column({name: 'Amount', type: 'float'})
    amount: number;

    @Column({name: 'Denom'})
    denom: string;

    @Column({name: 'Status'})
    status: string;

    @Column({name: 'TypeUrl'})
    typeUrl: string;

    @Column({name: 'Signature'})
    signature: string;

    @Column({name: 'InternalChainId'})
    internalChainId: number;

    @Column({name: 'AccountNumber'})
    accountNumber: number;

    @Column({name: 'Sequence'})
    sequence: string;

    @Column({name: 'Gas', type: 'float'})
    gas: number;

    @Column({name: 'Fee', type: 'float'})
    fee: number;

    @Column({name: 'Msg'})
    msg: string;

    @Column({name: 'MultisigPubkey'})
    multisigPubkey: string;

    @Column({name: 'TxHash'})
    txHash: string;

    @Column({name: 'Map'})
    map: string;
}