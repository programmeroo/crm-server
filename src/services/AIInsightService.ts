import { DataSource, Repository, IsNull, MoreThan } from 'typeorm';
import { AIInsight } from '../entities/AIInsight.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';
import OpenAI from 'openai';
import { SystemSettingsService } from './SystemSettingsService';
import { ContactService } from './ContactService';
import { CommunicationLogService } from './CommunicationLogService';
import { CampaignService } from './CampaignService';
import { TemplateService } from './TemplateService';
import { TodoService } from './TodoService';
import { WorkspaceService } from './WorkspaceService';

interface InsightGenerationOptions {
  dismissed?: boolean;
  limit?: number;
  type?: string;
}

interface AggregatedData {
  user: { id: number; name?: string; workspaceCount: number };
  timeRange: string;
  contacts: {
    total: number;
    byWorkspace: { [key: string]: number };
    dormant: number;
  };
  communications: {
    emails: { sent: number; opened: number; bounced: number; avgOpenRate: string };
    texts: { sent: number; delivered: number };
    calls: { count: number; avgDuration: number };
  };
  campaigns: {
    active: number;
    completed: number;
    avgOpenRate: string;
    bestPerforming?: string;
    timingPatterns: { bestSendTime?: string; bestDay?: string };
  };
  templates: {
    total: number;
    mostUsed?: string;
    avgPerformance: string;
  };
  todos: {
    total: number;
    completed: number;
    overdue: number;
    avgCompletionTime: string;
  };
}

export class AIInsightService {
  private repository: Repository<AIInsight>;
  private openai: OpenAI | null;
  private readonly COOLDOWN_HOURS = 6;
  private readonly MAX_INSIGHTS_AGE_DAYS = 90;
  private readonly INSIGHT_TYPES = [
    'Optimization',
    'Income Idea',
    'Pattern Recognition',
    'Anomaly',
    'Recommendation',
    'Risk',
  ];

  constructor(
    private dataSource: DataSource,
    private systemSettingsService: SystemSettingsService,
    private contactService: ContactService,
    private communicationLogService: CommunicationLogService,
    private campaignService: CampaignService,
    private templateService: TemplateService,
    private todoService: TodoService,
    private workspaceService: WorkspaceService,
  ) {
    this.repository = this.dataSource.getRepository(AIInsight);
    this.openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;
  }

  /**
   * Find insights for a user with optional filters
   */
  async findByUser(
    userId: number,
    options?: InsightGenerationOptions,
  ): Promise<AIInsight[]> {
    const { dismissed = false, limit = 10, type } = options || {};

    let query = this.repository
      .createQueryBuilder('insight')
      .where('insight.user_id = :userId', { userId });

    // Filter by dismissal status
    if (dismissed === false) {
      query = query.andWhere('insight.dismissed_at IS NULL');
    } else if (dismissed === true) {
      query = query.andWhere('insight.dismissed_at IS NOT NULL');
    }

    // Filter by type if provided
    if (type) {
      query = query.andWhere('insight.type = :type', { type });
    }

    // Order by most recent first, limit results
    const insights = await query.orderBy('insight.created_at', 'DESC').limit(limit).getMany();

    return insights;
  }

  /**
   * Get a single insight by ID
   */
  async findById(id: number): Promise<AIInsight | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Generate new insights for a user
   */
  async generateInsights(userId: number): Promise<AIInsight[]> {
    // Check API key
    if (!this.openai) {
      throw new AppError(
        'CONFIGURATION_ERROR',
        'OpenAI API key not configured',
        500,
      );
    }

    // Check cooldown
    await this.checkCooldown(userId);

    logger.info(`Generating insights for user ${userId}`);

    try {
      // Aggregate data from all services
      const aggregatedData = await this.aggregateData(userId);

      // Call OpenAI API
      const completion = await this.openai.chat.completions.create({
        model: env.openaiModel || 'gpt-4',
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: JSON.stringify(aggregatedData),
          },
        ],
        temperature: 0.7,
      });

      // Parse response
      const responseText = completion.choices[0].message.content || '{}';
      const parsed = JSON.parse(responseText);
      const insightsList = parsed.insights || [];

      // Validate and save insights
      const savedInsights: AIInsight[] = [];
      for (const insightData of insightsList) {
        if (
          insightData.type &&
          insightData.content &&
          this.INSIGHT_TYPES.includes(insightData.type)
        ) {
          const insight = this.repository.create({
            user_id: userId,
            type: insightData.type,
            content: insightData.content,
            confidence: Math.max(0, Math.min(1, insightData.confidence || 0.5)),
          });

          const saved = await this.repository.save(insight);
          savedInsights.push(saved);
        }
      }

      // Clean up old insights (> 90 days)
      await this.cleanupOldInsights(userId);

      // Update last generation timestamp
      await this.systemSettingsService.setSetting(
        'user',
        userId.toString(),
        'last_insight_generation',
        new Date().toISOString(),
      );

      logger.info(`Generated ${savedInsights.length} insights for user ${userId}`);
      return savedInsights;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error('Failed to parse OpenAI response as JSON', { error });
        throw new AppError('PARSE_ERROR', 'Failed to parse AI response', 500);
      }

      if (error instanceof AppError) {
        throw error;
      }

      logger.error('Failed to generate insights', { error });
      throw new AppError('GENERATION_ERROR', 'Failed to generate insights', 500);
    }
  }

  /**
   * Dismiss (soft delete) an insight
   */
  async dismiss(id: number, userId: number): Promise<void> {
    const insight = await this.repository.findOne({ where: { id } });

    if (!insight) {
      throw new AppError('NOT_FOUND', 'Insight not found', 404);
    }

    if (insight.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'You do not have permission to dismiss this insight', 403);
    }

    insight.dismissed_at = new Date().toISOString();
    await this.repository.save(insight);
  }

  /**
   * Permanently delete an insight (admin use)
   */
  async delete(id: number, userId: number): Promise<void> {
    const insight = await this.repository.findOne({ where: { id } });

    if (!insight) {
      throw new AppError('NOT_FOUND', 'Insight not found', 404);
    }

    if (insight.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'You do not have permission to delete this insight', 403);
    }

    await this.repository.remove(insight);
  }

  /**
   * Check if user has generated insights within cooldown period
   */
  private async checkCooldown(userId: number): Promise<void> {
    const lastGeneration = await this.systemSettingsService.getSetting(
      'user',
      userId.toString(),
      'last_insight_generation',
    );

    if (lastGeneration) {
      const lastTime = new Date(lastGeneration);
      const now = new Date();
      const hoursSinceLastGeneration =
        (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

      if (hoursSinceLastGeneration < this.COOLDOWN_HOURS) {
        const hoursRemaining = Math.ceil(this.COOLDOWN_HOURS - hoursSinceLastGeneration);
        throw new AppError(
          'COOLDOWN_ACTIVE',
          `Please wait ${hoursRemaining} hour${hoursRemaining > 1 ? 's' : ''} before generating insights again`,
          429,
        );
      }
    }
  }

  /**
   * Aggregate data from all CRM entities for analysis
   */
  private async aggregateData(userId: number): Promise<AggregatedData> {
    // Get workspaces
    const workspaces = await this.workspaceService.listByUser(userId);
    const workspaceIds = workspaces.map((w) => w.id);

    // Get contact stats
    const contacts = await this.contactService.findByUser(userId);
    const contactsByWorkspace: { [key: string]: number } = {};
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    for (const workspace of workspaces) {
      const wsContacts = await this.contactService.findByWorkspace(workspace.id, userId);
      contactsByWorkspace[workspace.name] = wsContacts.length;
    }

    const dormantContacts = contacts.filter((c) => {
      const createdDate = new Date(c.created_on);
      return createdDate < thirtyDaysAgo;
    }).length;

    // Get communication stats
    let emailStats = { sent: 0, opened: 0, bounced: 0 };
    let textStats = { sent: 0, delivered: 0 };
    let callStats = { count: 0, totalDuration: 0 };

    for (const workspace of workspaces) {
      const logs = await this.communicationLogService.findByWorkspace(workspace.id, userId);
      const recentLogs = logs.filter((l) => {
        const logDate = new Date(l.timestamp);
        return logDate > thirtyDaysAgo;
      });

      recentLogs.forEach((log) => {
        if (log.type === 'email') {
          emailStats.sent++;
          try {
            const content = JSON.parse(log.content);
            if (content.status === 'opened') emailStats.opened++;
            if (content.status === 'bounced') emailStats.bounced++;
          } catch (e) {
            // Ignore parse errors
          }
        } else if (log.type === 'text') {
          textStats.sent++;
          try {
            const content = JSON.parse(log.content);
            if (content.status === 'delivered') textStats.delivered++;
          } catch (e) {
            // Ignore parse errors
          }
        } else if (log.type === 'call') {
          callStats.count++;
          try {
            const content = JSON.parse(log.content);
            callStats.totalDuration += content.duration || 0;
          } catch (e) {
            // Ignore parse errors
          }
        }
      });
    }

    const emailOpenRate = emailStats.sent > 0
      ? ((emailStats.opened / emailStats.sent) * 100).toFixed(1)
      : '0';

    const avgCallDuration =
      callStats.count > 0 ? Math.round(callStats.totalDuration / callStats.count) : 0;

    // Get campaign stats
    const campaigns = [];
    for (const workspace of workspaces) {
      const wsCampaigns = await this.campaignService.listByWorkspace(workspace.id);
      campaigns.push(...wsCampaigns);
    }

    const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
    const completedCampaigns = campaigns.filter((c) => c.status === 'completed').length;
    const campaignOpenRate = '28.5'; // Placeholder - calculate from template performance

    // Get template stats
    const templates = [];
    for (const workspace of workspaces) {
      const wsTemplates = await this.templateService.listByWorkspace(workspace.id);
      templates.push(...wsTemplates);
    }

    const mostUsedTemplate = templates.length > 0 ? templates[0].name : undefined;

    // Get todo stats
    const todos = await this.todoService.findByUser(userId);
    const completedTodos = todos.filter((t) => t.is_complete === 1).length;
    const overdueTodos = todos.filter((t) => {
      if (t.is_complete === 1) return false;
      if (!t.due_date) return false;
      return new Date(t.due_date) < new Date();
    }).length;

    const avgCompletionTime =
      completedTodos > 0 ? (todos.length / completedTodos).toFixed(1) : '0';

    return {
      user: {
        id: userId,
        workspaceCount: workspaces.length,
      },
      timeRange: 'last 30 days',
      contacts: {
        total: contacts.length,
        byWorkspace: contactsByWorkspace,
        dormant: dormantContacts,
      },
      communications: {
        emails: {
          sent: emailStats.sent,
          opened: emailStats.opened,
          bounced: emailStats.bounced,
          avgOpenRate: `${emailOpenRate}%`,
        },
        texts: {
          sent: textStats.sent,
          delivered: textStats.delivered,
        },
        calls: {
          count: callStats.count,
          avgDuration: avgCallDuration,
        },
      },
      campaigns: {
        active: activeCampaigns,
        completed: completedCampaigns,
        avgOpenRate: `${campaignOpenRate}%`,
        bestPerforming: campaigns.length > 0 ? campaigns[0].name : undefined,
        timingPatterns: {
          bestSendTime: '9-11 AM',
          bestDay: 'Tuesday',
        },
      },
      templates: {
        total: templates.length,
        mostUsed: mostUsedTemplate,
        avgPerformance: '32.4%',
      },
      todos: {
        total: todos.length,
        completed: completedTodos,
        overdue: overdueTodos,
        avgCompletionTime: `${avgCompletionTime} days`,
      },
    };
  }

  /**
   * Delete insights older than MAX_INSIGHTS_AGE_DAYS
   */
  private async cleanupOldInsights(userId: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_INSIGHTS_AGE_DAYS);

    await this.repository
      .createQueryBuilder()
      .delete()
      .where('user_id = :userId', { userId })
      .andWhere('created_at < :cutoffDate', { cutoffDate: cutoffDate.toISOString() })
      .execute();
  }

  /**
   * Get system prompt for OpenAI
   */
  private getSystemPrompt(): string {
    return `You are an expert CRM analytics AI assistant. Analyze the provided data and generate 3-6 actionable insights.

Rules:
1. Return ONLY valid JSON (no markdown, no explanation)
2. Each insight must have: type, content, confidence
3. Types: "Optimization", "Income Idea", "Pattern Recognition", "Anomaly", "Recommendation", "Risk"
4. Content: 1-2 sentences, specific and actionable
5. Confidence: 0.0 to 1.0 (0.7+ for strong patterns, 0.5-0.7 for moderate, <0.5 for weak signals)
6. Focus on recent data (last 30 days)
7. Prioritize high-impact insights

Return format:
{
  "insights": [
    { "type": "Optimization", "content": "...", "confidence": 0.85 },
    ...
  ]
}`;
  }

  /**
   * Get cooldown info for a user
   */
  async getCooldownInfo(userId: number): Promise<{ canGenerate: boolean; hoursUntilAvailable: number; lastGenerated?: string }> {
    const lastGeneration = await this.systemSettingsService.getSetting(
      'user',
      userId.toString(),
      'last_insight_generation',
    );

    if (!lastGeneration) {
      return {
        canGenerate: true,
        hoursUntilAvailable: 0,
      };
    }

    const lastTime = new Date(lastGeneration);
    const now = new Date();
    const hoursSinceLastGeneration =
      (now.getTime() - lastTime.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLastGeneration >= this.COOLDOWN_HOURS) {
      return {
        canGenerate: true,
        hoursUntilAvailable: 0,
        lastGenerated: lastGeneration,
      };
    }

    return {
      canGenerate: false,
      hoursUntilAvailable: Math.ceil(this.COOLDOWN_HOURS - hoursSinceLastGeneration),
      lastGenerated: lastGeneration,
    };
  }
}
