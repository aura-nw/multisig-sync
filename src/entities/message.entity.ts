import { BaseEntityAutoId } from './base/base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'Message' })
export class Message extends BaseEntityAutoId {
    @Column({ name: 'TxId' })
    txId: number;

    @Column({ name: 'AuraTxId' })
    auraTxId: number;

    @Column({ name: 'TypeUrl' })
    typeUrl: string;

    @Column({ name: 'FromAddress' })
    fromAddress: string;

    @Column({ name: 'ToAddress' })
    toAddress: string;

    @Column({ name: 'Amount' })
    amount: string;

    @Column({ name: 'DelegatorAddress' })
    delegatorAddress: string;

    @Column({ name: 'ValidatorAddress' })
    validatorAddress: string;

    @Column({ name: 'ValidatorSrcAddress' })
    validatorSrcAddress: string;

    @Column({ name: 'ValidatorDstAddress' })
    validatorDstAddress: string;

    @Column({ name: 'ContractAddress' })
    contractAddress: string;

    @Column({ name: 'ContractFunction' })
    contractFunction: string;

    @Column({ name: 'ContractArgs' })
    contractArgs: string;
}
