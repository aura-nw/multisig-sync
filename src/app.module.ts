/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import {
  ENTITIES_CONFIG,
  REPOSITORY_INTERFACE,
  SERVICE_INTERFACE,
} from './module.config';
import { SharedModule } from './shared/shared.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from './shared/services/config.service';
import { AuraTxRepository } from './repositories/impls/aura-tx.repository';
import { SafeRepository } from './repositories/impls/safe.repository';
import { ChainRepository } from './repositories/impls/chain.repository';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncRestService } from './services/impls/sync-rest.service';
import { HttpModule } from '@nestjs/axios';
import { MultisigTransactionRepository } from './repositories/impls/multisig-transaction.repository';
import { MessageRepository } from './repositories/impls/message.repository';
import { BullModule } from '@nestjs/bull';
import { ConfigModule } from '@nestjs/config';
import { SyncRestProcessor } from './processors/sync-rest.processor';
import { RedisService } from './shared/services/redis.service';
import { CommonService } from './shared/services/common.service';
import { TransactionHistoryRepository } from './repositories/impls/tx-history.repository';
const entities = [
  ENTITIES_CONFIG.AURA_TX,
  ENTITIES_CONFIG.SAFE,
  ENTITIES_CONFIG.CHAIN,
  ENTITIES_CONFIG.MULTISIG_TRANSACTION,
  ENTITIES_CONFIG.MESSAGE,
  ENTITIES_CONFIG.TX_HISTORY,
];
const controllers = [];
const processors = [SyncRestProcessor];

@Module({
  imports: [
    ConfigModule.forRoot(),
    SharedModule,
    TypeOrmModule.forRootAsync({
      imports: [SharedModule, AppModule],
      useFactory: (configService: ConfigService) => configService.typeOrmConfig,
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([...entities]),
    ScheduleModule.forRoot(),
    HttpModule,
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        username: process.env.REDIS_USERNAME,
        db: parseInt(process.env.REDIS_DB, 10),
      },
      prefix: `pyxis-safe-sync-${JSON.parse(process.env.CHAIN_SUBCRIBE)[0]}`,
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 3,
      },
    }),
    BullModule.registerQueue({
      name: 'sync-rest',
    }),
    RedisService,
  ],
  exports: [BullModule, ...processors],
  controllers: [...controllers],
  providers: [
    // services
    {
      provide: SERVICE_INTERFACE.ISYNC_REST_SERVICE,
      useClass: SyncRestService,
    },
    RedisService,
    CommonService,
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
    {
      provide: REPOSITORY_INTERFACE.ITX_HISTORY_REPOSITORY,
      useClass: TransactionHistoryRepository,
    },
    // processors
    ...processors,
  ],
})
export class AppModule {}
