import { Global, Module } from '@nestjs/common';
import {
    ENTITIES_CONFIG,
    REPOSITORY_INTERFACE,
    SERVICE_INTERFACE,
} from './module.config';
import { SyncWebsocketService } from './services/impls/sync-websocket.service';
import { SharedModule } from './shared/shared.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './shared/services/config.service';
import { AuraTxRepository } from './repositories/impls/aura-tx.repository';
import { SafeRepository } from './repositories/impls/safe.repository';
import { ChainRepository } from './repositories/impls/chain.repository';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncRestService } from './services/impls/sync-rest.service';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './controllers/websocket.controller';
import { MultisigTransactionRepository } from './repositories/impls/multisig-transaction.repository';
import { MessageRepository } from './repositories/impls/message.repository';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { SyncRestProcessor } from './processors/sync-rest.processor';
const entities = [
    ENTITIES_CONFIG.AURA_TX,
    ENTITIES_CONFIG.SAFE,
    ENTITIES_CONFIG.CHAIN,
    ENTITIES_CONFIG.MULTISIG_TRANSACTION,
    ENTITIES_CONFIG.MESSAGE
];
const controllers = [AppController];
const processors = [SyncRestProcessor];
// @Global()
@Module({
    imports: [
        ConfigModule.forRoot(),
        SharedModule,
        TypeOrmModule.forRootAsync({
            imports: [SharedModule, AppModule],
            useFactory: (configService: ConfigService) =>
                configService.typeOrmConfig,
            inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([...entities]),
        ScheduleModule.forRoot(),
        HttpModule,
        BullModule.forRoot({
            redis: {
                host: process.env.REDIS_HOST,
                port: process.env.REDIS_PORT,
                username: process.env.REDIS_USERNAME,
                db: parseInt(process.env.REDIS_DB, 10),
            },
            prefix: 'pyxis-safe-sync',
            defaultJobOptions: {
                removeOnComplete: true,
            }
        }),
        BullModule.registerQueue({
            name: 'sync-rest'
        }),
    ],
    exports: [
        BullModule,
        ...processors,
    ],
    controllers: [...controllers],
    providers: [
        // services
        {
            provide: SERVICE_INTERFACE.ISYNC_WEBSOCKET_SERVICE,
            useClass: SyncWebsocketService,
        },
        {
            provide: SERVICE_INTERFACE.ISYNC_REST_SERVICE,
            useClass: SyncRestService,
        },
        // repositories
        {
            provide: REPOSITORY_INTERFACE.IAURA_TX_REPOSITORY,
            useClass: AuraTxRepository,
        },
        {
            provide: REPOSITORY_INTERFACE.ISAFE_REPOSITORY,
            useClass: SafeRepository,
        },
        {
            provide: REPOSITORY_INTERFACE.ICHAIN_REPOSITORY,
            useClass: ChainRepository,
        },
        {
            provide: REPOSITORY_INTERFACE.IMULTISIG_TRANSACTION_REPOSITORY,
            useClass: MultisigTransactionRepository,
        },
        {
            provide: REPOSITORY_INTERFACE.IMESSAGE_REPOSITORY,
            useClass: MessageRepository,
        },
        // processors
        ...processors,
    ],
})
export class AppModule { }
