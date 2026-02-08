import request from 'supertest';
import { DataSource } from 'typeorm';
import { createApp } from '../app';
import { createDataSource, initializeDatabase } from '../config/database';

describe('Health Endpoint', () => {
  let dataSource: DataSource;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    dataSource = createDataSource({ database: ':memory:' });
    await initializeDatabase(dataSource);
    app = createApp(dataSource);
  });

  afterAll(async () => {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('GET /health should return 200 with status ok', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { status: 'ok' },
      error: null,
    });
  });

  it('should have foreign keys enabled', async () => {
    const result = await dataSource.query('PRAGMA foreign_keys');
    expect(result[0].foreign_keys).toBe(1);
  });
});
