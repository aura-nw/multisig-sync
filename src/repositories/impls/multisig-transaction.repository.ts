import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ENTITIES_CONFIG } from "../../module.config";
import { ObjectLiteral, Repository } from "typeorm";
import { IMultisigTransactionRepository } from "../imultisig-transaction.repository";
import { BaseRepository } from "./base.repository";

@Injectable()
export class MultisigTransactionRepository extends BaseRepository implements IMultisigTransactionRepository {
    private readonly _logger = new Logger(MultisigTransactionRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.MULTISIG_TRANSACTION)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async findPendingMultisigTransaction(internalChainId: number): Promise<any> {
        const status = 'PENDING';
        let query = this.repos.createQueryBuilder('multisigTransaction')
            .where('multisigTransaction.status = :status', { status })
            .andWhere('multisigTransaction.txHash != \'\'')
            .andWhere('multisigTransaction.internalChainId = :internalChainId', { internalChainId })
            .select([
                'multisigTransaction.txHash as txHash'
            ]);
        let res = await query.getRawMany();
        return res;
    }

    async findMultisigTransactionsByHashes(listTxHashes: string[], internalChainId: number): Promise<any> {
        let query = this.repos.createQueryBuilder('multisigTransaction')
            .where('multisigTransaction.txHash IN (:...listTxHashes)', { listTxHashes })
            .andWhere('multisigTransaction.internalChainId = :internalChainId', { internalChainId })
            .select([
                'multisigTransaction.txHash as txHash',
                'multisigTransaction.status as status',
                'multisigTransaction.internalChainId as internalChainId'
            ]);
        let res = await query.getRawMany();
        return res;
    }
}