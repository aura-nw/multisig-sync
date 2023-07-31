import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BaseRepository } from './base.repository';
import { ObjectLiteral, Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { ENTITIES_CONFIG } from '../../module.config';
import { ISafeRepository } from '../isafe.repository';
import { SafeInfo } from '../../dtos/responses/get-safe-by-chain.response';

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
    const res = await query.getRawMany();
    return res;
  }

  async findSafeNotInListAddress(listAddress: string[]) {
    let query = this.repos.createQueryBuilder('safe');
    query = query
      .select('safe.safeAddress as safeAddress, safe.chainId as chainId')
      .where('safe.safeAddress NOT IN (:...listAddress)', {
        listAddress: listAddress,
      });
    const res = await query.getRawMany();
    return res;
  }

  async findSafeByInternalChainId(
    internalChainId: string,
    lastSafeId?: number,
  ): Promise<SafeInfo[]> {
    const query = this.repos
      .createQueryBuilder()
      .select('safeAddress, id')
      .where('internalChainId = :internalChainId', {
        internalChainId,
      })
      .andWhere("safeAddress != ''")
      .orderBy('id', 'DESC');

    if (lastSafeId) query.andWhere('id > :lastSafeId', { lastSafeId });
    const res = await query.getRawMany();
    return plainToInstance(SafeInfo, res);
  }
}
