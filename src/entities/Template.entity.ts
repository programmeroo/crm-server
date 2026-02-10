import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Workspace } from './Workspace.entity';

@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  workspace_id!: number;

  @Column('text')
  name!: string;

  @Column('text', { default: 'html' })
  template_type!: 'html' | 'text' | 'mixed';

  @Column('text', { nullable: true })
  subject!: string | null;

  @Column('text')
  body!: string;

  @Column('text', { nullable: true })
  preheader!: string | null;

  @Column('text', { nullable: true })
  signature!: string | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  updated_at!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;
}
