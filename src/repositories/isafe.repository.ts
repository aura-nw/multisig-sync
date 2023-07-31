import { SafeInfo } from 'src/dtos/responses/get-safe-by-chain.response';
import { IBaseRepository } from './ibase.repository';

export interface ISafeRepository extends IBaseRepository {
  checkExistsSafeAddress(listAddress: string[]);

  findSafeNotInListAddress(listAddress: string[]);

  findSafeByInternalChainId(
    internalChainId: string,
    lastSafeId?: number,
  ): Promise<SafeInfo[]>;
}
