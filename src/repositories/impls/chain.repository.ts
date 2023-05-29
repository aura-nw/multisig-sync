import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from '../../module.config';
import { IChainRepository } from '../ichain.repository';
import { Chain } from 'src/entities';

@Injectable()
export class ChainRepository
    extends BaseRepository
    implements IChainRepository {
    private readonly _logger = new Logger(ChainRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.CHAIN)
        private readonly repos: Repository<Chain>,
    ) {
        super(repos);
    }

    async findChainByChainId(chainId: string) {
        const result = await this.repos.findOne({
            where: {
                chainId
            }
        })

        return result;
    }
}
