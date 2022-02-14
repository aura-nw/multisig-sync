import { IBaseRepository } from './ibase.repository';

export interface IChainRepository extends IBaseRepository {
    findChainByChainId(listChainId: string[]);
}
