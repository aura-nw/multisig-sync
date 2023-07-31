import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
import { ObjectLiteral, Repository } from 'typeorm';
import { ITransactionHistoryRepository } from '../itx-history.repository';
import { BaseRepository } from './base.repository';

@Injectable()
export class TransactionHistoryRepository
  extends BaseRepository
  implements ITransactionHistoryRepository
{
  private readonly _logger = new Logger(TransactionHistoryRepository.name);
  constructor(
    @InjectRepository(ENTITIES_CONFIG.TX_HISTORY)
    private readonly repos: Repository<ObjectLiteral>,
  ) {
    super(repos);
    this._logger.log(
      '============== Constructor Transaction History Repository ==============',
    );
  }
}
