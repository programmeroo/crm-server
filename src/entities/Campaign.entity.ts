import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne } from 'typeorm';
import { Workspace } from './Workspace.entity';
import { Template } from './Template.entity';
import { CampaignApproval } from './CampaignApproval.entity';

@Entity('campaigns')
export class Campaign {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  workspace_id!: number;

  @Column('text')
  name!: string;

  @Column('text')
  type!: 'one-off' | 'scheduled' | 'drip';

  @Column('integer', { nullable: true })
  template_id!: number | null;

  @Column('text', { nullable: true })
  segment_json!: string | null;

  @Column('text', { nullable: true })
  schedule_json!: string | null;

  @Column('text', { default: 'draft' })
  status!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  updated_at!: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @ManyToOne(() => Template, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'template_id' })
  template!: Template | null;

  @OneToOne(() => CampaignApproval, approval => approval.campaign, { eager: true })
  approval!: CampaignApproval | undefined;
}
