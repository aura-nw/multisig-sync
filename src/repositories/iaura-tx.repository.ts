import { IBaseRepository } from './ibase.repository';

export interface IAuraTransactionRepository extends IBaseRepository {
  /**
   * Get the latest block height that store transaction of the given address
   */
  getLatestBlockHeight(chainId: number);

  /**
   * Insert Transactions that was lost when service died
   * @param listTransations
   */
  insertBulkTransaction(listTransations: any[]);
}
