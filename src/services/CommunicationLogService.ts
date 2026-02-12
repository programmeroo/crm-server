import { DataSource, Repository, FindOptionsWhere } from 'typeorm';
import { CommunicationLog } from '../entities/CommunicationLog.entity';
import { BaseContact } from '../entities/BaseContact.entity';
import { Workspace } from '../entities/Workspace.entity';
import { SystemSettingsService } from './SystemSettingsService';
import { TodoService } from './TodoService';
import { AppError } from '../errors/AppError';
import { logger } from '../config/logger';
import * as fs from 'fs/promises';
import Twilio from 'twilio';
import { simpleParser } from 'mailparser';
import { Readable } from 'stream';

interface CreateLogData {
  workspaceId: number;
  contactId: number;
  type: 'email' | 'text' | 'call' | 'ai' | 'stage_change' | 'note' | 'system';
  content: string; // JSON string
  status?: string | null;
}

interface ManualLogData {
  contactId: number;
  userId: number;
  type: 'email' | 'text' | 'call' | 'note';
  content: any; // Will be stringified
  createTodo?: boolean;
  todoText?: string;
  todoDueDate?: string | null;
}

export class CommunicationLogService {
  private repository: Repository<CommunicationLog>;
  private contactRepository: Repository<BaseContact>;
  private workspaceRepository: Repository<Workspace>;

  constructor(private dataSource: DataSource, private settingsService: SystemSettingsService) {
    this.repository = this.dataSource.getRepository(CommunicationLog);
    this.contactRepository = this.dataSource.getRepository(BaseContact);
    this.workspaceRepository = this.dataSource.getRepository(Workspace);
  }

  async create(data: CreateLogData): Promise<CommunicationLog> {
    try {
      // Verify contact belongs to workspace
      const contact = await this.contactRepository.findOne({
        where: { id: data.contactId },
      });
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }
      if (contact.workspace_id && contact.workspace_id !== data.workspaceId) {
        throw new AppError('CONTACT_MISMATCH', 'Contact does not belong to workspace', 400);
      }

      const log = this.repository.create({
        workspace_id: data.workspaceId,
        contact_id: data.contactId,
        type: data.type,
        content: data.content,
        status: data.status || null,
      });

      const saved = await this.repository.save(log);
      logger.info('Communication logged', { id: saved.id, type: data.type, contactId: data.contactId });
      return saved;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error creating communication log', err);
      throw new AppError('DATABASE_ERROR', 'Failed to log communication', 500);
    }
  }

  async findByContact(contactId: number, userId: number): Promise<CommunicationLog[]> {
    try {
      // Verify contact ownership
      const contact = await this.contactRepository.findOne({
        where: { id: contactId },
      });
      if (!contact || contact.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your contact', 403);
      }

      const logs = await this.repository.find({
        where: { contact_id: contactId },
        order: { timestamp: 'DESC' },
      });

      return logs;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding logs by contact', { contactId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find logs', 500);
    }
  }

  async findByWorkspace(
    workspaceId: number,
    userId: number,
    filters?: { type?: string; limit?: number }
  ): Promise<CommunicationLog[]> {
    try {
      // Verify workspace ownership
      const workspace = await this.workspaceRepository.findOne({
        where: { id: workspaceId },
      });
      if (!workspace || workspace.user_id !== userId) {
        throw new AppError('FORBIDDEN', 'Not your workspace', 403);
      }

      const query: FindOptionsWhere<CommunicationLog> = { workspace_id: workspaceId };
      if (filters?.type) {
        query.type = filters.type as any;
      }

      const logs = await this.repository.find({
        where: query,
        order: { timestamp: 'DESC' },
        take: filters?.limit || 100,
      });

      return logs;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error finding logs by workspace', { workspaceId, err });
      throw new AppError('DATABASE_ERROR', 'Failed to find logs', 500);
    }
  }

  async pollEmails(userId: number): Promise<{ success: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let success = 0;

      // Read mail spool file
      let mailContent = '';
      try {
        mailContent = await fs.readFile('/var/mail/crm', 'utf-8');
      } catch (err) {
        logger.warn('Could not read mail spool', { err });
        return { success: 0, errors: ['Could not read mail spool file'] };
      }

      if (!mailContent) {
        return { success: 0, errors: [] };
      }

      // Get last poll timestamp
      const lastPollTimestamp = await this.settingsService.getSetting('user', userId.toString(), 'email_last_poll');
      const lastPollDate = lastPollTimestamp ? new Date(lastPollTimestamp) : new Date(0);

      // Parse emails
      const emailRegex = /^From .+ \d{4}$/gm;
      const emails = mailContent.split(emailRegex).slice(1);

      for (const emailBlock of emails) {
        try {
          // Parse email with mailparser
          const stream = Readable.from([emailBlock]);
          const parsed = await simpleParser(stream);

          const timestamp = parsed.date ? new Date(parsed.date) : new Date();
          if (timestamp < lastPollDate) {
            continue; // Skip old emails
          }

          let fromAddress = '';
          let toAddress = '';

          if (parsed.from) {
            if (Array.isArray(parsed.from)) {
              fromAddress = (parsed.from[0] as any)?.address || '';
            } else {
              fromAddress = (parsed.from as any)?.address || '';
            }
          }

          if (parsed.to) {
            if (Array.isArray(parsed.to)) {
              toAddress = (parsed.to[0] as any)?.address || '';
            } else {
              toAddress = (parsed.to as any)?.address || '';
            }
          }

          const allAddresses = `${fromAddress} ${toAddress}`.toLowerCase();

          // Get user's contacts
          const contacts = await this.contactRepository.find({
            where: { user_id: userId },
          });

          let matched = false;
          for (const contact of contacts) {
            const email = contact.primary_email?.toLowerCase() || '';
            if (email && allAddresses.includes(email)) {
              // Determine direction
              const isOutbound = toAddress.toLowerCase().includes(email);
              const direction = isOutbound ? 'outbound' : 'inbound';

              // Create log
              await this.create({
                workspaceId: contact.workspace_id || (await this.getDefaultWorkspace(userId)),
                contactId: contact.id,
                type: 'email',
                content: JSON.stringify({
                  subject: parsed.subject || '(no subject)',
                  body: parsed.text || parsed.html || '(no body)',
                  direction,
                  status: 'delivered',
                }),
              });
              success++;
              matched = true;
              break;
            }
          }

          if (!matched) {
            logger.warn('No contact match for email', { from: fromAddress, to: toAddress });
          }
        } catch (err) {
          logger.error('Error parsing email block', err);
          errors.push(`Failed to parse email: ${(err as Error).message}`);
        }
      }

      // Update last poll timestamp
      await this.settingsService.setSetting('user', userId.toString(), 'email_last_poll', new Date().toISOString());

      logger.info('Email polling completed', { success, errors: errors.length });
      return { success, errors };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error polling emails', err);
      throw new AppError('POLL_FAILED', 'Failed to poll emails', 500);
    }
  }

  async pollSMS(userId: number): Promise<{ success: number; errors: string[] }> {
    try {
      const errors: string[] = [];
      let success = 0;

      // Get Twilio config
      const twilioConfig = await this.settingsService.getSetting('user', userId.toString(), 'twilio_config');
      if (!twilioConfig || !twilioConfig.accountSid || !twilioConfig.authToken || !twilioConfig.fromNumber) {
        throw new AppError('NOT_CONFIGURED', 'Twilio not configured', 400);
      }

      // Get last poll timestamp
      const lastPollTimestamp = await this.settingsService.getSetting('user', userId.toString(), 'sms_last_poll');
      const lastPollDate = lastPollTimestamp ? new Date(lastPollTimestamp) : new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Create Twilio client
      const client = Twilio(twilioConfig.accountSid, twilioConfig.authToken);

      // Get user's contacts
      const contacts = await this.contactRepository.find({
        where: { user_id: userId },
      });

      // Query sent and received messages
      const messages = await client.messages.list({
        dateSentAfter: lastPollDate,
      });

      for (const message of messages) {
        try {
          // Normalize phone numbers
          const fromPhone = this.normalizePhone(message.from);
          const toPhone = this.normalizePhone(message.to);
          const configPhone = this.normalizePhone(twilioConfig.fromNumber);

          // Determine direction
          let direction = '';
          let messagePhone = '';
          if (fromPhone === configPhone) {
            direction = 'outbound';
            messagePhone = toPhone;
          } else if (toPhone === configPhone) {
            direction = 'inbound';
            messagePhone = fromPhone;
          } else {
            continue; // Not relevant
          }

          // Find matching contact
          let matched = false;
          for (const contact of contacts) {
            const phone = this.normalizePhone(contact.primary_phone || '');
            if (phone && phone === messagePhone) {
              // Create log
              await this.create({
                workspaceId: contact.workspace_id || (await this.getDefaultWorkspace(userId)),
                contactId: contact.id,
                type: 'text',
                content: JSON.stringify({
                  message: message.body,
                  direction,
                  status: message.status,
                }),
              });
              success++;
              matched = true;
              break;
            }
          }

          if (!matched) {
            logger.warn('No contact match for SMS', { phone: messagePhone });
          }
        } catch (err) {
          logger.error('Error processing SMS message', err);
          errors.push(`Failed to process message: ${(err as Error).message}`);
        }
      }

      // Update last poll timestamp
      await this.settingsService.setSetting('user', userId.toString(), 'sms_last_poll', new Date().toISOString());

      logger.info('SMS polling completed', { success, errors: errors.length });
      return { success, errors };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error polling SMS', err);
      throw new AppError('POLL_FAILED', 'Failed to poll SMS', 500);
    }
  }

  async logManual(data: ManualLogData, todoService?: TodoService): Promise<{ log: CommunicationLog; todo?: any }> {
    try {
      // Verify contact ownership
      const contact = await this.contactRepository.findOne({
        where: { id: data.contactId },
      });
      if (!contact || contact.user_id !== data.userId) {
        throw new AppError('FORBIDDEN', 'Not your contact', 403);
      }

      const workspaceId = contact.workspace_id || (await this.getDefaultWorkspace(data.userId));

      // Create log
      const log = await this.create({
        workspaceId,
        contactId: data.contactId,
        type: data.type,
        content: JSON.stringify(data.content),
      });

      // Create todo if requested
      let todo: any = undefined;
      if (data.createTodo && data.todoText && todoService) {
        todo = await todoService.create({
          contactId: data.contactId,
          workspaceId,
          text: data.todoText,
          dueDate: data.todoDueDate || null,
          createdBy: data.userId,
        });
      }

      return { log, todo };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error('Error logging manual communication', err);
      throw new AppError('DATABASE_ERROR', 'Failed to log communication', 500);
    }
  }

  private normalizePhone(phone: string): string {
    return phone.replace(/\D/g, '');
  }

  private async getDefaultWorkspace(userId: number): Promise<number> {
    const workspace = await this.workspaceRepository.findOne({
      where: { user_id: userId },
    });
    if (!workspace) {
      throw new AppError('NOT_FOUND', 'No workspace found for user', 404);
    }
    return workspace.id;
  }
}
