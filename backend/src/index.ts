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

// Schema defines what a valid request body looks like.
// Fastify validates incoming requests against this automatically —
// invalid requests get rejected with a 400 before our handler even runs.
const createSubscriptionSchema = {
  body: {
    type: "object",
    required: ["merchant", "amount"],
    properties: {
      merchant: { type: "string", minLength: 1 },
      amount: { type: "number", minimum: 0 },
      currency: { type: "string", default: "USD" },
      renewalDate: { type: "string", nullable: true }, // expects "YYYY-MM-DD"
      billingCycle: { type: "string", nullable: true }, // "monthly" | "yearly" | "weekly"
      category: { type: "string", nullable: true },
    },
  },
};

fastify.post(
  "/subscriptions",
  { schema: createSubscriptionSchema },
  async (request, reply) => {
    const { merchant, amount, currency, renewalDate, billingCycle, category } =
      request.body as {
        merchant: string;
        amount: number;
        currency?: string;
        renewalDate?: string;
        billingCycle?: string;
        category?: string;
      };

    // Insert into Postgres via Drizzle.
    // .returning() gives us back the row that was just created, including its generated id.
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        merchant,
        amount: amount.toString(), // Drizzle's numeric type expects a string input
        currency: currency ?? "USD",
        renewalDate: renewalDate ?? null,
        billingCycle: billingCycle ?? null,
        category: category ?? null,
        source: "manual", // this endpoint is always manual entry
      })
      .returning();

    reply.code(201); // 201 = Created, correct HTTP status for a successful POST
    return newSubscription;
  },
);

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
