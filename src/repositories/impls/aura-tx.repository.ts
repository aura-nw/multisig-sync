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
  }
}
