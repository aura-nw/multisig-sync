import { ResponseDto } from "src/dtos/responses/response.dto";

export interface IMultisigTransactionRepository {
    findPendingMultisigTransaction(denom: string): any;
}