import { DataSource, Repository } from 'typeorm';
import { Template } from '../entities/Template.entity';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import { env } from '../config/env';
import OpenAI from 'openai';

export class TemplateService {
  private repository: Repository<Template>;
  private openai: OpenAI | null;

  constructor(private dataSource: DataSource) {
    this.repository = this.dataSource.getRepository(Template);
    this.openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;
  }

  async create(
    workspaceId: number,
    data: {
      name: string;
      template_type?: 'html' | 'text' | 'mixed';
      subject?: string | null;
      body: string;
      preheader?: string | null;
      signature?: string | null;
    }
  ): Promise<Template> {
    // Check duplicate name in workspace
    const existing = await this.repository.findOne({
      where: { workspace_id: workspaceId, name: data.name },
    });
    if (existing) {
      throw new AppError(
        'DUPLICATE',
        'A template with this name already exists in this workspace',
        409
      );
    }

    const template = this.repository.create({
      workspace_id: workspaceId,
      name: data.name,
      template_type: data.template_type || 'html',
      subject: data.subject || null,
      body: data.body,
      preheader: data.preheader || null,
      signature: data.signature || null,
    });

    const saved = await this.repository.save(template);
    logger.info('Template created', { id: saved.id, workspaceId, name: data.name });
    return saved;
  }

  async findById(id: number): Promise<Template | null> {
    return this.repository.findOne({ where: { id } });
  }

  async listByWorkspace(workspaceId: number): Promise<Template[]> {
    return this.repository.find({
      where: { workspace_id: workspaceId },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: number,
    workspaceId: number,
    data: {
      name?: string;
      template_type?: 'html' | 'text' | 'mixed';
      subject?: string | null;
      body?: string;
      preheader?: string | null;
      signature?: string | null;
    }
  ): Promise<Template> {
    const template = await this.repository.findOne({ where: { id } });
    if (!template) {
      throw new AppError('NOT_FOUND', 'Template not found', 404);
    }
    if (template.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'Template does not belong to this workspace', 403);
    }

    // Check duplicate name if changing name
    if (data.name && data.name !== template.name) {
      const duplicate = await this.repository.findOne({
        where: { workspace_id: workspaceId, name: data.name },
      });
      if (duplicate && duplicate.id !== id) {
        throw new AppError('DUPLICATE', 'A template with this name already exists', 409);
      }
    }

    // Update fields
    if (data.name !== undefined) template.name = data.name;
    if (data.template_type !== undefined) template.template_type = data.template_type;
    if (data.subject !== undefined) template.subject = data.subject || null;
    if (data.body !== undefined) template.body = data.body;
    if (data.preheader !== undefined) template.preheader = data.preheader || null;
    if (data.signature !== undefined) template.signature = data.signature || null;

    const saved = await this.repository.save(template);
    logger.info('Template updated', { id });
    return saved;
  }

  async delete(id: number, workspaceId: number): Promise<void> {
    const template = await this.repository.findOne({ where: { id } });
    if (!template) {
      throw new AppError('NOT_FOUND', 'Template not found', 404);
    }
    if (template.workspace_id !== workspaceId) {
      throw new AppError('FORBIDDEN', 'Template does not belong to this workspace', 403);
    }

    await this.repository.remove(template);
    logger.info('Template deleted', { id });
  }

  async generateWithAI(
    workspaceId: number,
    params: {
      name: string;
      templateType?: 'html' | 'text';
      goal: string;
      audience: string;
      tone: string;
      mustHaves?: string[];
    }
  ): Promise<Template> {
    if (!this.openai) {
      throw new AppError(
        'CONFIGURATION_ERROR',
        'OpenAI API key not configured',
        500
      );
    }

    const templateType = params.templateType || 'html';
    const mustHaves = params.mustHaves || [];

    // Build prompt
    const prompt = this.buildPrompt(
      params.goal,
      params.audience,
      params.tone,
      mustHaves,
      templateType
    );

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are an expert email marketing copywriter. Generate email templates in valid JSON format ONLY.
Return ONLY a JSON object (no markdown, no explanation) with these fields:
- subject: string (email subject line, 50-70 characters)
- body: string (${templateType === 'html' ? 'HTML with semantic markup' : 'plain text'})
- preheader: string or null (preview text, 80-100 characters, optional)
- signature: string or null (email signature, optional)

Do not include any text outside the JSON object.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new AppError('AI_GENERATION_ERROR', 'No response from OpenAI', 500);
      }

      const parsed = JSON.parse(response);

      // Validate response has required fields
      if (!parsed.subject || !parsed.body) {
        throw new AppError(
          'AI_GENERATION_ERROR',
          'Invalid AI response format: missing subject or body',
          500
        );
      }

      // Create template
      const template = await this.create(workspaceId, {
        name: params.name,
        template_type: templateType,
        subject: parsed.subject,
        body: parsed.body,
        preheader: parsed.preheader || null,
        signature: parsed.signature || null,
      });

      logger.info('Template generated via AI', { id: template.id, workspaceId, templateType });
      return template;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      logger.error('OpenAI API error', { error: error.message });
      throw new AppError(
        'AI_GENERATION_ERROR',
        `Failed to generate template: ${error.message}`,
        500
      );
    }
  }

  private buildPrompt(
    goal: string,
    audience: string,
    tone: string,
    mustHaves: string[],
    templateType: 'html' | 'text'
  ): string {
    let prompt = `Generate an email template with the following requirements:\n\n`;
    prompt += `Goal: ${goal}\n`;
    prompt += `Target Audience: ${audience}\n`;
    prompt += `Tone: ${tone}\n`;
    prompt += `Format: ${templateType === 'html' ? 'HTML' : 'Plain Text'}\n`;

    if (mustHaves.length > 0) {
      prompt += `\nMust Include:\n`;
      mustHaves.forEach((item) => {
        prompt += `- ${item}\n`;
      });
    }

    prompt += `\nReturn a JSON object with these fields:\n`;
    prompt += `- subject: Email subject line (50-70 characters)\n`;
    prompt += `- body: Email body content (${templateType === 'html' ? 'HTML with semantic markup' : 'Plain text'})\n`;
    prompt += `- preheader: Preview text (80-100 characters, optional)\n`;
    prompt += `- signature: Email signature (optional)\n`;
    prompt += `\nEnsure the content is professional, engaging, and directly addresses the goal.`;

    return prompt;
  }
}
