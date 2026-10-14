import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInstallSteps1791956603819 implements MigrationInterface {
  name = 'CreateInstallSteps1791956603819';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "install_steps" ("name" character varying(200) NOT NULL, "applied_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_install_steps" PRIMARY KEY ("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "install_steps"`);
  }
}
