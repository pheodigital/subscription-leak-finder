import Fastify from "fastify";
import * as dotenv from "dotenv";

import { db } from "./db/client";
import { subscriptions } from "./db/schema";

dotenv.config();

// Create the Fastify server instance
// logger: true gives us readable request logs in the terminal — essential for debugging, even in dev
const fastify = Fastify({
  logger: true,
});

// Health check route — confirms the server is alive and responding
// Convention: GET /health, returns 200 with a simple status payload
fastify.get("/health", async (request, reply) => {
  return { status: "ok", timestamp: new Date().toISOString() };
});

// Temporary test route — confirms Fastify can actually talk to Neon via Drizzle
// We'll replace this with real CRUD routes in the next step
fastify.get("/db-test", async (request, reply) => {
  const result = await db.select().from(subscriptions);
  return { count: result.length, rows: result };
});

// Start the server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;
    await fastify.listen({ port, host: "0.0.0.0" });
    // host: "0.0.0.0" (not "localhost") matters later —
    // Docker/Railway containers need this to accept connections from outside the container
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
