import { DataSource, Repository } from 'typeorm';
import { Campaign } from '../entities/Campaign.entity';
import { CampaignApproval } from '../entities/CampaignApproval.entity';
import { Workspace } from '../entities/Workspace.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';

interface CreateCampaignData {
  workspaceId: number;
  name: string;
  type: 'one-off' | 'scheduled' | 'drip';
  templateId?: number | null;
  segment?: any;
  schedule?: any;
}

interface UpdateCampaignData {
  name?: string;
  type?: 'one-off' | 'scheduled' | 'drip';
  templateId?: number | null;
  segment?: any;
  schedule?: any;
}

export class CampaignService {
  private repository: Repository<Campaign>;
  private approvalRepository: Repository<CampaignApproval>;
  private workspaceRepository: Repository<Workspace>;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Campaign);
    this.approvalRepository = this.dataSource.getRepository(CampaignApproval);
    this.workspaceRepository = this.dataSource.getRepository(Workspace);
  }

  async create(data: CreateCampaignData): Promise<Campaign> {
    try {
      // Check if workspace exists and get its details
      const workspace = await this.workspaceRepository.findOne({
        where: { id: data.workspaceId },
      });

      if (!workspace) {
        throw new AppError('NOT_FOUND', 'Workspace not found', 404);
      }

      // Check for duplicate name within workspace
      const existing = await this.repository.findOne({
        where: {
          workspace_id: data.workspaceId,
          name: data.name,
        },
      });

      if (existing) {
        throw new AppError('DUPLICATE', 'A campaign with this name already exists in this workspace', 409);
      }

      // Determine if approval is needed (ONLY for "Loan Factory" workspace)
      const needsApproval = workspace.name === 'Loan Factory';
      const status = needsApproval ? 'pending' : 'draft';

      // Create campaign
      const campaign = this.repository.create({
        workspace_id: data.workspaceId,
        name: data.name,
        type: data.type,
        template_id: data.templateId || null,
        segment_json: data.segment ? JSON.stringify(data.segment) : null,
        schedule_json: data.schedule ? JSON.stringify(data.schedule) : null,
        status,
      });

      const saved = await this.repository.save(campaign);

      // Create approval record if needed
      if (needsApproval) {
        await this.approvalRepository.save({
          campaign_id: saved.id,
          status: 'pending',
        });
      }

      logger.info('Campaign created', { id: saved.id, workspaceId: data.workspaceId, name: data.name });
      return saved;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error creating campaign', err);
      throw new AppError('DATABASE_ERROR', 'Failed to create campaign', 500);
    }
  }

  async findById(id: number): Promise<Campaign | null> {
    try {
      return await this.repository.findOne({
        where: { id },
        relations: ['workspace', 'template', 'approval'],
      });
    } catch (err) {
      logger.error('Error finding campaign', err);
      return null;
    }
  }

  async listByWorkspace(workspaceId: number): Promise<Campaign[]> {
    try {
      return await this.repository.find({
        where: { workspace_id: workspaceId },
        relations: ['workspace', 'template', 'approval'],
        order: { created_at: 'DESC' },
      });
    } catch (err) {
      logger.error('Error listing campaigns', err);
      return [];
    }
  }

  async update(id: number, workspaceId: number, data: UpdateCampaignData): Promise<Campaign> {
    try {
      const campaign = await this.findById(id);

      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      if (campaign.workspace_id !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Campaign does not belong to this workspace', 403);
      }

      // Check for duplicate name if changing name
      if (data.name && data.name !== campaign.name) {
        const duplicate = await this.repository.findOne({
          where: {
            workspace_id: workspaceId,
            name: data.name,
          },
        });

        if (duplicate && duplicate.id !== id) {
          throw new AppError('DUPLICATE', 'A campaign with this name already exists', 409);
        }
      }

      // Update fields
      if (data.name !== undefined) campaign.name = data.name;
      if (data.type !== undefined) campaign.type = data.type;
      if (data.templateId !== undefined) campaign.template_id = data.templateId || null;
      if (data.segment !== undefined) campaign.segment_json = data.segment ? JSON.stringify(data.segment) : null;
      if (data.schedule !== undefined) campaign.schedule_json = data.schedule ? JSON.stringify(data.schedule) : null;
      campaign.updated_at = new Date().toISOString();

      const saved = await this.repository.save(campaign);
      logger.info('Campaign updated', { id });
      return saved;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error updating campaign', err);
      throw new AppError('DATABASE_ERROR', 'Failed to update campaign', 500);
    }
  }

  async delete(id: number, workspaceId: number): Promise<void> {
    try {
      const campaign = await this.findById(id);

      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      if (campaign.workspace_id !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Campaign does not belong to this workspace', 403);
      }

      // Soft delete by setting status to cancelled
      campaign.status = 'cancelled';
      await this.repository.save(campaign);
      logger.info('Campaign deleted', { id });
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error deleting campaign', err);
      throw new AppError('DATABASE_ERROR', 'Failed to delete campaign', 500);
    }
  }

  async approveCampaign(id: number, workspaceId: number, userId: number, notes?: string): Promise<Campaign> {
    try {
      const campaign = await this.findById(id);

      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      if (campaign.workspace_id !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Campaign does not belong to this workspace', 403);
      }

      // Update campaign status
      campaign.status = 'approved';
      campaign.updated_at = new Date().toISOString();
      await this.repository.save(campaign);

      // Update approval record
      if (campaign.approval) {
        campaign.approval.status = 'approved' as any;
        campaign.approval.reviewer_id = userId;
        campaign.approval.notes = notes || null;
        campaign.approval.reviewed_at = new Date().toISOString();
        await this.approvalRepository.save(campaign.approval);
      }

      logger.info('Campaign approved', { id, userId });
      return campaign;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error approving campaign', err);
      throw new AppError('DATABASE_ERROR', 'Failed to approve campaign', 500);
    }
  }

  async rejectCampaign(id: number, workspaceId: number, userId: number, notes?: string): Promise<Campaign> {
    try {
      const campaign = await this.findById(id);

      if (!campaign) {
        throw new AppError('NOT_FOUND', 'Campaign not found', 404);
      }

      if (campaign.workspace_id !== workspaceId) {
        throw new AppError('FORBIDDEN', 'Campaign does not belong to this workspace', 403);
      }

      // Update campaign status to cancelled
      campaign.status = 'cancelled';
      campaign.updated_at = new Date().toISOString();
      await this.repository.save(campaign);

      // Update approval record
      if (campaign.approval) {
        campaign.approval.status = 'rejected' as any;
        campaign.approval.reviewer_id = userId;
        campaign.approval.notes = notes || null;
        campaign.approval.reviewed_at = new Date().toISOString();
        await this.approvalRepository.save(campaign.approval);
      }

      logger.info('Campaign rejected', { id, userId });
      return campaign;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error rejecting campaign', err);
      throw new AppError('DATABASE_ERROR', 'Failed to reject campaign', 500);
    }
  }

  async getPendingApprovalsForUser(userId: number): Promise<Campaign[]> {
    try {
      // Get all workspaces for this user
      const workspaces = await this.workspaceRepository.find({
        where: { user_id: userId },
      });

      const workspaceIds = workspaces.map(w => w.id);

      if (workspaceIds.length === 0) {
        return [];
      }

      // Get all pending campaigns in user's workspaces
      const pendingCampaigns: Campaign[] = [];
      for (const workspaceId of workspaceIds) {
        const campaigns = await this.repository.find({
          where: {
            workspace_id: workspaceId,
            status: 'pending',
          },
          relations: ['workspace', 'template', 'approval'],
          order: { created_at: 'DESC' },
        });
        pendingCampaigns.push(...campaigns);
      }

      return pendingCampaigns;
    } catch (err) {
      logger.error('Error getting pending approvals', err);
      return [];
    }
  }
}
