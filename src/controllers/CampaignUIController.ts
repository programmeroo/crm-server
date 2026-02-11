import { Router, Request, Response } from 'express';
import { CampaignService } from '../services/CampaignService';
import { WorkspaceService } from '../services/WorkspaceService';
import { TemplateService } from '../services/TemplateService';
import { ListService } from '../services/ListService';
import { requireLogin } from '../middlewares/requireLogin';
import { AppError } from '../errors/AppError';

export class CampaignUIController {
  public router: Router;

  constructor(
    private campaignService: CampaignService,
    private workspaceService: WorkspaceService,
    private templateService: TemplateService,
    private listService: ListService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/', this.getCampaignList.bind(this));
    this.router.get('/new', this.getCreateForm.bind(this));
    this.router.get('/:id', this.getCampaignDetail.bind(this));
    this.router.post('/', this.createCampaign.bind(this));
    this.router.post('/:id', this.updateCampaign.bind(this));
    this.router.post('/:id/approve', this.approveCampaign.bind(this));
    this.router.post('/:id/reject', this.rejectCampaign.bind(this));
    this.router.delete('/:id', this.deleteCampaign.bind(this));
  }

  private async getCampaignList(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const workspaces = await this.workspaceService.listByUser(userId);

      // Get all campaigns across workspaces
      const allCampaigns: any[] = [];
      for (const workspace of workspaces) {
        const campaigns = await this.campaignService.listByWorkspace(workspace.id);
        allCampaigns.push(
          ...campaigns.map(c => ({
            ...c,
            workspaceName: workspace.name,
          }))
        );
      }

      res.render('campaigns/index', {
        title: 'Campaigns',
        activePage: 'campaigns',
        campaigns: allCampaigns,
        workspaces,
      });
    } catch (err) {
      console.error('Error loading campaigns:', err);
      res.status(500).json({ error: 'Failed to load campaigns' });
    }
  }

  private async getCampaignDetail(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const campaignId = parseInt(req.params.id as string, 10);

      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'Invalid campaign ID' });
      }

      const campaign = await this.campaignService.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(campaign.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      // Get templates and lists for this workspace
      const templates = await this.templateService.listByWorkspace(campaign.workspace_id);
      const lists = await this.listService.getListsByWorkspace(campaign.workspace_id);

      // Parse JSON fields
      const segment = campaign.segment_json ? JSON.parse(campaign.segment_json) : null;
      const schedule = campaign.schedule_json ? JSON.parse(campaign.schedule_json) : null;

      const workspaces = await this.workspaceService.listByUser(userId);

      res.render('campaigns/detail', {
        title: campaign.name,
        activePage: 'campaigns',
        campaign: {
          ...campaign,
          segment,
          schedule,
        },
        workspace,
        templates,
        lists,
        workspaces,
      });
    } catch (err) {
      console.error('Error loading campaign detail:', err);
      res.status(500).json({ error: 'Failed to load campaign' });
    }
  }

  private async createCampaign(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const { workspaceId, name, type, templateId, segment, schedule } = req.body;

      // Validate required fields
      if (!workspaceId || !name || !type) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(parseInt(workspaceId, 10));
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      const campaign = await this.campaignService.create({
        workspaceId: parseInt(workspaceId, 10),
        name,
        type,
        templateId: templateId ? parseInt(templateId, 10) : null,
        segment,
        schedule,
      });

      res.status(201).json({ data: campaign, error: null });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error creating campaign:', err);
      res.status(500).json({ error: 'Failed to create campaign' });
    }
  }

  private async updateCampaign(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const campaignId = parseInt(req.params.id as string, 10);
      const { name, type, templateId, segment, schedule } = req.body;

      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'Invalid campaign ID' });
      }

      const campaign = await this.campaignService.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(campaign.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      const updated = await this.campaignService.update(campaignId, campaign.workspace_id, {
        name,
        type,
        templateId: templateId ? parseInt(templateId, 10) : null,
        segment,
        schedule,
      });

      res.json({ data: updated, error: null });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error updating campaign:', err);
      res.status(500).json({ error: 'Failed to update campaign' });
    }
  }

  private async approveCampaign(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const campaignId = parseInt(req.params.id as string, 10);
      const { notes } = req.body;

      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'Invalid campaign ID' });
      }

      const campaign = await this.campaignService.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(campaign.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      const approved = await this.campaignService.approveCampaign(
        campaignId,
        campaign.workspace_id,
        userId,
        notes
      );

      res.json({ data: approved, error: null });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error approving campaign:', err);
      res.status(500).json({ error: 'Failed to approve campaign' });
    }
  }

  private async rejectCampaign(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const campaignId = parseInt(req.params.id as string, 10);
      const { notes } = req.body;

      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'Invalid campaign ID' });
      }

      const campaign = await this.campaignService.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(campaign.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      const rejected = await this.campaignService.rejectCampaign(
        campaignId,
        campaign.workspace_id,
        userId,
        notes
      );

      res.json({ data: rejected, error: null });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error rejecting campaign:', err);
      res.status(500).json({ error: 'Failed to reject campaign' });
    }
  }

  private async deleteCampaign(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const campaignId = parseInt(req.params.id as string, 10);

      if (isNaN(campaignId)) {
        return res.status(400).json({ error: 'Invalid campaign ID' });
      }

      const campaign = await this.campaignService.findById(campaignId);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(campaign.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      await this.campaignService.delete(campaignId, campaign.workspace_id);

      res.json({ data: { message: 'Campaign deleted' }, error: null });
    } catch (err) {
      if (err instanceof AppError) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Error deleting campaign:', err);
      res.status(500).json({ error: 'Failed to delete campaign' });
    }
  }

  private async getCreateForm(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const workspaces = await this.workspaceService.listByUser(userId);

      // Get templates for each workspace
      const workspacesWithTemplates = await Promise.all(
        workspaces.map(async (workspace) => ({
          ...workspace,
          templates: await this.templateService.listByWorkspace(workspace.id),
        }))
      );

      res.render('campaigns/create', {
        title: 'New Campaign',
        activePage: 'campaigns',
        workspaces: workspacesWithTemplates,
      });
    } catch (err) {
      console.error('Error loading campaign create form:', err);
      res.status(500).json({ error: 'Failed to load create form' });
    }
  }
}
