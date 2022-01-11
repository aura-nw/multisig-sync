import { IBaseRepository } from './ibase.repository';

export interface ISafeRepository extends IBaseRepository {
    checkExistsSafeAddress(listAddress: string[]);
}
