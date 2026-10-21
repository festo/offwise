import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class CreateIdentity1792429690270 implements MigrationInterface {
  name = 'CreateIdentity1792429690270';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'PK_users',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'email', type: 'varchar', length: '254' },
          { name: 'name', type: 'varchar', length: '200' },
          { name: 'password_hash', type: 'text', isNullable: true },
          { name: 'role', type: 'varchar', length: '20', default: "'employee'" },
          { name: 'locale', type: 'varchar', length: '35', isNullable: true },
          { name: 'time_zone', type: 'varchar', length: '64', isNullable: true },
          { name: 'created_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
          { name: 'deleted_at', type: 'timestamptz', isNullable: true },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'audit_events',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'PK_audit_events',
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          { name: 'occurred_at', type: 'timestamptz', default: 'now()' },
          { name: 'actor_user_id', type: 'uuid', isNullable: true },
          { name: 'action', type: 'varchar', length: '100' },
          { name: 'entity_type', type: 'varchar', length: '50', isNullable: true },
          { name: 'entity_id', type: 'varchar', length: '100', isNullable: true },
          { name: 'before', type: 'jsonb', isNullable: true },
          { name: 'after', type: 'jsonb', isNullable: true },
        ],
        indices: [
          { name: 'IDX_audit_events_occurred_at', columnNames: ['occurred_at'] },
          { name: 'IDX_audit_events_actor_user_id', columnNames: ['actor_user_id'] },
          { name: 'IDX_audit_events_entity', columnNames: ['entity_type', 'entity_id'] },
        ],
        foreignKeys: [
          {
            name: 'FK_audit_events_actor_user',
            columnNames: ['actor_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'NO ACTION',
          },
        ],
      }),
    );

    await queryRunner.createTable(
      new Table({
        name: 'settings',
        columns: [
          {
            name: 'namespace',
            type: 'varchar',
            length: '100',
            isPrimary: true,
            primaryKeyConstraintName: 'PK_settings',
          },
          { name: 'value', type: 'jsonb' },
          { name: 'updated_at', type: 'timestamptz', default: 'now()' },
          { name: 'updated_by_user_id', type: 'uuid', isNullable: true },
        ],
        foreignKeys: [
          {
            name: 'FK_settings_updated_by_user',
            columnNames: ['updated_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    // Raw SQL: the Table API cannot express an expression index (the entity declares it with
    // synchronize: false) or the append-only trigger.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "UQ_users_email_active" ON "users" (lower("email")) WHERE "deleted_at" IS NULL`,
    );
    await queryRunner.query(`CREATE FUNCTION audit_events_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$`);
    await queryRunner.query(
      `CREATE TRIGGER audit_events_append_only BEFORE UPDATE OR DELETE ON "audit_events" FOR EACH ROW EXECUTE FUNCTION audit_events_append_only()`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER audit_events_append_only ON "audit_events"`);
    await queryRunner.query(`DROP FUNCTION audit_events_append_only()`);
    await queryRunner.query(`DROP INDEX "UQ_users_email_active"`);
    // dropTable also drops the table's foreign keys and indices.
    await queryRunner.dropTable('settings');
    await queryRunner.dropTable('audit_events');
    await queryRunner.dropTable('users');
  }
}
