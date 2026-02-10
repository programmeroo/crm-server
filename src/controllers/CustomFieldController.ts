import { Router, Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { CustomFieldService } from '../services/CustomFieldService';
import { ContactService } from '../services/ContactService';
import { AppError } from '../errors/AppError';
import { requireLogin } from '../middlewares/requireLogin';

const createDefinitionSchema = Joi.object({
  workspaceId: Joi.number().integer().allow(null).optional(),
  fieldName: Joi.string().trim().required(),
  label: Joi.string().trim().required(),
  fieldType: Joi.string().valid('text', 'number', 'date', 'email', 'url', 'textarea').optional(),
  isRequired: Joi.number().integer().min(0).max(1).optional(),
  defaultValue: Joi.string().allow('', null).optional(),
});

const setFieldValuesSchema = Joi.object({
  fields: Joi.array().items(
    Joi.object({
      fieldName: Joi.string().required(),
      fieldValue: Joi.string().allow('', null).optional(),
      fieldType: Joi.string().valid('text', 'number', 'date', 'email', 'url', 'textarea').optional(),
    })
  ).required(),
});

export class CustomFieldController {
  public router: Router;

  constructor(
    private customFieldService: CustomFieldService,
    private contactService: ContactService
  ) {
    this.router = Router();
    this.router.use(requireLogin);

    // Field definitions
    this.router.get('/definitions', this.getDefinitions.bind(this));
    this.router.post('/definitions', this.createDefinition.bind(this));
    this.router.delete('/definitions/:id', this.deleteDefinition.bind(this));

    // Field values (per contact)
    this.router.get('/contacts/:contactId/fields', this.getFieldValues.bind(this));
    this.router.put('/contacts/:contactId/fields', this.setFieldValues.bind(this));
    this.router.delete('/contacts/:contactId/fields/:fieldName', this.deleteFieldValue.bind(this));
  }

  private async getDefinitions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId!;
      const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;

      const definitions = await this.customFieldService.getDefinitions(userId, workspaceId);
      res.json({ data: definitions, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async createDefinition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = createDefinitionSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      const definition = await this.customFieldService.createDefinition(userId, value);

      res.status(201).json({ data: definition, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async deleteDefinition(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId!;
      const id = Number(req.params.id);

      await this.customFieldService.deleteDefinition(id, userId);
      res.json({ data: { message: 'Field definition deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async getFieldValues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId!;
      const contactId = Number(req.params.contactId);

      // Verify contact belongs to user
      const contact = await this.contactService.findById(contactId, userId);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      const fields = await this.customFieldService.getFieldValues(contactId);
      res.json({ data: fields, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async setFieldValues(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { error, value } = setFieldValuesSchema.validate(req.body);
      if (error) {
        throw new AppError('VALIDATION_ERROR', error.details[0].message, 400);
      }

      const userId = (req.session as any).userId!;
      const contactId = Number(req.params.contactId);

      // Verify contact belongs to user
      const contact = await this.contactService.findById(contactId, userId);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      const fields = await this.customFieldService.setFieldValues(contactId, value.fields);
      res.json({ data: fields, error: null });
    } catch (err) {
      next(err);
    }
  }

  private async deleteFieldValue(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req.session as any).userId!;
      const contactId = Number(req.params.contactId);
      const fieldName = req.params.fieldName as string;

      // Verify contact belongs to user
      const contact = await this.contactService.findById(contactId, userId);
      if (!contact) {
        throw new AppError('NOT_FOUND', 'Contact not found', 404);
      }

      await this.customFieldService.deleteFieldValue(contactId, fieldName);
      res.json({ data: { message: 'Field value deleted' }, error: null });
    } catch (err) {
      next(err);
    }
  }
}
