import { ResponseDto } from "src/dtos/responses/response.dto";
import { IBaseRepository } from "./ibase.repository";

export interface IMultisigTransactionRepository extends IBaseRepository {
    findPendingMultisigTransaction(internalChainId: number): any;

    updateMultisigTransactionsByHashes(data: any, internalChainId: number);
}