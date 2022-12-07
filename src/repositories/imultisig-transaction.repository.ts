import { AuraTx } from "src/entities";
import { IBaseRepository } from "./ibase.repository";

export interface IMultisigTransactionRepository extends IBaseRepository {
    findPendingMultisigTransaction(internalChainId: number): any;

    updateMultisigTransactionsByHashes(data: any, internalChainId: number);

    updateMultisigTxStatusByAuraTx(auraTxs: AuraTx[]): Promise<number>
}