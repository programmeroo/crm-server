import { DataSource, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../entities/User.entity';
import { AppError } from '../errors/AppError';

const BCRYPT_ROUNDS = 10;

export class AuthService {
  private userRepo: Repository<User>;

  constructor(private dataSource: DataSource) {
    this.userRepo = dataSource.getRepository(User);
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) {
      throw new AppError('USER_EXISTS', 'A user with this email already exists', 409);
    }

    const user = new User();
    user.id = uuidv4();
    user.email = email;
    user.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    user.name = name || null;

    return this.userRepo.save(user);
  }

  async login(email: string, password: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    return user;
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }
}
