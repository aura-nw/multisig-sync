import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPOSITORY_INTERFACE } from '../../module.config';
import { StargateClient } from '@cosmjs/stargate';
import * as WebSocket from 'socket.io-client';
import * as axios from 'axios';
import { ISyncWebsocketService } from '../isync-websocket.service';
import { CONST_CHAR, MESSAGE_ACTION } from '../../common';
import { ConfigService } from '../../shared/services/config.service';
import {
    IAuraTransactionRepository,
    IChainRepository,
    ISafeRepository,
    ITxMessageRepository
} from '../../repositories';
import { AuraTx, TxMessage } from '../../entities';
@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private chain: any = {};
    private chainIdSubscriber = '';
    private websocketSubscriber;
    private listMessageAction = [
        MESSAGE_ACTION.MSG_EXECUTE_CONTRACT,
        MESSAGE_ACTION.MSG_INSTANTIATE_CONTRACT,
        MESSAGE_ACTION.MSG_MULTI_SEND,
        MESSAGE_ACTION.MSG_SEND,
        MESSAGE_ACTION.MSG_STORE_CODE,
    ];
    private listTx = [
        {
            "tx": {
                "body": {
                    "messages": [
                        {
                            "@type": "/cosmos.bank.v1beta1.MsgSend",
                            "from_address": "aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa",
                            "to_address": "aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9",
                            "amount": [
                                {
                                    "denom": "utaura",
                                    "amount": "1000000000"
                                }
                            ]
                        }
                    ],
                    "memo": "",
                    "timeout_height": "0",
                    "extension_options": [
                    ],
                    "non_critical_extension_options": [
                    ]
                },
                "auth_info": {
                    "signer_infos": [
                        {
                            "public_key": {
                                "@type": "/cosmos.crypto.secp256k1.PubKey",
                                "key": "A4veR43Br9oaixYMZXYaPfnUaVmdXAaBqGqb7Ujgqep2"
                            },
                            "mode_info": {
                                "single": {
                                    "mode": "SIGN_MODE_LEGACY_AMINO_JSON"
                                }
                            },
                            "sequence": "107"
                        }
                    ],
                    "fee": {
                        "amount": [
                            {
                                "denom": "utaura",
                                "amount": "217"
                            }
                        ],
                        "gas_limit": "86721",
                        "payer": "",
                        "granter": ""
                    }
                },
                "signatures": [
                    "95XFb+c9vhqL7Ma4fvZd8HqBzcvXAZSojqzNNM4Q3qIOxhvkUX384NLkyUby/mtQpCTXEMCJcG2M13St7mRycA=="
                ]
            },
            "tx_response": {
                "height": "2193707",
                "txhash": "D1C7AEE3B28965870682F936D52A2AF1B7D0F06A5B064094D77E884C6800C706",
                "codespace": "",
                "code": 0,
                "data": "0A1E0A1C2F636F736D6F732E62616E6B2E763162657461312E4D736753656E64",
                "raw_log": "[{\"events\":[{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"receiver\",\"value\":\"aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9\"},{\"key\":\"amount\",\"value\":\"1000000000utaura\"}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"spender\",\"value\":\"aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa\"},{\"key\":\"amount\",\"value\":\"1000000000utaura\"}]},{\"type\":\"message\",\"attributes\":[{\"key\":\"action\",\"value\":\"/cosmos.bank.v1beta1.MsgSend\"},{\"key\":\"sender\",\"value\":\"aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa\"},{\"key\":\"module\",\"value\":\"bank\"}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"recipient\",\"value\":\"aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9\"},{\"key\":\"sender\",\"value\":\"aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa\"},{\"key\":\"amount\",\"value\":\"1000000000utaura\"}]}]}]",
                "logs": [
                    {
                        "msg_index": 0,
                        "log": "",
                        "events": [
                            {
                                "type": "coin_received",
                                "attributes": [
                                    {
                                        "key": "receiver",
                                        "value": "aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000000utaura"
                                    }
                                ]
                            },
                            {
                                "type": "coin_spent",
                                "attributes": [
                                    {
                                        "key": "spender",
                                        "value": "aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000000utaura"
                                    }
                                ]
                            },
                            {
                                "type": "message",
                                "attributes": [
                                    {
                                        "key": "action",
                                        "value": "/cosmos.bank.v1beta1.MsgSend"
                                    },
                                    {
                                        "key": "sender",
                                        "value": "aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa"
                                    },
                                    {
                                        "key": "module",
                                        "value": "bank"
                                    }
                                ]
                            },
                            {
                                "type": "transfer",
                                "attributes": [
                                    {
                                        "key": "recipient",
                                        "value": "aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9"
                                    },
                                    {
                                        "key": "sender",
                                        "value": "aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000000utaura"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "info": "",
                "gas_wanted": "86721",
                "gas_used": "70958",
                "tx": {
                    "@type": "/cosmos.tx.v1beta1.Tx",
                    "body": {
                        "messages": [
                            {
                                "@type": "/cosmos.bank.v1beta1.MsgSend",
                                "from_address": "aura1t0l7tjhqvspw7lnsdr9l5t8fyqpuu3jm57ezqa",
                                "to_address": "aura136v0nmlv0saryev8wqz89w80edzdu3quzm0ve9",
                                "amount": [
                                    {
                                        "denom": "utaura",
                                        "amount": "1000000000"
                                    }
                                ]
                            }
                        ],
                        "memo": "",
                        "timeout_height": "0",
                        "extension_options": [
                        ],
                        "non_critical_extension_options": [
                        ]
                    },
                    "auth_info": {
                        "signer_infos": [
                            {
                                "public_key": {
                                    "@type": "/cosmos.crypto.secp256k1.PubKey",
                                    "key": "A4veR43Br9oaixYMZXYaPfnUaVmdXAaBqGqb7Ujgqep2"
                                },
                                "mode_info": {
                                    "single": {
                                        "mode": "SIGN_MODE_LEGACY_AMINO_JSON"
                                    }
                                },
                                "sequence": "107"
                            }
                        ],
                        "fee": {
                            "amount": [
                                {
                                    "denom": "utaura",
                                    "amount": "217"
                                }
                            ],
                            "gas_limit": "86721",
                            "payer": "",
                            "granter": ""
                        }
                    },
                    "signatures": [
                        "95XFb+c9vhqL7Ma4fvZd8HqBzcvXAZSojqzNNM4Q3qIOxhvkUX384NLkyUby/mtQpCTXEMCJcG2M13St7mRycA=="
                    ]
                },
                "timestamp": "2022-10-20T07:13:50Z",
                "events": [
                    {
                        "type": "coin_spent",
                        "attributes": [
                            {
                                "key": "c3BlbmRlcg==",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjE3dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_received",
                        "attributes": [
                            {
                                "key": "cmVjZWl2ZXI=",
                                "value": "YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjE3dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "transfer",
                        "attributes": [
                            {
                                "key": "cmVjaXBpZW50",
                                "value": "YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==",
                                "index": true
                            },
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjE3dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "ZmVl",
                                "value": "MjE3dXRhdXJh",
                                "index": true
                            },
                            {
                                "key": "ZmVlX3BheWVy",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "YWNjX3NlcQ==",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYS8xMDc=",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "c2lnbmF0dXJl",
                                "value": "OTVYRmIrYzl2aHFMN01hNGZ2WmQ4SHFCemN2WEFaU29qcXpOTk00UTNxSU94aHZrVVgzODROTGt5VWJ5L210UXBDVFhFTUNKY0cyTTEzU3Q3bVJ5Y0E9PQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "YWN0aW9u",
                                "value": "L2Nvc21vcy5iYW5rLnYxYmV0YTEuTXNnU2VuZA==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_spent",
                        "attributes": [
                            {
                                "key": "c3BlbmRlcg==",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_received",
                        "attributes": [
                            {
                                "key": "cmVjZWl2ZXI=",
                                "value": "YXVyYTEzNnYwbm1sdjBzYXJ5ZXY4d3F6ODl3ODBlZHpkdTNxdXptMHZlOQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "transfer",
                        "attributes": [
                            {
                                "key": "cmVjaXBpZW50",
                                "value": "YXVyYTEzNnYwbm1sdjBzYXJ5ZXY4d3F6ODl3ODBlZHpkdTNxdXptMHZlOQ==",
                                "index": true
                            },
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTF0MGw3dGpocXZzcHc3bG5zZHI5bDV0OGZ5cXB1dTNqbTU3ZXpxYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "bW9kdWxl",
                                "value": "YmFuaw==",
                                "index": true
                            }
                        ]
                    }
                ]
            }
        },
        {
            "tx": {
                "body": {
                    "messages": [
                        {
                            "@type": "/cosmos.bank.v1beta1.MsgSend",
                            "from_address": "aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8",
                            "to_address": "aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v",
                            "amount": [
                                {
                                    "denom": "utaura",
                                    "amount": "1000000"
                                }
                            ]
                        }
                    ],
                    "memo": "",
                    "timeout_height": "0",
                    "extension_options": [
                    ],
                    "non_critical_extension_options": [
                    ]
                },
                "auth_info": {
                    "signer_infos": [
                        {
                            "public_key": {
                                "@type": "/cosmos.crypto.secp256k1.PubKey",
                                "key": "AnoOQm4UTbzswwES5Mo+/LHFbT9653fDecq4Rrc+2jnA"
                            },
                            "mode_info": {
                                "single": {
                                    "mode": "SIGN_MODE_LEGACY_AMINO_JSON"
                                }
                            },
                            "sequence": "15"
                        }
                    ],
                    "fee": {
                        "amount": [
                            {
                                "denom": "utaura",
                                "amount": "245"
                            }
                        ],
                        "gas_limit": "97851",
                        "payer": "",
                        "granter": ""
                    }
                },
                "signatures": [
                    "OUFWAQwoYOWg98+h3uFuytY9NwPkgbxyjSvqlH1Cg9FZQUx+Fc+zMX9dnqVFwGh09TbufQIuE5hZw+7BLu9Qew=="
                ]
            },
            "tx_response": {
                "height": "2193973",
                "txhash": "2A0648027FD4D34B5FD70BE2D3EB7BA1F13C358D3132EEAF622009609EC3E8C0",
                "codespace": "",
                "code": 0,
                "data": "0A1E0A1C2F636F736D6F732E62616E6B2E763162657461312E4D736753656E64",
                "raw_log": "[{\"events\":[{\"type\":\"coin_received\",\"attributes\":[{\"key\":\"receiver\",\"value\":\"aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v\"},{\"key\":\"amount\",\"value\":\"1000000utaura\"}]},{\"type\":\"coin_spent\",\"attributes\":[{\"key\":\"spender\",\"value\":\"aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8\"},{\"key\":\"amount\",\"value\":\"1000000utaura\"}]},{\"type\":\"message\",\"attributes\":[{\"key\":\"action\",\"value\":\"/cosmos.bank.v1beta1.MsgSend\"},{\"key\":\"sender\",\"value\":\"aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8\"},{\"key\":\"module\",\"value\":\"bank\"}]},{\"type\":\"transfer\",\"attributes\":[{\"key\":\"recipient\",\"value\":\"aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v\"},{\"key\":\"sender\",\"value\":\"aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8\"},{\"key\":\"amount\",\"value\":\"1000000utaura\"}]}]}]",
                "logs": [
                    {
                        "msg_index": 0,
                        "log": "",
                        "events": [
                            {
                                "type": "coin_received",
                                "attributes": [
                                    {
                                        "key": "receiver",
                                        "value": "aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000utaura"
                                    }
                                ]
                            },
                            {
                                "type": "coin_spent",
                                "attributes": [
                                    {
                                        "key": "spender",
                                        "value": "aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000utaura"
                                    }
                                ]
                            },
                            {
                                "type": "message",
                                "attributes": [
                                    {
                                        "key": "action",
                                        "value": "/cosmos.bank.v1beta1.MsgSend"
                                    },
                                    {
                                        "key": "sender",
                                        "value": "aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8"
                                    },
                                    {
                                        "key": "module",
                                        "value": "bank"
                                    }
                                ]
                            },
                            {
                                "type": "transfer",
                                "attributes": [
                                    {
                                        "key": "recipient",
                                        "value": "aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v"
                                    },
                                    {
                                        "key": "sender",
                                        "value": "aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8"
                                    },
                                    {
                                        "key": "amount",
                                        "value": "1000000utaura"
                                    }
                                ]
                            }
                        ]
                    }
                ],
                "info": "",
                "gas_wanted": "97851",
                "gas_used": "79459",
                "tx": {
                    "@type": "/cosmos.tx.v1beta1.Tx",
                    "body": {
                        "messages": [
                            {
                                "@type": "/cosmos.bank.v1beta1.MsgSend",
                                "from_address": "aura1hctj3tpmucmuv02umf9252enjedkce7mml69k8",
                                "to_address": "aura1s97lavhc3rwp3p6lnm280f5qqnr3p03c5z3t2v",
                                "amount": [
                                    {
                                        "denom": "utaura",
                                        "amount": "1000000"
                                    }
                                ]
                            }
                        ],
                        "memo": "",
                        "timeout_height": "0",
                        "extension_options": [
                        ],
                        "non_critical_extension_options": [
                        ]
                    },
                    "auth_info": {
                        "signer_infos": [
                            {
                                "public_key": {
                                    "@type": "/cosmos.crypto.secp256k1.PubKey",
                                    "key": "AnoOQm4UTbzswwES5Mo+/LHFbT9653fDecq4Rrc+2jnA"
                                },
                                "mode_info": {
                                    "single": {
                                        "mode": "SIGN_MODE_LEGACY_AMINO_JSON"
                                    }
                                },
                                "sequence": "15"
                            }
                        ],
                        "fee": {
                            "amount": [
                                {
                                    "denom": "utaura",
                                    "amount": "245"
                                }
                            ],
                            "gas_limit": "97851",
                            "payer": "",
                            "granter": ""
                        }
                    },
                    "signatures": [
                        "OUFWAQwoYOWg98+h3uFuytY9NwPkgbxyjSvqlH1Cg9FZQUx+Fc+zMX9dnqVFwGh09TbufQIuE5hZw+7BLu9Qew=="
                    ]
                },
                "timestamp": "2022-10-20T07:31:50Z",
                "events": [
                    {
                        "type": "coin_spent",
                        "attributes": [
                            {
                                "key": "c3BlbmRlcg==",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjQ1dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_received",
                        "attributes": [
                            {
                                "key": "cmVjZWl2ZXI=",
                                "value": "YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjQ1dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "transfer",
                        "attributes": [
                            {
                                "key": "cmVjaXBpZW50",
                                "value": "YXVyYTE3eHBmdmFrbTJhbWc5NjJ5bHM2Zjg0ejNrZWxsOGM1bHQwNXpmeQ==",
                                "index": true
                            },
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MjQ1dXRhdXJh",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "ZmVl",
                                "value": "MjQ1dXRhdXJh",
                                "index": true
                            },
                            {
                                "key": "ZmVlX3BheWVy",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "YWNjX3NlcQ==",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOC8xNQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "tx",
                        "attributes": [
                            {
                                "key": "c2lnbmF0dXJl",
                                "value": "T1VGV0FRd29ZT1dnOTgraDN1RnV5dFk5TndQa2dieHlqU3ZxbEgxQ2c5RlpRVXgrRmMrek1YOWRucVZGd0doMDlUYnVmUUl1RTVoWncrN0JMdTlRZXc9PQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "YWN0aW9u",
                                "value": "L2Nvc21vcy5iYW5rLnYxYmV0YTEuTXNnU2VuZA==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_spent",
                        "attributes": [
                            {
                                "key": "c3BlbmRlcg==",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "coin_received",
                        "attributes": [
                            {
                                "key": "cmVjZWl2ZXI=",
                                "value": "YXVyYTFzOTdsYXZoYzNyd3AzcDZsbm0yODBmNXFxbnIzcDAzYzV6M3Qydg==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "transfer",
                        "attributes": [
                            {
                                "key": "cmVjaXBpZW50",
                                "value": "YXVyYTFzOTdsYXZoYzNyd3AzcDZsbm0yODBmNXFxbnIzcDAzYzV6M3Qydg==",
                                "index": true
                            },
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            },
                            {
                                "key": "YW1vdW50",
                                "value": "MTAwMDAwMHV0YXVyYQ==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "c2VuZGVy",
                                "value": "YXVyYTFoY3RqM3RwbXVjbXV2MDJ1bWY5MjUyZW5qZWRrY2U3bW1sNjlrOA==",
                                "index": true
                            }
                        ]
                    },
                    {
                        "type": "message",
                        "attributes": [
                            {
                                "key": "bW9kdWxl",
                                "value": "YmFuaw==",
                                "index": true
                            }
                        ]
                    }
                ]
            }
        }
    ];

    constructor(
        private configService: ConfigService,
        @Inject(REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY)
        private auraTxRepository: IAuraTransactionRepository,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
        @Inject(REPOSITORY_INTERFACE.ITX_MESSAGE_REPOSITORY)
        private txMessageRepository: ITxMessageRepository,
    ) {
        this._logger.log(
            '============== Constructor Sync Websocket Service ==============',
        );
        this.chainIdSubscriber = JSON.parse(this.configService.get('CHAIN_SUBCRIBE'));
        this.websocketSubscriber = this.configService.get('WEBSOCKET_URL');
        this.startSyncWebsocket();
    }

    async startSyncWebsocket() {
        this._logger.log('syncFromNetwork');
        let websocketUrl = this.websocketSubscriber;
        let self = this;
        this.chain = await this.chainRepository.findChainByChainId(this.chainIdSubscriber);
        if (this.chain.rest.slice(-1) !== '/') this.chain.rest = this.chain.rest + '/';
        let websocket = WebSocket.io(websocketUrl);
        websocket.on('connect', () => {
            console.log('Connected to websocket');
        });
        websocket.on('broadcast-safe-message', (data) => {
            self.handleMessage(data);
            // self.handleMessage(this.listTx);
        });
        websocket.on('error', (error) => {
            self._logger.error(error);
            websocket.close();
            process.exit(1);
        });
        websocket.on('close', () => {
            self._logger.log('closed');
            websocket.close();
            process.exit(1);
        });

        return websocket;
    }

    async handleMessage(listTx) {
        this._logger.log(listTx);
        let syncTxs: any[] = [], syncTxMessages: any[] = [];
        try {
            let existSafes = await this.safeRepository.findSafeByInternalChainId(this.chain.id);

            await Promise.all(listTx.map(async txs => {
                let listTxMessages: any[] = [];
                await Promise.all(txs.tx.body.messages.filter(msg =>
                    this.listMessageAction.includes(msg['@type']) && txs.tx_response.code === 0
                ).map(async (msg, index) => {
                    const type = msg['@type'];
                    let txMessage = new TxMessage();
                    switch (type) {
                        case MESSAGE_ACTION.MSG_SEND:
                            txMessage.fromAddress = msg.from_address;
                            txMessage.toAddress = msg.to_address;
                            txMessage.amount = parseInt(msg.amount[0].amount, 10);
                            txMessage.denom = msg.amount[0].denom;
                            listTxMessages.push(txMessage);
                            break;
                        case MESSAGE_ACTION.MSG_MULTI_SEND:
                            txMessage.fromAddress = msg.inputs[0].address;
                            msg.outputs.map(output => {
                                txMessage.toAddress = output.address;
                                txMessage.amount = parseInt(output.coins[0].amount, 10);
                                txMessage.denom = output.coins[0].denom;
                                listTxMessages.push(txMessage);
                            });
                            break;
                        case MESSAGE_ACTION.MSG_DELEGATE:
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.denom = msg.amount.denom;
                            let coin_received_delegate = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_delegate && coin_received_delegate.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_delegate.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_delegate[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = parseInt(claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward, 10);
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_REDELEGATE:
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.denom = msg.amount.denom;
                            let valSrcAddr = msg.validator_src_address;
                            let valDstAddr = msg.validator_dst_address;
                            let coin_received_redelegate = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_redelegate && coin_received_redelegate.find(x => x.value === msg.delegator_address)) {
                                const paramVal = this.configService.get('PARAM_GET_VALIDATOR') + valSrcAddr;
                                let resultVal: any = await axios.default.get(this.chain.rest + paramVal);
                                let redelegate_claimed_reward = coin_received_redelegate.find(x => x.key === CONST_CHAR.AMOUNT);
                                txMessage.amount = parseInt(redelegate_claimed_reward.value.match(/\d+/g)[0], 10);
                                if (Number(resultVal.data.validator.commission.commission_rates.rate) !== 1) {
                                    txMessage.fromAddress = valSrcAddr;
                                    listTxMessages.push(txMessage);
                                } else {
                                    txMessage.fromAddress = valDstAddr;
                                    listTxMessages.push(txMessage);
                                }
                                if (coin_received_redelegate.length > 2) {
                                    txMessage.fromAddress = valDstAddr;
                                    txMessage.amount = parseInt(coin_received_redelegate[3].value.match(/\d+/g)[0], 10);
                                    listTxMessages.push(txMessage);
                                }
                            }
                            break;
                        case MESSAGE_ACTION.MSG_UNDELEGATE:
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.denom = msg.amount.denom;
                            let coin_received_unbond = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_unbond && coin_received_unbond.find(x => x.value === msg.delegator_address)) {
                                const index_reward = coin_received_unbond.findIndex(x => x.value === msg.delegator_address);
                                const claimed_reward = coin_received_unbond[index_reward + 1].value.match(/\d+/g)[0];
                                txMessage.amount = parseInt(claimed_reward === '0' || index_reward < 0 ? '0' : claimed_reward, 10);
                                listTxMessages.push(txMessage);
                            }
                            break;
                        case MESSAGE_ACTION.MSG_WITHDRAW_REWARDS:
                            txMessage.fromAddress = msg.validator_address;
                            txMessage.toAddress = msg.delegator_address;
                            txMessage.denom = this.chain.denom;
                            let coin_received_claim = txs.tx_response.logs[index].events
                                .find(e => e.type === CONST_CHAR.COIN_RECEIVED).attributes;
                            if (coin_received_claim && coin_received_claim.find(x => x.value === msg.delegator_address)) {
                                txMessage.amount = parseInt(coin_received_claim.find(x => x.key = CONST_CHAR.AMOUNT)
                                    .value.match(/\d+/g)[0], 10);
                                listTxMessages.push(txMessage);
                            }
                            break;
                    }
                }));
                if (listTxMessages.length > 0) {
                    syncTxMessages.push(listTxMessages);
                    let auraTx = new AuraTx();
                    auraTx.txHash = txs.tx_response.txhash;
                    auraTx.height = parseInt(txs.tx_response.height, 10);
                    auraTx.code = txs.tx_response.code;
                    auraTx.gasWanted = parseInt(txs.tx_response.gas_wanted, 10);
                    auraTx.gasUsed = parseInt(txs.tx_response.gas_used, 10);
                    auraTx.fee = parseInt(txs.tx.auth_info.fee.amount[0].amount, 10);
                    auraTx.rawLogs = txs.tx_response.raw_log;
                    auraTx.timeStamp = new Date(txs.tx_response.timestamp);
                    auraTx.internalChainId = this.chain.id;
                    syncTxs.push(auraTx);
                }
            }));

            syncTxMessages.map((txMessage, index) => {
                let txMsg = txMessage.find(tm => existSafes.find(safe => safe.safeAddress === tm.toAddress
                    || safe.safeAddress === tm.fromAddress));
                if (!txMsg) syncTxs.splice(index, 1);
            });
            syncTxMessages = syncTxMessages.filter(txMessage =>
                txMessage.find(tm => existSafes.find(safe => safe.safeAddress === tm.toAddress
                    || safe.safeAddress === tm.fromAddress))
            );
            this._logger.log('WEBSOCKET Qualified Txs: ' + JSON.stringify(syncTxs));

            if (syncTxs.length > 0) {
                let txs = await this.auraTxRepository.insertBulkTransaction(syncTxs);
                let id = txs.insertId;
                syncTxMessages.map(txMessage => txMessage.map(tm => tm.txId = id++));
                await this.txMessageRepository.insertBulkTransaction(syncTxMessages);
            }
        } catch (error) {
            this._logger.error(error);
        }
    }

    async searchTxRest(txHash: string, rpc: string) {
        this._logger.log('Search in rest... txHash: ' + txHash);
        const client = await StargateClient.connect(rpc);
        return client.getTx(txHash);
    }
}
