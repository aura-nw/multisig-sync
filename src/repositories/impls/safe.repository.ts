import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
import { ISafeRepository } from '../isafe.repository';

@Injectable()
export class SafeRepository
    extends BaseRepository
    implements ISafeRepository {
    private readonly _logger = new Logger(SafeRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.SAFE)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async checkExistsSafeAddress(listAddress: string[]){
        let query = this.repos.createQueryBuilder('safe');
        query = query.where('safeAddress IN (:...listAddress)', { listAddress });
        let res = await query.getMany();
        return res;
    }
}
