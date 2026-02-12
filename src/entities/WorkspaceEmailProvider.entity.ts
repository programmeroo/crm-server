import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Workspace } from './Workspace.entity';

@Entity('workspace_email_providers')
export class WorkspaceEmailProvider {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer', { unique: true })
  workspace_id!: number;

  @Column('text')
  provider_type!: 'mailgun' | 'google_workspace' | 'microsoft_365';

  @Column('text')
  config_json!: string; // JSON: { api_key } or { client_id, client_secret, refresh_token }

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  updated_at!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;
}
