import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseContact } from './BaseContact.entity';
import { ContactList } from './ContactList.entity';

@Entity('contact_list_assignments')
export class ContactListAssignment {
  @PrimaryColumn('integer')
  contact_id!: number;

  @PrimaryColumn('integer')
  list_id!: number;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  assigned_at!: string;

  @Column('integer', { default: 0 })
  is_primary!: number;

  @ManyToOne(() => BaseContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: BaseContact;

  @ManyToOne(() => ContactList, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'list_id' })
  list!: ContactList;
}
