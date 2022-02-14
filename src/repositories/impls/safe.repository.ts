import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { ENTITIES_CONFIG } from 'src/module.config';
import { ISafeRepository } from '../isafe.repository';

@Injectable()
export class SafeRepository extends BaseRepository implements ISafeRepository {
    private readonly _logger = new Logger(SafeRepository.name);
    constructor(
        @InjectRepository(ENTITIES_CONFIG.SAFE)
        private readonly repos: Repository<ObjectLiteral>,
    ) {
        super(repos);
    }

    async checkExistsSafeAddress(listAddress: string[]) {
        let query = this.repos.createQueryBuilder('safe');
        query = query.where('safeAddress IN (:...listAddress)', {
            listAddress: listAddress,
        });
        let res = await query.getRawMany();
        return res;
    }

    async findSafeNotInListAddress(listAddress: string[]) {
        let query = this.repos.createQueryBuilder('safe');
        query = query
            .select('safe.safeAddress as safeAddress, safe.chainId as chainId')
            .where('safe.safeAddress NOT IN (:...listAddress)', {
                listAddress: listAddress,
            });
        let res = await query.getRawMany();
        return res;
    }

    async findSafeInListInternalChainId(listInternalChainId: string[]) {
        let query = this.repos.createQueryBuilder('safe');
        query = query
            .select('safe.safeAddress as safeAddress, safe.chainId as chainId')
            .where('safe.internalChainId IN (:...listInternalChainId)', {
                listInternalChainId: listInternalChainId,
            });
        let res = await query.getRawMany();
        return res;
    }
}
