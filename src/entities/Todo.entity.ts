import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseContact } from './BaseContact.entity';
import { Workspace } from './Workspace.entity';
import { User } from './User.entity';

@Entity('todos')
export class Todo {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer', { nullable: true })
  contact_id!: number | null;

  @Column('integer')
  workspace_id!: number;

  @Column('text')
  text!: string;

  @Column('text', { nullable: true })
  due_date!: string | null; // ISO datetime string

  @Column('integer', { default: 0 })
  is_complete!: number; // 0 or 1

  @Column('integer')
  created_by!: number;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @ManyToOne(() => BaseContact, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact!: BaseContact | null;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  user!: User;
}
