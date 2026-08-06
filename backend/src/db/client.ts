import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as dotenv from "dotenv";
import * as schema from "./schema.js";

dotenv.config();

// neon() creates the low-level HTTP connection to your Neon database
// drizzle() wraps it with our schema, giving us type-safe query methods
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
