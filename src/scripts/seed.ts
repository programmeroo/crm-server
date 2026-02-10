import 'reflect-metadata';
import { createDataSource, initializeDatabase } from '../config/database';
import { AuthService } from '../services/AuthService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';
import { logger } from '../config/logger';

async function seed(): Promise<void> {
  const dataSource = createDataSource({ synchronize: true });
  await initializeDatabase(dataSource);

  const authService = new AuthService(dataSource);
  const workspaceService = new WorkspaceService(dataSource);
  const contactService = new ContactService(dataSource);

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

  // Create Workspaces for Andy
  const andy = await (dataSource.getRepository('users') as any).findOne({ where: { email: 'andy@picrm.local' } });
  if (andy) {
    try {
      const ws1 = await workspaceService.create(andy.id, 'Loan Factory');
      const ws2 = await workspaceService.create(andy.id, 'MaiStory');

      logger.info('Created workspaces for Andy');

      // Create some contacts
      await contactService.create(andy.id, {
        workspaceId: ws1.id,
        firstName: 'John',
        lastName: 'Doe',
        primaryEmail: 'john@loanfactory.com',
        company: 'Loan Factory Inc'
      });

      await contactService.create(andy.id, {
        workspaceId: ws2.id,
        firstName: 'Jane',
        lastName: 'Smith',
        primaryEmail: 'jane@maistory.com',
        company: 'MaiStory Productions'
      });

      // Unassigned contact
      await contactService.create(andy.id, {
        firstName: 'Michael',
        lastName: 'Brown',
        primaryEmail: 'michael@external.com'
      });

      logger.info('Created contacts for Andy');
    } catch (err) {
      logger.info('Workspaces or contacts already exist');
    }
  }

  logger.info('Seed complete');
  await dataSource.destroy();
}

seed().catch((err) => {
  logger.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
