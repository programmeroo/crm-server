import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  user_id!: number;

  @Column('text')
  name!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
