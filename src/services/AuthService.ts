import { DataSource, Repository } from 'typeorm';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../entities/User.entity';
import { ApiKey } from '../entities/ApiKey.entity';
import { AppError } from '../errors/AppError';

const BCRYPT_ROUNDS = 10;

export class AuthService {
  private userRepo: Repository<User>;
  private apiKeyRepo: Repository<ApiKey>;

  constructor(private dataSource: DataSource) {
    this.userRepo = dataSource.getRepository(User);
    this.apiKeyRepo = dataSource.getRepository(ApiKey);
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

  // --- API Key Management ---

  async generateApiKey(
    userId: string,
    description: string,
    scopes: string[],
    expiresInDays?: number
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new AppError('NOT_FOUND', 'User not found', 404);
    }

    const rawKey = uuidv4();
    const apiKey = new ApiKey();
    apiKey.id = uuidv4();
    apiKey.user_id = userId;
    apiKey.key = rawKey;
    apiKey.description = description || null;
    apiKey.scopes = JSON.stringify(scopes);
    apiKey.is_active = 1;

    if (expiresInDays) {
      const expires = new Date();
      expires.setDate(expires.getDate() + expiresInDays);
      apiKey.expires_at = expires.toISOString();
    } else {
      apiKey.expires_at = null;
    }

    const saved = await this.apiKeyRepo.save(apiKey);
    return { apiKey: saved, rawKey };
  }

  async validateApiKey(key: string): Promise<{ user: User; scopes: string[] }> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { key },
      relations: ['user'],
    });

    if (!apiKey) {
      throw new AppError('INVALID_API_KEY', 'Invalid API key', 401);
    }

    if (!apiKey.is_active) {
      throw new AppError('API_KEY_REVOKED', 'API key has been revoked', 401);
    }

    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      throw new AppError('API_KEY_EXPIRED', 'API key has expired', 401);
    }

    return {
      user: apiKey.user,
      scopes: JSON.parse(apiKey.scopes) as string[],
    };
  }

  async revokeApiKey(keyId: string, userId: string): Promise<void> {
    const apiKey = await this.apiKeyRepo.findOne({
      where: { id: keyId, user_id: userId },
    });

    if (!apiKey) {
      throw new AppError('NOT_FOUND', 'API key not found', 404);
    }

    apiKey.is_active = 0;
    await this.apiKeyRepo.save(apiKey);
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    return this.apiKeyRepo.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }
}
