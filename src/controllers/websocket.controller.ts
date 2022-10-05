import { Body, Controller, Inject, Post } from '@nestjs/common';
import { MODULE_REQUEST, SERVICE_INTERFACE } from 'src/module.config';
import { ISyncWebsocketService } from 'src/services/isync-websocket.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller('websocket')
@ApiTags('websocket')
export class AppController {
    constructor(
        @Inject(SERVICE_INTERFACE.ISYNC_WEBSOCKET_SERVICE)
        private readonly syncWebsocketService: ISyncWebsocketService,
    ) {}
}
