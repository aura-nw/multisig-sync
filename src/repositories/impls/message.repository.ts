import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { IMessageRepository } from '../imessage.repository';
@Injectable()
export class MessageRepository
    extends BaseRepository
    implements IMessageRepository
{
    private readonly _logger = new Logger(MessageRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.MESSAGE)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async insertBulkMessage(listTxMessages: any[]) {
        listTxMessages = listTxMessages.filter(
            (txMessage) => txMessage.auraTxId !== 0,
        );
        console.log(listTxMessages);
        if (listTxMessages.length <= 0) return;
        let query = `INSERT IGNORE INTO Message(CreatedAt, UpdatedAt, Id, TxId, AuraTxId, TypeUrl, FromAddress, ToAddress, Amount, DelegatorAddress, ValidatorAddress, ValidatorSrcAddress, ValidatorDstAddress) VALUES`;
        listTxMessages.map((tm) => {
            query += ` (DEFAULT, DEFAULT, DEFAULT, ${null}, ${tm.auraTxId}, '${
                tm.typeUrl
            }', '${tm.fromAddress}', '${tm.toAddress}', ${
                tm.amount
            }, ${null}, ${null}, ${null}, ${null}),`;
        });
        // console.log(query);
        query = query.substring(0, query.length - 1) + ';';
        return await this.repos.query(query);
    }
}
