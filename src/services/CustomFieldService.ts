import { DataSource, Repository, IsNull } from 'typeorm';
import { CustomField } from '../entities/CustomField.entity';
import { CustomFieldDefinition } from '../entities/CustomFieldDefinition.entity';
import { AppError } from '../errors/AppError';

export class CustomFieldService {
  private customFieldRepo: Repository<CustomField>;
  private definitionRepo: Repository<CustomFieldDefinition>;

  constructor(private dataSource: DataSource) {
    this.customFieldRepo = dataSource.getRepository(CustomField);
    this.definitionRepo = dataSource.getRepository(CustomFieldDefinition);
  }

  // Get field definitions for a user (user-global + workspace-specific)
  async getDefinitions(userId: number, workspaceId?: number): Promise<CustomFieldDefinition[]> {
    const query = this.definitionRepo.createQueryBuilder('def')
      .where('def.user_id = :userId', { userId })
      .andWhere('(def.workspace_id IS NULL OR def.workspace_id = :workspaceId)', { workspaceId: workspaceId || null })
      .orderBy('def.label', 'ASC');

    return query.getMany();
  }

  // Create a new field definition
  async createDefinition(userId: number, data: {
    workspaceId?: number | null;
    fieldName: string;
    label: string;
    fieldType?: string;
    isRequired?: number;
    defaultValue?: string | null;
  }): Promise<CustomFieldDefinition> {
    // Check for duplicate field name
    const whereClause: any = {
      user_id: userId,
      field_name: data.fieldName,
    };

    if (data.workspaceId) {
      whereClause.workspace_id = data.workspaceId;
    } else {
      whereClause.workspace_id = IsNull();
    }

    const existing = await this.definitionRepo.findOne({ where: whereClause });

    if (existing) {
      throw new AppError('DUPLICATE_FIELD', 'A field with this name already exists', 409);
    }

    const definition = this.definitionRepo.create({
      user_id: userId,
      workspace_id: data.workspaceId || null,
      field_name: data.fieldName,
      label: data.label,
      field_type: data.fieldType || 'text',
      is_required: data.isRequired || 0,
      default_value: data.defaultValue || null,
    });

    return this.definitionRepo.save(definition);
  }

  // Get all field values for a contact
  async getFieldValues(contactId: number): Promise<CustomField[]> {
    return this.customFieldRepo.find({
      where: { contact_id: contactId },
      order: { field_name: 'ASC' },
    });
  }

  // Get a single field value
  async getFieldValue(contactId: number, fieldName: string): Promise<CustomField | null> {
    return this.customFieldRepo.findOne({
      where: { contact_id: contactId, field_name: fieldName },
    });
  }

  // Set a field value (create or update)
  async setFieldValue(contactId: number, fieldName: string, fieldValue: string | null, fieldType: string = 'text'): Promise<CustomField> {
    let field = await this.customFieldRepo.findOne({
      where: { contact_id: contactId, field_name: fieldName },
    });

    if (field) {
      // Update existing
      field.field_value = fieldValue;
      field.field_type = fieldType;
      field.updated_at = new Date().toISOString();
    } else {
      // Create new
      field = this.customFieldRepo.create({
        contact_id: contactId,
        field_name: fieldName,
        field_value: fieldValue,
        field_type: fieldType,
      });
    }

    return this.customFieldRepo.save(field);
  }

  // Set multiple field values at once
  async setFieldValues(contactId: number, values: { fieldName: string; fieldValue: string | null; fieldType?: string }[]): Promise<CustomField[]> {
    const results: CustomField[] = [];

    for (const { fieldName, fieldValue, fieldType } of values) {
      const field = await this.setFieldValue(contactId, fieldName, fieldValue, fieldType || 'text');
      results.push(field);
    }

    return results;
  }

  // Delete a field value
  async deleteFieldValue(contactId: number, fieldName: string): Promise<void> {
    await this.customFieldRepo.delete({ contact_id: contactId, field_name: fieldName });
  }

  // Delete a field definition
  async deleteDefinition(id: number, userId: number): Promise<void> {
    const definition = await this.definitionRepo.findOne({ where: { id } });

    if (!definition) {
      throw new AppError('NOT_FOUND', 'Field definition not found', 404);
    }

    if (definition.user_id !== userId) {
      throw new AppError('FORBIDDEN', 'You do not have permission to delete this field definition', 403);
    }

    await this.definitionRepo.delete({ id });
  }
}
