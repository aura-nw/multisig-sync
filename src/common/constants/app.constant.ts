export enum AppConstants {}

export enum ORDER_BY {
    DESC = 'DESC',
    ASC = 'ASC',
}
export enum DATABASE_TYPE {
    POSTGRES = 'postgres',
    MYSQL = 'mysql',
}

export enum MESSAGE_ACTION {
    MSG_SEND = '/cosmos.bank.v1beta1.MsgSend',
    MSG_MULTI_SEND = '/cosmos.bank.v1beta1.MsgMultiSend',
    MSG_INSTANTIATE_CONTRACT = '/cosmwasm.wasm.v1.MsgInstantiateContract',
    MSG_EXECUTE_CONTRACT = '/cosmwasm.wasm.v1.MsgExecuteContract',
    MSG_STORE_CODE = '/cosmwasm.wasm.v1.MsgStoreCode',
    MSG_DELEGATE = '/cosmos.staking.v1beta1.MsgDelegate',
    MSG_REDELEGATE = '/cosmos.staking.v1beta1.MsgBeginRedelegate',
    MSG_UNDELEGATE = '/cosmos.staking.v1beta1.MsgUndelegate',
    MSG_WITHDRAW_REWARDS = '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
    MSG_VOTE = '/cosmos.gov.v1beta1.MsgVote',
    EXECUTE_CONTRACT = '/cosmwasm.wasm.v1.MsgExecuteContract',
    IBC_TRANSFER = '/ibc.applications.transfer.v1.MsgTransfer',
    IBC_RECEIVE = '/ibc.core.channel.v1.MsgRecvPacket',
}

export enum CONST_CHAR {
    COIN_RECEIVED = 'coin_received',
    COIN_SPENT = 'coin_spent',
    SPENDER = 'spender',
    AMOUNT = 'amount',
    WITHDRAW_REWARDS = 'withdraw_rewards',
    VALIDATOR = 'validator',
}

export enum TRANSACTION_STATUS {
    AWAITING_CONFIRMATIONS = 'AWAITING_CONFIRMATIONS',
    AWAITING_EXECUTION = 'AWAITING_EXECUTION',
    PENDING = 'PENDING',
    CANCELLED = 'CANCELLED',
    SUCCESS = 'SUCCESS',
    FAILED = 'FAILED',
}
