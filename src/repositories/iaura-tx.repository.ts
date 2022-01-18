import { IBaseRepository } from './ibase.repository';

export interface IAuraTransactionRepository extends IBaseRepository {
    /**
     * Get the latest block height that store transaction of the given address
     */
    getLatestBlockHeight(address: string);

    /**
     * Insert Transactions that was lost when service died
     * @param lostTransations 
     */
    insertLostTransaction(lostTransations: any);
}
