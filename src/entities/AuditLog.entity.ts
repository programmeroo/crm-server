import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer', { nullable: true })
  user_id!: number | null;

  @Column('text')
  action!: string;

  @Column('text', { nullable: true })
  entity_type!: string | null;

  @Column('integer', { nullable: true })
  entity_id!: number | null;

  @Column('text', { nullable: true })
  details!: string | null;

  @Column('text', { nullable: true })
  ip_address!: string | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  timestamp!: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;
}
