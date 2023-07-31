import { ApiProperty } from '@nestjs/swagger';

export class SubcribeNewAddressRequest {
  @ApiProperty()
  address: string;
  @ApiProperty()
  chainId: string;
}
