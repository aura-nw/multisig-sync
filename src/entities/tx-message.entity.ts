import { BaseEntityAutoId } from './base/base.entity';
import { Column, Entity } from 'typeorm';

@Entity({ name: 'Message' })
export class TxMessage extends BaseEntityAutoId {
  @Column({ name: 'TxId' })
  txId: number;

  @Column({ name: 'FromAddress', nullable: true })
  fromAddress: string;

  @Column({ name: 'ToAddress', nullable: true })
  toAddress: string;

  @Column({ name: 'Amount', nullable: true })
  amount: number;

  @Column({ name: 'Denom', nullable: true })
  denom: string;
}
