import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config();
export default defineConfig({
    schema: "./src/db/schema.ts", // where our table definitions live
    out: "./drizzle", // where generated SQL migrations will be saved
    dialect: "postgresql",
    dbCredentials: {
        url: process.env.DATABASE_URL,
    },
});
//# sourceMappingURL=drizzle.config.js.map