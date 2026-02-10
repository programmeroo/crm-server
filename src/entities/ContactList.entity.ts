import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Workspace } from './Workspace.entity';

@Entity('contact_lists')
export class ContactList {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  workspace_id!: number;

  @Column('text')
  name!: string;

  @Column('integer', { default: 0 })
  is_primary!: number;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;
}
