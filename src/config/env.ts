import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '3000', 10),
  dbPath: process.env.DB_PATH || './data/pi-crm.db',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  nodeEnv: process.env.NODE_ENV || 'development',
  isTest: process.env.NODE_ENV === 'test',
  isProduction: process.env.NODE_ENV === 'production',
  aiProvider: process.env.AI_PROVIDER || 'openai',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4-turbo',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_AI_MODEL || 'gemini-pro',
  grokApiKey: process.env.GROK_API_KEY || '',
  grokModel: process.env.GROK_AI_MODEL || 'grok-beta',
};
