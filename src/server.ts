import { createApp } from './app';
import { createDataSource, initializeDatabase } from './config/database';
import { env } from './config/env';
import { logger } from './config/logger';
import fs from 'fs';
import path from 'path';

async function main(): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(env.dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dataSource = createDataSource();
  await initializeDatabase(dataSource);

  const app = createApp(dataSource);

  app.listen(env.port, () => {
    logger.info(`Pi-CRM server running on port ${env.port}`);
  });
}

main().catch((err) => {
  logger.error(`Failed to start server: ${err.message}`);
  process.exit(1);
});
