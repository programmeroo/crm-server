import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { nullable: true })
  user_id!: string | null;

  @Column('text')
  action!: string;

  @Column('text', { nullable: true })
  entity_type!: string | null;

  @Column('text', { nullable: true })
  entity_id!: string | null;

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
