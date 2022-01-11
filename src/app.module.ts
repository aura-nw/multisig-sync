import { Global, Module } from '@nestjs/common';
import { ENTITIES_CONFIG, REPOSITORY_INTERFACE, SERVICE_INTERFACE } from './module.config';
import { SyncWebsocketService } from './services/impls/sync-websocket.service';
import { SharedModule } from './shared/shared.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './shared/services/config.service';
import { AuraTxRepository } from './repositories/impls/aura-tx.repository';
import { SafeRepository } from './repositories/impls/safe.repository';
import { ChainRepository } from './repositories/impls/chain.repository';
const entities = [
    ENTITIES_CONFIG.AURA_TX,
    ENTITIES_CONFIG.SAFE,
    ENTITIES_CONFIG.CHAIN
];
// @Global()
@Module({
    imports: [
        SharedModule,
        TypeOrmModule.forRootAsync({
            imports: [SharedModule, AppModule],
            useFactory: (configService: ConfigService) => configService.typeOrmConfig,
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([...entities]),
    ],
    controllers: [],
    providers: [
        {
            provide: SERVICE_INTERFACE.ISYNC_WEBSOCKET_SERVICE,
            useClass: SyncWebsocketService
        },
        {
            provide: REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY,
            useClass: AuraTxRepository
        },
        {
            provide: REPOSITORY_INTERFACE.ISAFE_REPOSITORY,
            useClass: SafeRepository
        },
        {
            provide: REPOSITORY_INTERFACE.ICHAIN_REPOSITORY,
            useClass: ChainRepository
        }
    ],
})
export class AppModule { }
