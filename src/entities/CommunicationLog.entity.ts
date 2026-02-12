import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './Workspace.entity';
import { BaseContact } from './BaseContact.entity';

@Entity('communication_logs')
export class CommunicationLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  workspace_id!: number;

  @Column('integer')
  contact_id!: number;

  @Column('text')
  type!: 'email' | 'text' | 'call' | 'ai' | 'stage_change' | 'note' | 'system';

  @Column('text')
  content!: string; // JSON string

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  timestamp!: string;

  @Column('text', { nullable: true })
  status!: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @ManyToOne(() => BaseContact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact!: BaseContact;
}
