import { Request, Response, Router } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';
import { ListService } from '../services/ListService';
import { requireLogin } from '../middlewares/requireLogin';

export class WorkspaceUIController {
    public router: Router;

    constructor(
        private workspaceService: WorkspaceService,
        private contactService: ContactService,
        private listService: ListService
    ) {
        this.router = Router();
        this.router.use(requireLogin);
        this.router.get('/', this.getWorkspaceList.bind(this));
        this.router.get('/:id', this.getWorkspaceDetail.bind(this));
    }

    private async getWorkspaceList(req: Request, res: Response) {
        const userId = (req.session as any).userId;
        const workspaces = await this.workspaceService.listByUser(userId);

        res.render('workspaces/index', {
            title: 'Workspaces',
            pageTitle: 'My Workspaces',
            activePage: 'workspaces'
        });
    }

    private async getWorkspaceDetail(req: Request, res: Response) {
        const userId = (req.session as any).userId;
        const workspaceId = Number(req.params.id);

        const workspace = await this.workspaceService.findById(workspaceId);
        if (!workspace || workspace.user_id !== userId) {
            return res.status(404).render('errors/404', {
                layout: false,
                message: 'Workspace not found'
            });
        }

        const workspaces = await this.workspaceService.listByUser(userId);
        const contacts = await this.contactService.findByWorkspace(workspaceId, userId);
        const lists = await this.listService.getListsByWorkspace(workspaceId);

        res.render('workspaces/detail', {
            title: workspace.name,
            pageTitle: workspace.name,
            activePage: 'workspaces',
            workspace,
            contacts,
            lists,
            currentWorkspaceId: workspaceId
        });
    }
}
