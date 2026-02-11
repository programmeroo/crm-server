import { Request, Response, Router } from 'express';
import { ContactService } from '../services/ContactService';
import { WorkspaceService } from '../services/WorkspaceService';
import { CustomFieldService } from '../services/CustomFieldService';
import { ListService } from '../services/ListService';
import { requireLogin } from '../middlewares/requireLogin';

export class ContactUIController {
    public router: Router;

    constructor(
        private contactService: ContactService,
        private workspaceService: WorkspaceService,
        private customFieldService: CustomFieldService,
        private listService: ListService
    ) {
        this.router = Router();
        this.router.use(requireLogin);
        this.router.get('/', this.getContactList.bind(this));
        this.router.get('/:id', this.getContactDetail.bind(this));
    }

    private async getContactList(req: Request, res: Response) {
        const userId = (req.session as any).userId;
        const contacts = await this.contactService.findByUser(userId);
        const workspaces = await this.workspaceService.listByUser(userId);

        // Get all lists for each contact and identify primary
        const contactsWithLists = await Promise.all(
            contacts.map(async (contact) => {
                const lists = await this.listService.getListsForContact(contact.id);
                const primaryList = lists.find(list => list.is_primary === 1) || null;
                return {
                    ...contact,
                    lists,
                    primaryList
                };
            })
        );

        // Get all unique lists across all workspaces for filtering
        const allLists: any[] = [];
        for (const workspace of workspaces) {
            const workspaceLists = await this.listService.getListsByWorkspace(workspace.id);
            allLists.push(...workspaceLists);
        }

        res.render('contacts/index', {
            title: 'Contacts',
            pageTitle: 'Contacts',
            activePage: 'contacts',
            contacts: contactsWithLists,
            allLists
        });
    }

    private async getContactDetail(req: Request, res: Response) {
        const userId = (req.session as any).userId;
        const contactId = Number(req.params.id);
        const contact = await this.contactService.findById(contactId, userId);

        if (!contact) {
            return res.status(404).render('errors/404', {
                layout: false,
                message: 'Contact not found'
            });
        }

        const workspaces = await this.workspaceService.listByUser(userId);
        const customFieldDefinitions = await this.customFieldService.getDefinitions(userId, contact.workspace_id || undefined);
        const customFieldValues = await this.customFieldService.getFieldValues(contactId);

        // Get contact's list assignments
        const contactLists = await this.listService.getListsForContact(contactId);

        // Get available lists for this contact's workspace (if assigned)
        const availableLists = contact.workspace_id
            ? await this.listService.getListsByWorkspace(contact.workspace_id)
            : [];

        res.render('contacts/detail', {
            title: `${contact.first_name} ${contact.last_name}`,
            pageTitle: 'Contact Detail',
            activePage: 'contacts',
            contact,
            customFieldDefinitions,
            customFieldValues,
            contactLists,
            availableLists
        });
    }
}
