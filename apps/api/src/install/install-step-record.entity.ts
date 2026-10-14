import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'install_steps' })
export class InstallStepRecord {
  @PrimaryColumn({ type: 'varchar', length: 200, primaryKeyConstraintName: 'PK_install_steps' })
  name!: string;

  @CreateDateColumn({ type: 'timestamptz' }) // -> applied_at via SnakeNamingStrategy
  appliedAt!: Date;
}
