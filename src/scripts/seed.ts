import 'reflect-metadata';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { logger } from '../config/logger';

async function seed(): Promise<void> {
  const dataSource = createDataSource({ synchronize: true });
  await initializeDatabase(dataSource);

  const authService = new AuthService(dataSource);

  const users = [
    { email: 'andy@picrm.local', password: 'changeme', name: 'Andy' },
    { email: 'monalisa@picrm.local', password: 'changeme', name: 'Monalisa' },
  ];

  for (const u of users) {
    try {
      await authService.register(u.email, u.password, u.name);
      logger.info(`Created user: ${u.email}`);
    } catch {
      logger.info(`User already exists: ${u.email}`);
    }
  }

  logger.info('Seed complete');
  await dataSource.destroy();
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
