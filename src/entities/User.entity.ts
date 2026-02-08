import { Entity, PrimaryColumn, Column } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn('text')
  id!: string;

  @Column('text', { unique: true })
  email!: string;

  @Column('text')
  password_hash!: string;

  @Column('text', { nullable: true })
  name!: string | null;

  @Column('text', { default: () => "CURRENT_TIMESTAMP" })
  created_at!: string;
}
