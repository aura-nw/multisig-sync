import { IBaseRepository } from './ibase.repository';

export interface ITxMessageRepository extends IBaseRepository {
    /**
     * Insert TxMessages corresponding to a Tx
     * @param listTxMessages
     */
    insertBulkTransaction(listTxMessages: any[]);
}
