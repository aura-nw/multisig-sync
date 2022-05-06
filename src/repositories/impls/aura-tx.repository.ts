import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
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
        let query = `
            INSERT IGNORE INTO AuraTx(CreatedAt, UpdatedAt, Id, Code, Data, GasUsed, GasWanted, Fee, Height, Info, Logs, RawLogs, FromAddress, ToAddress, Amount, Denom, TimeStamp, Tx, TxHash, InternalChainId) 
            VALUES`;
        for (let auraTx of listTransations) {
            query += `(DEFAULT, DEFAULT, DEFAULT, ${auraTx.code}, '${auraTx.data}', ${auraTx.gasUsed}, ${auraTx.gasWanted}, ${auraTx.fee !== undefined ? auraTx.fee.toString() : null}, ${auraTx.height}, '${auraTx.info}', '${auraTx.logs}', '${auraTx.rawLogs}', '${auraTx.fromAddress}', '${auraTx.toAddress}', ${auraTx.amount}, '${auraTx.denom}', ${auraTx.timeStamp}, '${auraTx.tx}', '${auraTx.txHash}', '${auraTx.chainId}'),`;
        }
        // console.log(query);
        query = query.substring(0, query.length - 1) + ';';
        return await this.repos.query(query);
    }
}
