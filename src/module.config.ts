import { SubcribeNewAddressRequest } from './dtos/requests/websocket/subcribe-new-address.request';
import { Message, TransactionHistory } from './entities';
import { AuraTx } from './entities/aura-tx.entity';
import { Chain } from './entities/chain.entity';
import { MultisigTransaction } from './entities/multisig-transaction.entity';
import { Safe } from './entities/safe.entity';

export const ENTITIES_CONFIG = {
    AURA_TX: AuraTx,
    SAFE: Safe,
    CHAIN: Chain,
    MULTISIG_TRANSACTION: MultisigTransaction,
    MESSAGE: Message,
    TX_HISTORY: TransactionHistory,
};

export const SERVICE_INTERFACE = {
    ISYNC_WEBSOCKET_SERVICE: 'ISyncWebsocketService',
    ISYNC_REST_SERVICE: 'ISyncRestService',
};

export const REPOSITORY_INTERFACE = {
    IAURA_TX_REPOSITORY: 'IAuraTxRepository',
    ISAFE_REPOSITORY: 'ISafeRepository',
    ICHAIN_REPOSITORY: 'IChainRepository',
    IMULTISIG_TRANSACTION_REPOSITORY: 'IMultisigTransactionRepository',
    IMESSAGE_REPOSITORY: 'IMessageRepository',
    ITX_HISTORY_REPOSITORY: 'ITransactionHistoryRepository',
};

export const PROVIDER_INTERFACE = {};

export const REQUEST_CONFIG = {
    SUBCRIBE_NEW_ADDRESS: SubcribeNewAddressRequest,
};

export module MODULE_REQUEST {
    export abstract class SubcribeNewAddressRequest extends REQUEST_CONFIG.SUBCRIBE_NEW_ADDRESS {}
}
