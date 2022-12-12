/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-this-alias */
/* eslint-disable @typescript-eslint/no-var-requires */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { REPOSITORY_INTERFACE } from '../../module.config';
import * as WebSocket from 'socket.io-client';
import { ISyncWebsocketService } from '../isync-websocket.service';
import { ConfigService } from '../../shared/services/config.service';
import { IChainRepository, ISafeRepository } from '../../repositories';
import { CommonService } from '../../shared/services/common.service';
const _ = require('lodash');

@Injectable()
export class SyncWebsocketService implements ISyncWebsocketService {
    private readonly _logger = new Logger(SyncWebsocketService.name);
    private chain: any = {};
    private chainIdSubscriber = '';
    private websocketSubscriber;

    constructor(
        private configService: ConfigService,
        private commonService: CommonService,
        @Inject(REPOSITORY_INTERFACE.ISAFE_REPOSITORY)
        private safeRepository: ISafeRepository,
        @Inject(REPOSITORY_INTERFACE.ICHAIN_REPOSITORY)
        private chainRepository: IChainRepository,
    ) {
        this._logger.log(
            '============== Constructor Sync Websocket Service ==============',
        );
        this.chainIdSubscriber = JSON.parse(
            this.configService.get('CHAIN_SUBCRIBE'),
        );
        this.websocketSubscriber = this.configService.get('WEBSOCKET_URL');
        this.startSyncWebsocket();
    }

    async startSyncWebsocket() {
        this._logger.log('syncFromNetwork');
        const websocketUrl = this.websocketSubscriber;
        const self = this;
        this.chain = await this.chainRepository.findChainByChainId(
            this.chainIdSubscriber,
        );
        if (this.chain.rest.slice(-1) !== '/')
            this.chain.rest = this.chain.rest + '/';
        const websocket = WebSocket.io(websocketUrl);
        websocket.on('connect', () => {
            console.log('Connected to websocket');
        });
        websocket.on('broadcast-safe-message', (data) => {
            self.handleMessage(data);
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
        try {
            const existSafes =
                await this.safeRepository.findSafeByInternalChainId(
                    this.chain.id,
                );
            const safes = _.keyBy(existSafes, 'safeAddress');

            await this.commonService.handleTransactions(
                listTx,
                safes,
                this.chain,
            );
        } catch (error) {
            this._logger.error(error);
        }
    }
}
