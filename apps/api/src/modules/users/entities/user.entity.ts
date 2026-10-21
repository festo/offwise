import { USER_EMAIL_MAX_LENGTH, USER_NAME_MAX_LENGTH, type Role } from '@offwise/shared';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'users' })
// Unique on lower(email) WHERE deleted_at IS NULL; created by hand in the CreateIdentity migration.
@Index('UQ_users_email_active', { synchronize: false })
export class User {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_users' })
  id!: string;

  @Column({ type: 'varchar', length: USER_EMAIL_MAX_LENGTH })
  email!: string;

  @Column({ type: 'varchar', length: USER_NAME_MAX_LENGTH })
  name!: string;

  @Column({ type: 'text', nullable: true })
  passwordHash!: string | null;

  // Allowed values are enforced in code (ROLES); the column is plain varchar, no DB enum.
  @Column({ type: 'varchar', length: 20, default: 'employee' })
  role!: Role;

  @Column({ type: 'varchar', length: 35, nullable: true })
  locale!: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  timeZone!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt!: Date | null;
}
