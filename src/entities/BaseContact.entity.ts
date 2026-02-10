import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Workspace } from './Workspace.entity';
import { User } from './User.entity';

@Entity('base_contacts')
export class BaseContact {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  user_id!: number;

  @Column('integer', { nullable: true })
  workspace_id!: number | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_on!: string;

  @Column('text', { nullable: true })
  first_name!: string | null;

  @Column('text', { nullable: true })
  last_name!: string | null;

  @Column('text', { nullable: true })
  primary_email!: string | null;

  @Column('text', { nullable: true })
  primary_phone!: string | null;

  @Column('text', { nullable: true })
  company!: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Workspace, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace | null;
}
