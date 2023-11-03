import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { In, Not, Repository } from 'typeorm';
import { IMultisigTransactionRepository } from '../imultisig-transaction.repository';
import { BaseRepository } from './base.repository';
import { AuraTx, MultisigTransaction } from '../../entities';
import { TRANSACTION_STATUS } from '../../common';

@Injectable()
export class MultisigTransactionRepository
  extends BaseRepository
  implements IMultisigTransactionRepository {
  private readonly _logger = new Logger(MultisigTransactionRepository.name);
  constructor(
    @InjectRepository(ENTITIES_CONFIG.MULTISIG_TRANSACTION)
    private readonly repos: Repository<MultisigTransaction>,
  ) {
    super(repos);
  }

  async findPendingMultisigTransaction(
    internalChainId: number,
  ): Promise<any[]> {
    const result = await this.repos.find({
      where: {
        status: TRANSACTION_STATUS.PENDING,
        txHash: Not(''),
        internalChainId: internalChainId,
      },
      take: 10,
    });
    this._logger.debug(result);
    return result;
  }

  async updateMultisigTransactionsByHashes(data: any, internalChainId: number) {
    await this.repos
      .createQueryBuilder('multisigTransaction')
      .update(MultisigTransaction)
      .set({
        status:
          data.code === 0
            ? TRANSACTION_STATUS.SUCCESS
            : TRANSACTION_STATUS.FAILED,
      })
      .where({ txHash: data.txHash })
      .andWhere('InternalChainId = :internalChainId', { internalChainId })
      .execute();
  }

  async updateMultisigTxStatusByAuraTx(auraTxs: AuraTx[]): Promise<number> {
    const successTxAddrs = [];
    const failTxAddrs = [];
    auraTxs.forEach((auraTx) => {
      String(auraTx.code) === '0'
        ? successTxAddrs.push(auraTx.txHash)
        : failTxAddrs.push(auraTx.txHash);
    });

    const result = await Promise.all([
      this.repos.update(
        {
          txHash: In(successTxAddrs),
        },
        { status: TRANSACTION_STATUS.SUCCESS },
      ),
      this.repos.update(
        {
          txHash: In(failTxAddrs),
        },
        { status: TRANSACTION_STATUS.FAILED },
      ),
    ]);

    return result.reduce((acc, cur) => acc + cur.affected, 0);
  }
}
