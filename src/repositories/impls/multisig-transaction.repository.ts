import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ENTITIES_CONFIG } from "../../module.config";
import { ObjectLiteral, Repository } from "typeorm";
import { IMultisigTransactionRepository } from "../imultisig-transaction.repository";
import { BaseRepository } from "./base.repository";
import { MultisigTransaction } from "../../entities";
import { TRANSACTION_STATUS } from "../../common";

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
        const status = TRANSACTION_STATUS.PENDING;
        let query = this.repos.createQueryBuilder('multisigTransaction')
            .where('multisigTransaction.status = :status', { status })
            .andWhere('multisigTransaction.txHash != \'\'')
            .andWhere('multisigTransaction.internalChainId = :internalChainId', { internalChainId })
            .limit(10)
            .select([
                'multisigTransaction.txHash as txHash'
            ]);
        let res = await query.getRawMany();
        return res;
    }

    async updateMultisigTransactionsByHashes(data: any, internalChainId: number) {
        await this.repos.createQueryBuilder('multisigTransaction')
            .update(MultisigTransaction)
            .set({ status: data.code === 0 ? TRANSACTION_STATUS.SUCCESS : TRANSACTION_STATUS.FAILED })
            .where({ txHash: data.txHash })
            .andWhere('InternalChainId = :internalChainId', { internalChainId })
            .execute();
    }
}