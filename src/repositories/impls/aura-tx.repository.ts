import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
import { IAuraTransactionRepository } from '../iaura-tx.repository';

@Injectable()
export class AuraTxRepository
    extends BaseRepository
    implements IAuraTransactionRepository {
    private readonly _logger = new Logger(AuraTxRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.AURA_TX)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }
}
