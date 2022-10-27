import { IBaseRepository } from './ibase.repository';

export interface IMessageRepository extends IBaseRepository {
    /**
     * Insert TxMessages corresponding to a Tx
     * @param listTxMessages
     */
    insertBulkTransaction(listTxMessages: any[]);
}
