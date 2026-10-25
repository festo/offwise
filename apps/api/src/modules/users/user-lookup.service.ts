import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { User } from './entities/user.entity';

/**
 * Reads of active (not closed) users, shared by auth and user management. Pass the caller's
 * `EntityManager` to read inside its transaction.
 */
@Injectable()
export class UserLookupService {
  constructor(private readonly dataSource: DataSource) {}

  findActiveById(
    id: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<User | null> {
    return manager.getRepository(User).findOneBy({ id });
  }

  /** Case-insensitive, matching the `lower(email)` unique index on active users. */
  findActiveByEmail(
    email: string,
    manager: EntityManager = this.dataSource.manager,
  ): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder('user')
      .where('lower(user.email) = lower(:email)', { email })
      .getOne();
  }
}
