import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
import { IChainRepository } from '../ichain.repository';

@Injectable()
export class ChainRepository
    extends BaseRepository
    implements IChainRepository {
    private readonly _logger = new Logger(ChainRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.CHAIN)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }
}
