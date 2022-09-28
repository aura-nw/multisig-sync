import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { SyncTxProcessor } from './pending-tx.processor';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'pyxis-sync-tx',
        }),
    ],
    controllers: [],
    providers: [SyncTxProcessor],
})
export class SyncTxModule {}
