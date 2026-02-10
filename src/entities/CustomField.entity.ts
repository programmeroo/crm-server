import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseContact } from './BaseContact.entity';

@Entity('custom_fields')
export class CustomField {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  contact_id!: number;

  @Column('text')
  field_name!: string;

  @Column('text', { nullable: true })
  field_value!: string | null;

  @Column('text', { default: 'text' })
  field_type!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  updated_at!: string;

  @ManyToOne(() => BaseContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: BaseContact;
}
