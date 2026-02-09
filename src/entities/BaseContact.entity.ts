import { Entity, PrimaryColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Workspace } from './Workspace.entity';

@Entity('base_contacts')
export class BaseContact {
  @PrimaryColumn('text')
  id!: string;

  @Column('text')
  workspace_id!: string;

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

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace!: Workspace;
}
