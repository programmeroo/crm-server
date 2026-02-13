import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('ai_insights')
export class AIInsight {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  user_id!: number;

  @Column('text')
  type!: string; // 'Optimization' | 'Income Idea' | 'Pattern Recognition' | 'Anomaly' | 'Recommendation' | 'Risk'

  @Column('text')
  content!: string;

  @Column('real', { default: 0.5 })
  confidence!: number;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { nullable: true })
  dismissed_at!: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
