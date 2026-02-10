import { Request, Response, Router } from 'express';
import { WorkspaceService } from '../services/WorkspaceService';
import { ContactService } from '../services/ContactService';

export class DashboardController {
    public router: Router;

    constructor(
        private workspaceService: WorkspaceService,
        private contactService: ContactService
    ) {
        this.router = Router();
        this.router.get('/', this.getDashboard.bind(this));
    }

    private async getDashboard(req: Request, res: Response) {
        // If not logged in, redirect to login (middleware should handle this but adding safety)
        if (!req.session || !(req.session as any).userId) {
            return res.redirect('/login');
        }

        const userId = (req.session as any).userId;

        // Aggregate data for dashboard
        // In a real app, we'd fetch these from services. For the "vibe," we'll provide rich mock data if empty.
        const workspaces = await this.workspaceService.listByUser(userId as any);

        const stats = [
            { label: 'Total Contacts', value: '1,248', icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>' },
            { label: 'Active Campaigns', value: '4', icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M13.5 13.5l3 3m-3-3l3-3m0 0l-3-3m3 3l-3 3"></path></svg>' },
            { label: 'Avg. Open Rate', value: '32.5%', icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>' },
            { label: 'Messages Sent', value: '3.2k', icon: '<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>' },
        ];

        const pendingApprovals = [
            { id: 1, name: 'Q4 Nurture Sequence', submittedBy: 'Andy', timeAgo: '2h ago' },
            { id: 2, name: 'Loan Factory Welcome', submittedBy: 'System', timeAgo: '1d ago' },
        ];

        const attentionItems = [
            { title: 'Email bounced', description: 'John Doe (john@example.com) bounced 2h ago', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
            { title: 'Unread reply', description: 'Sarah Smith replied to "Follow up" 1d ago', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>' },
            { title: 'Stalled Prospects', description: '8 prospects have had no contact in >60 days', icon: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' },
        ];

        const insights = [
            { type: 'Optimization', confidence: 85, content: 'Template "Welcome" has a 28% higher open rate when sent between 9 AM and 11 AM.' },
            { type: 'Income Idea', confidence: 78, content: 'You have 27 Calendly bookings from "Realtor" contacts. Suggestion: Create a premium "Pre-Approval Checklist" course.' },
        ];

        const recentContacts = [
            { id: 1, firstName: 'John', lastName: 'Doe', email: 'john@example.com', workspace: 'Loan Factory', stage: 'Prospect', lastContact: '2 days ago' },
            { id: 2, firstName: 'Sarah', lastName: 'Smith', email: 'sarah@example.com', workspace: 'MaiStory', stage: 'Lead', lastContact: '1 day ago' },
            { id: 3, firstName: 'Michael', lastName: 'Brown', email: 'm@brown.com', workspace: null, stage: 'Unassigned', lastContact: '5 hours ago' },
        ];

        const todos = [
            { id: 1, title: 'Follow up Mike Johnson', description: 'due today', dueDate: 'today' },
            { id: 2, title: 'Review AI suggestion', description: 'Template optimization', dueDate: null },
            { id: 3, title: 'Birthday - Lisa Chen', description: 'tomorrow', dueDate: 'tomorrow' },
        ];

        const hotLeads = [
            { id: 1, name: 'John Doe', list: 'Prospects', tag: 'Hot Leads', lastContact: '2 days ago', initials: 'JD' },
            { id: 2, name: 'Sarah Smith', list: 'Prospects', tag: 'Referral', lastContact: '1 day ago', initials: 'SS' },
            { id: 3, name: 'Mike Johnson', list: 'Leads', tag: 'New', lastContact: '3 hours ago', initials: 'MJ' },
            { id: 4, name: 'Lisa Chen', list: 'Customers', tag: 'VIP', lastContact: '1 week ago', initials: 'LC' },
        ];

        const campaigns = [
            { id: 1, name: 'Q4 Nurture', type: 'Drip', status: 'Active', progress: 45, nextStep: 'Next step in 3 days' },
            { id: 2, name: 'Welcome Series', type: 'Scheduled', status: 'Upcoming', progress: 0, nextStep: 'Starts in 5 days' },
        ];

        res.render('dashboard', {
            title: 'Dashboard',
            pageTitle: 'Dashboard',
            activePage: 'dashboard',
            stats,
            pendingApprovals,
            attentionItems,
            insights,
            recentContacts,
            todos,
            hotLeads,
            campaigns
        });
    }
}
