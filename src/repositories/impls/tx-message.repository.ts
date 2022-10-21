import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { ITxMessageRepository } from '../itx-message.repository';
@Injectable()
export class TxMessageRepository
    extends BaseRepository
    implements ITxMessageRepository
{
    private readonly _logger = new Logger(TxMessageRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.TX_MESSAGE)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async insertBulkTransaction(listTxMessages: any[]) {
        console.log(listTxMessages);
        let query = `INSERT IGNORE INTO TxMessage(CreatedAt, UpdatedAt, Id, TxId, FromAddress, ToAddress, Amount, Denom) VALUES`;
        listTxMessages.map(txMessage => txMessage.filter(tm => tm.txId !== 0).map(tm => {
            query += ` (DEFAULT, DEFAULT, DEFAULT, ${tm.txId}, '${tm.fromAddress}', '${tm.toAddress}', ${tm.amount}, '${tm.denom}'),`;
        }));
        // console.log(query);
        query = query.substring(0, query.length - 1) + ';';
        return await this.repos.query(query);
    }
}
