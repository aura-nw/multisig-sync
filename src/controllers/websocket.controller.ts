import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { MODULE_REQUEST, SERVICE_INTERFACE } from 'src/module.config';
import { ISyncWebsocketService } from 'src/services/isync-websocket.service';
import { ApiBadRequestResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

@Controller("Websocket")
@ApiTags("Websocket")
export class AppController {

    constructor(
        @Inject(SERVICE_INTERFACE.ISYNC_WEBSOCKET_SERVICE)private readonly syncWebsocketService: ISyncWebsocketService
    ) { }

    @Post("/subcribe-new-address")
    @ApiOperation({
        summary: 'Add new address on network need to be subcribed',
      })
    async addNewAddressOnNetwork(@Body() request: MODULE_REQUEST.SubcribeNewAddressRequest) {
        return this.syncWebsocketService.addNewAddressOnNetwork(request);
    }

}
