import { Router, Request, Response } from 'express';
import { TemplateService } from '../services/TemplateService';
import { WorkspaceService } from '../services/WorkspaceService';
import { requireLogin } from '../middlewares/requireLogin';

export class TemplateUIController {
  public router: Router;

  constructor(
    private templateService: TemplateService,
    private workspaceService: WorkspaceService
  ) {
    this.router = Router();
    this.router.use(requireLogin);
    this.router.get('/', this.getTemplateList.bind(this));
    this.router.get('/:id', this.getTemplateDetail.bind(this));
  }

  private async getTemplateList(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const workspaces = await this.workspaceService.listByUser(userId);

      // Get all templates across workspaces
      const allTemplates: any[] = [];
      for (const workspace of workspaces) {
        const templates = await this.templateService.listByWorkspace(workspace.id);
        allTemplates.push(...templates.map(t => ({ ...t, workspaceName: workspace.name })));
      }

      res.render('templates/index', {
        title: 'Templates',
        activePage: 'templates',
        templates: allTemplates,
        workspaces
      });
    } catch (err) {
      console.error('Error loading templates:', err);
      res.status(500).json({ error: 'Failed to load templates' });
    }
  }

  private async getTemplateDetail(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const templateId = parseInt(req.params.id as string, 10);

      if (isNaN(templateId)) {
        return res.status(400).json({ error: 'Invalid template ID' });
      }

      const template = await this.templateService.findById(templateId);
      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      // Verify user owns the workspace
      const workspace = await this.workspaceService.findById(template.workspace_id);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.render('templates/detail', {
        title: template.name,
        activePage: 'templates',
        template,
        workspace
      });
    } catch (err) {
      console.error('Error loading template detail:', err);
      res.status(500).json({ error: 'Failed to load template' });
    }
  }
}
