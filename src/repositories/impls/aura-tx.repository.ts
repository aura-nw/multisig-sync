import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { In, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { IAuraTransactionRepository } from '../iaura-tx.repository';
import { AuraTx } from '../../entities';
@Injectable()
export class AuraTxRepository
  extends BaseRepository
  implements IAuraTransactionRepository
{
  constructor(
    @InjectRepository(ENTITIES_CONFIG.AURA_TX)
    private readonly repos: Repository<AuraTx>,
  ) {
    super(repos);
  }

  async getLatestBlockHeight(chainId: number) {
    const query = this.repos
      .createQueryBuilder('auraTx')
      .select('auraTx.height as height')
      .where('internalChainId = :chainId', { chainId })
      .orderBy('auraTx.id', 'DESC');
    const res = await query.getRawOne();
    if (res) {
      return res.height;
    }
    return 0;
  }

  async insertBulkTransaction(listTransations: AuraTx[]) {
    const txsHash = listTransations.map((tx) => tx.txHash);

    // find in auratx table
    const [existTxs] = await this.repos.findAndCount({
      where: {
        txHash: In(txsHash),
      },
    });
    const txs = listTransations.map((tx) => {
      return {
        ...tx,
        ...existTxs.find((t) => t.txHash === tx.txHash),
      };
    });
    console.log(txs);
    return this.repos.save(txs);

    // listTransations.map((auraTx) => {

    // })
    // let query = `INSERT IGNORE INTO AuraTx(CreatedAt, UpdatedAt, Id, Code, GasUsed, GasWanted, Fee, Height, RawLogs, FromAddress, ToAddress, Amount, RewardAmount, Denom, ContractAddress, TimeStamp, TxHash, InternalChainId) VALUES`;
    // for (const auraTx of listTransations) {
    //   query += ` (DEFAULT, DEFAULT, DEFAULT, ${auraTx.code}, ${
    //     auraTx.gasUsed
    //   }, ${auraTx.gasWanted}, ${
    //     auraTx.fee !== undefined ? auraTx.fee.toString() : null
    //   }, ${auraTx.height}, '${auraTx.rawLogs}', '${
    //     auraTx.fromAddress || ''
    //   }', '${auraTx.toAddress || ''}', ${auraTx.amount || null}, ${
    //     auraTx.rewardAmount || null
    //   }, '${auraTx.denom || ''}', '${auraTx.contractAddress}', FROM_UNIXTIME(${
    //     auraTx.timeStamp.valueOf() / 1000
    //   }), '${auraTx.txHash}', '${auraTx.internalChainId}'),`;
    // }
    // // console.log(query);
    // query = query.substring(0, query.length - 1) + ';';
    // return await this.repos.query(query);

    // return await this.repos.save(listTransations);
  }
}
