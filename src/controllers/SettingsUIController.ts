import { Router, Request, Response } from 'express';
import { PromptFileService } from '../services/PromptFileService';
import { WorkspaceService } from '../services/WorkspaceService';
import { ListService } from '../services/ListService';
import { SystemSettingsService } from '../services/SystemSettingsService';
import { requireLogin } from '../middlewares/requireLogin';
import { AppError } from '../errors/AppError';

export class SettingsUIController {
  public router: Router;

  constructor(
    private promptFileService: PromptFileService,
    private workspaceService: WorkspaceService,
    private listService: ListService,
    private systemSettingsService: SystemSettingsService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    this.router.get('/', this.getSettings.bind(this));
    this.router.get('/prompts/:filename', this.getPromptDetail.bind(this));
  }

  private async getSettings(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const workspaces = await this.workspaceService.listByUser(userId);

      // Build workspace lists mapping
      const workspaceLists: { [key: number]: any[] } = {};
      for (const workspace of workspaces) {
        const lists = await this.listService.getListsByWorkspace(workspace.id);
        workspaceLists[workspace.id] = lists;
      }

      // Get all prompts across workspaces with list names
      const allPromptsWithDetails: any[] = [];
      for (const workspace of workspaces) {
        const prompts = await this.promptFileService.listByWorkspace(workspace.id);

        for (const prompt of prompts) {
          let listName = null;
          if (prompt.listId) {
            const list = await this.listService.findById(prompt.listId);
            listName = list?.name || null;
          }

          allPromptsWithDetails.push({
            ...prompt,
            workspaceName: workspace.name,
            listName,
          });
        }
      }

      // Group prompts by workspace for easier display
      const promptsByWorkspace: { [key: number]: any[] } = {};
      workspaces.forEach(ws => {
        promptsByWorkspace[ws.id] = allPromptsWithDetails.filter(p => p.workspaceId === ws.id);
      });

      // Get user settings (e.g., Twilio config)
      const userSettings = await this.systemSettingsService.getUserSettings(userId);
      const twilioConfig = userSettings.twilio_config || null;

      res.render('settings/index', {
        title: 'Settings',
        activePage: 'settings',
        workspaces,
        prompts: allPromptsWithDetails,
        promptsByWorkspace,
        workspaceLists,
        userSettings,
        twilioConfig,
      });
    } catch (err) {
      console.error('Error loading settings:', err);
      res.status(500).json({ error: 'Failed to load settings' });
    }
  }

  private async getPromptDetail(req: Request, res: Response) {
    try {
      const userId = (req.session as any).userId;
      const filename = req.params.filename as string;

      const prompt = await this.promptFileService.findByFilename(filename);
      if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
      }

      // Verify workspace access
      const workspace = await this.workspaceService.findById(prompt.workspaceId);
      if (!workspace || workspace.user_id !== userId) {
        return res.status(403).json({ error: 'Not your workspace' });
      }

      // Get list name if applicable
      let listName = null;
      if (prompt.listId) {
        const list = await this.listService.findById(prompt.listId);
        listName = list?.name || null;
      }

      const workspaces = await this.workspaceService.listByUser(userId);

      res.render('settings/prompt-detail', {
        title: prompt.name,
        activePage: 'settings',
        prompt,
        workspace,
        listName,
        workspaces,
      });
    } catch (err) {
      console.error('Error loading prompt detail:', err);
      res.status(500).json({ error: 'Failed to load prompt' });
    }
  }
}
