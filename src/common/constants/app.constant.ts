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
    MSG_INSTANTIATE_CONTRACT = '/cosmwasm.wasm.v1.MsgInstantiateContract',
    MSG_EXECUTE_CONTRACT = '/cosmwasm.wasm.v1.MsgExecuteContract',
    MSG_MIGRATE_CONTRACT = '/cosmwasm.wasm.v1.MsgMigrateContract',
    MSG_STORE_CODE = '/cosmwasm.wasm.v1.MsgStoreCode',
    DELEGATE = '/cosmos.staking.v1beta1.MsgDelegate',
    REDELEGATE = '/cosmos.staking.v1beta1.MsgBeginRedelegate',
    UNDELEGATE = '/cosmos.staking.v1beta1.MsgUndelegate',
    REWARD = '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
}
