import 'dotenv/config';
import { z } from "zod";

const envSchema = z.object({
	// Redis
	REDIS_HOST: z.string().min(1).default("localhost"),

	REDIS_PORT: z.string().min(1).default("6379"),

	// Cloudflare SFU
	CF_APP_ID: z.string().min(1),
	CF_CALL_API_TOKEN: z.string().min(1),
	TURN_TOKEN: z.string().min(1),
	TURN_API_KEY: z.string().min(1),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
