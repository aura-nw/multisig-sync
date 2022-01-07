import { Module } from '@nestjs/common';
import { ENTITIES_CONFIG, REPOSITORY_INTERFACE, SERVICE_INTERFACE } from './module.config';
import { SyncWebsocketService } from './services/impls/sync-websocket.service';
import { SharedModule } from './shared/shared.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './shared/services/config.service';
import { AuraTxRepository } from './repositories/impls/aura-tx.repository';
const entities = [
    ENTITIES_CONFIG.AURA_TX
];

@Module({
    imports: [
        SharedModule,
        TypeOrmModule.forFeature([...entities]),
        TypeOrmModule.forRootAsync({
            imports: [SharedModule],
            useFactory: (configService: ConfigService) => configService.typeOrmConfig,
            inject: [ConfigService],
          }),
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
        }
    ],
})
export class AppModule { }
