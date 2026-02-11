import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToOne, JoinColumn } from 'typeorm';
import { Campaign } from './Campaign.entity';
import { User } from './User.entity';

@Entity('campaign_approvals')
export class CampaignApproval {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  campaign_id!: number;

  @Column('text', { default: 'pending' })
  status!: 'pending' | 'approved' | 'rejected';

  @Column('integer', { nullable: true })
  reviewer_id!: number | null;

  @Column('text', { nullable: true })
  notes!: string | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { nullable: true })
  reviewed_at!: string | null;

  @OneToOne(() => Campaign, campaign => campaign.approval, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: Campaign;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer!: User | null;
}
