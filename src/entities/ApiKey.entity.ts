import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('api_keys')
export class ApiKey {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  user_id!: number;

  @Column('text', { unique: true })
  key!: string;

  @Column('text', { nullable: true })
  description!: string | null;

  @Column('text')
  scopes!: string; // JSON array stored as text

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { nullable: true })
  expires_at!: string | null;

  @Column('integer', { default: 1 })
  is_active!: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
