import 'reflect-metadata';
import 'dotenv/config';
import dataSource from './data-source';

async function migrate(): Promise<void> {
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });
    console.log(
      applied.length === 0
        ? 'No pending migrations.'
        : `Applied migrations: ${applied.map((migration) => migration.name).join(', ')}`,
    );
  } finally {
    await dataSource.destroy();
  }
}

migrate().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
