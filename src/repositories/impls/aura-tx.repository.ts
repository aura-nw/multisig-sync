import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { IAuraTransactionRepository } from '../iaura-tx.repository';
@Injectable()
export class AuraTxRepository
    extends BaseRepository
    implements IAuraTransactionRepository
{
    private readonly _logger = new Logger(AuraTxRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.AURA_TX)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async getLatestBlockHeight(chainId: number) {
        let query = this.repos
            .createQueryBuilder('auraTx')
            .select('auraTx.height as height')
            .where('internalChainId = :chainId', { chainId })
            .orderBy('auraTx.id', 'DESC');
        let res = await query.getRawOne();
        if (res) {
            return res.height;
        }
        return 0;
    }

    async insertBulkTransaction(listTransations: any[]) {
        console.log(listTransations);
        let query = `INSERT IGNORE INTO AuraTx(CreatedAt, UpdatedAt, Id, Code, GasUsed, GasWanted, Fee, Height, RawLogs, FromAddress, ToAddress, Amount, RewardAmount, Denom, TimeStamp, TxHash, InternalChainId) VALUES`;
        for (let auraTx of listTransations) {
            query += ` (DEFAULT, DEFAULT, DEFAULT, ${auraTx.code}, ${auraTx.gasUsed}, ${auraTx.gasWanted}, ${auraTx.fee !== undefined ? auraTx.fee.toString() : null}, ${auraTx.height}, '${auraTx.rawLogs}', '${auraTx.fromAddress || ''}', '${auraTx.toAddress || ''}', ${auraTx.amount || null}, ${auraTx.rewardAmount || null}, '${auraTx.denom || ''}', FROM_UNIXTIME(${auraTx.timeStamp.valueOf()/1000}), '${auraTx.txHash}', '${auraTx.internalChainId}'),`;
        }
        // console.log(query);
        query = query.substring(0, query.length - 1) + ';';
        return await this.repos.query(query);
    }
}
