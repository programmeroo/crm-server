import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  user_id!: string;

  @Column('text')
  name!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
