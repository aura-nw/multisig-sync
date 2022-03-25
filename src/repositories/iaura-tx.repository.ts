import { AuraTx } from 'src/entities/aura-tx.entity';
import { IBaseRepository } from './ibase.repository';

export interface IAuraTransactionRepository extends IBaseRepository {
    /**
     * Get the latest block height that store transaction of the given address
     */
    getLatestBlockHeight(chainId: number);

    /**
     * Insert Transactions that was lost when service died
     * @param lostTransations
     */
    insertBulkTransaction(listTransations: any[]);
}
