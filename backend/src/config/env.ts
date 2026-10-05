import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
});

export const env = EnvSchema.parse(process.env);