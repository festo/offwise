import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import type { AuditAction, AuditEntityType } from './audit-actions';

/** Append-only: a trigger created in the CreateIdentity migration rejects UPDATE and DELETE. */
@Entity({ name: 'audit_events' })
@Index('IDX_audit_events_entity', ['entityType', 'entityId'])
export class AuditEvent {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_audit_events' })
  id!: string;

  @Index('IDX_audit_events_occurred_at')
  @CreateDateColumn({ type: 'timestamptz' })
  occurredAt!: Date;

  @Index('IDX_audit_events_actor_user_id')
  @Column({ type: 'uuid', nullable: true })
  actorUserId!: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'actor_user_id', foreignKeyConstraintName: 'FK_audit_events_actor_user' })
  actor?: User | null;

  @Column({ type: 'varchar', length: 100 })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 50, nullable: true })
  entityType!: AuditEntityType | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  entityId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  before!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  after!: Record<string, unknown> | null;
}
