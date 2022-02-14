import { ResponseDto } from 'src/dtos/responses/response.dto';
import { MODULE_REQUEST } from 'src/module.config';

export interface ISyncWebsocketService {
    addNewAddressOnNetwork(
        request: MODULE_REQUEST.SubcribeNewAddressRequest,
    ): Promise<ResponseDto>;
}
