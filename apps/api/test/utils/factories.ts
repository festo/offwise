import type { DataSource } from 'typeorm';
import { PasswordService } from '../../src/modules/auth/password.service';
import { User } from '../../src/modules/users/entities/user.entity';

const passwords = new PasswordService();
let counter = 0;

/**
 * Inserts a user. Defaults: name `Test User`, a unique `user-<n>@example.test` email, role
 * `employee`, no password. `password` is hashed with PasswordService; `passwordHash` is stored as is.
 */
export async function createUser(
  dataSource: DataSource,
  overrides: Partial<User> & { password?: string } = {},
): Promise<User> {
  const { password, ...fields } = overrides;
  counter += 1;
  const repo = dataSource.getRepository(User);
  return repo.save(
    repo.create({
      name: 'Test User',
      email: `user-${counter}@example.test`,
      role: 'employee',
      passwordHash: password === undefined ? null : await passwords.hash(password),
      ...fields,
    }),
  );
}
