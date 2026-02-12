import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('system_settings')
@Index(['scope', 'scope_id', 'setting_key'], { unique: true })
export class SystemSettings {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column('text')
  scope!: 'global' | 'user' | 'workspace';

  @Column('text', { nullable: true })
  scope_id!: string | null; // user_id or workspace_id as string

  @Column('text')
  setting_key!: string;

  @Column('text')
  setting_value!: string; // JSON string

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  updated_at!: string;
}
