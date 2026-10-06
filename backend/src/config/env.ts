import dotenv from 'dotenv';
import { EnvSchema } from './env-schema.js';

dotenv.config();
export const env = EnvSchema.parse(process.env);
