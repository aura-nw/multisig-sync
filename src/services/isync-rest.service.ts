import { SafeInfo } from 'src/dtos/responses/get-safe-by-chain.response';

export interface ISyncRestService {
  findTxByHash();

  syncRest();

  syncFromNetwork(network: any, listSafes: SafeInfo[]);

  getLatestBlockHeight(chainId: number);

  updateMultisigTxStatus(listData: any);
}
