import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../entities/AuditLog.entity';
import { logger } from '../config/logger';

interface LogActionParams {
  userId: number | null;
  action: string;
  entityType?: string;
  entityId?: number;
  details?: string;
  ipAddress?: string;
}

interface GetLogsParams {
  limit?: number;
  offset?: number;
  action?: string;
  entityType?: string;
  userId?: number;
}

export class AuditService {
  private repository: Repository<AuditLog>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(AuditLog);
  }

  async logAction(params: LogActionParams): Promise<AuditLog> {
    const log = this.repository.create({
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType || null,
      entity_id: params.entityId || null,
      details: params.details || null,
      ip_address: params.ipAddress || null,
    });

    const saved = await this.repository.save(log);
    logger.info(`Audit: ${params.action}`, {
      userId: params.userId,
      entityType: params.entityType,
      entityId: params.entityId,
    });
    return saved;
  }

  async getLogs(params: GetLogsParams): Promise<AuditLog[]> {
    const qb = this.repository.createQueryBuilder('audit')
      .orderBy('audit.timestamp', 'DESC')
      .take(params.limit || 20)
      .skip(params.offset || 0);

    if (params.action) {
      qb.andWhere('audit.action = :action', { action: params.action });
    }
    if (params.entityType) {
      qb.andWhere('audit.entity_type = :entityType', { entityType: params.entityType });
    }
    if (params.userId) {
      qb.andWhere('audit.user_id = :userId', { userId: params.userId });
    }

    return qb.getMany();
  }

  async getLogsByEntity(entityType: string, entityId: number): Promise<AuditLog[]> {
    return this.repository.find({
      where: { entity_type: entityType, entity_id: entityId },
      order: { timestamp: 'DESC' },
    });
  }

  async getLogsByUser(userId: number): Promise<AuditLog[]> {
    return this.repository.find({
      where: { user_id: userId },
      order: { timestamp: 'DESC' },
    });
  }

  async getLogsByAction(action: string): Promise<AuditLog[]> {
    return this.repository.find({
      where: { action },
      order: { timestamp: 'DESC' },
    });
  }
}
