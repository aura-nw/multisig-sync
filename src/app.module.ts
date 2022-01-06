import { Module } from '@nestjs/common';
import { SERVICE_INTERFACE } from './module.config';
import { SyncWebsocketService } from './services/impls/sync-websocket.service';
import { SharedModule } from './shared/shared.module';
import { TypeOrmModule } from '@nestjs/typeorm';
const entities = [];

@Module({
    imports: [
        SharedModule,
        TypeOrmModule.forFeature([...entities]),
    ],
    controllers: [],
    providers: [
        {
            provide: SERVICE_INTERFACE.ISYNC_WEBSOCKET_SERVICE,
            useClass: SyncWebsocketService
        }
    ],
})
export class AppModule { }
