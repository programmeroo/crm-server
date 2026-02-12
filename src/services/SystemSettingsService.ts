import { DataSource, Repository } from 'typeorm';
import { SystemSettings } from '../entities/SystemSettings.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

export class SystemSettingsService {
  private repository: Repository<SystemSettings>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(SystemSettings);
  }

  async getSetting(
    scope: 'global' | 'user' | 'workspace',
    scopeId: string | null,
    key: string
  ): Promise<any | null> {
    try {
      const query: any = { scope, setting_key: key };
      if (scopeId === null) {
        query.scope_id = null;
      } else {
        query.scope_id = scopeId;
      }

      const setting = await this.repository.findOne({
        where: query,
      });
      if (!setting) return null;
      return JSON.parse(setting.setting_value);
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error getting setting', { scope, scopeId, key, err });
      throw new AppError('DATABASE_ERROR', 'Failed to get setting', 500);
    }
  }

  async setSetting(
    scope: 'global' | 'user' | 'workspace',
    scopeId: string | null,
    key: string,
    value: any
  ): Promise<void> {
    try {
      const query: any = { scope, setting_key: key };
      if (scopeId === null) {
        query.scope_id = null;
      } else {
        query.scope_id = scopeId;
      }

      const existing = await this.repository.findOne({
        where: query,
      });

      const stringValue = JSON.stringify(value);

      if (existing) {
        await this.repository.update(existing.id, {
          setting_value: stringValue,
          updated_at: new Date().toISOString(),
        });
      } else {
        const setting = this.repository.create({
          scope,
          scope_id: scopeId,
          setting_key: key,
          setting_value: stringValue,
        });
        await this.repository.save(setting);
      }
      logger.info('Setting saved', { scope, scopeId, key });
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error setting value', { scope, scopeId, key, err });
      throw new AppError('DATABASE_ERROR', 'Failed to save setting', 500);
    }
  }

  async deleteSetting(
    scope: 'global' | 'user' | 'workspace',
    scopeId: string | null,
    key: string
  ): Promise<void> {
    try {
      const query: any = { scope, setting_key: key };
      if (scopeId === null) {
        query.scope_id = null;
      } else {
        query.scope_id = scopeId;
      }

      await this.repository.delete(query);
      logger.info('Setting deleted', { scope, scopeId, key });
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error deleting setting', { scope, scopeId, key, err });
      throw new AppError('DATABASE_ERROR', 'Failed to delete setting', 500);
    }
  }

  async getUserSettings(userId: number): Promise<Record<string, any>> {
    try {
      const settings = await this.repository.find({
        where: { scope: 'user', scope_id: userId.toString() },
      });
      const result: Record<string, any> = {};
      for (const setting of settings) {
        result[setting.setting_key] = JSON.parse(setting.setting_value);
      }
      return result;
    } catch (err) {
      logger.error('Error getting user settings', { userId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to get user settings', 500);
    }
  }

  async getWorkspaceSettings(workspaceId: number): Promise<Record<string, any>> {
    try {
      const settings = await this.repository.find({
        where: { scope: 'workspace', scope_id: workspaceId.toString() },
      });
      const result: Record<string, any> = {};
      for (const setting of settings) {
        result[setting.setting_key] = JSON.parse(setting.setting_value);
      }
      return result;
    } catch (err) {
      logger.error('Error getting workspace settings', { workspaceId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to get workspace settings', 500);
    }
  }
}
