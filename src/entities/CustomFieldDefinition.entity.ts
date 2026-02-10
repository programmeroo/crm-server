import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './User.entity';
import { Workspace } from './Workspace.entity';

@Entity('custom_field_definitions')
export class CustomFieldDefinition {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('integer')
  user_id!: number;

  @Column('integer', { nullable: true })
  workspace_id!: number | null;

  @Column('text')
  field_name!: string;

  @Column('text')
  label!: string;

  @Column('text', { default: 'text' })
  field_type!: string;

  @Column('integer', { default: 0 })
  is_required!: number;

  @Column('text', { nullable: true })
  default_value!: string | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace | null;
}
