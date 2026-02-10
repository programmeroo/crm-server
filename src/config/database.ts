import { DataSource, DataSourceOptions } from 'typeorm';
import { env } from './env';
import { logger } from './logger';
import path from 'path';

function getDataSourceOptions(overrides?: Partial<DataSourceOptions>): DataSourceOptions {
  const baseOptions: DataSourceOptions = {
    type: 'sqlite',
    database: env.isTest ? ':memory:' : env.dbPath,
    entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
    migrations: [path.join(__dirname, '..', 'migrations', '*.{ts,js}')],
    synchronize: true, // Temporarily enabled to create custom fields tables
    logging: false,
  };

  return { ...baseOptions, ...overrides } as DataSourceOptions;
}

export function createDataSource(overrides?: Partial<DataSourceOptions>): DataSource {
  return new DataSource(getDataSourceOptions(overrides));
}

export async function initializeDatabase(dataSource: DataSource): Promise<DataSource> {
  await dataSource.initialize();
  await dataSource.query('PRAGMA foreign_keys = ON');
  logger.info('Database connected (foreign keys enabled)');
  return dataSource;
}
