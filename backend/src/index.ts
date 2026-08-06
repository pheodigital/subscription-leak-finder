import Fastify from "fastify";
import * as dotenv from "dotenv";
import { extractSubscriptionFromEmail } from "./services/ollama.js";

import cors from "@fastify/cors";

import { desc, asc, eq } from "drizzle-orm";

import { db } from "./db/client.js";
import { subscriptions } from "./db/schema.js";

dotenv.config();

// Create the Fastify server instance
// logger: true gives us readable request logs in the terminal — essential for debugging, even in dev
const fastify = Fastify({
  logger: true,
});

// Enable CORS so our Next.js frontend (different port = different origin) can call this API.
// In production, we'll restrict this to our actual deployed frontend URL instead of allowing all origins.
await fastify.register(cors, {
  origin:
    process.env.NODE_ENV === "production"
      ? "https://your-production-domain.com" // placeholder — we'll set this correctly in Phase 6
      : "http://localhost:3000", // allow only our local Next.js dev server
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

fastify.get("/subscriptions", async (request, reply) => {
  const { category, sortBy } = request.query as {
    category?: string;
    sortBy?: "renewalDate" | "amount" | "createdAt";
  };

  // Build the query conditionally based on whether a category filter was passed
  let query = db.select().from(subscriptions);

  if (category) {
    query = query.where(eq(subscriptions.category, category)) as typeof query;
  }

  // Default sort: soonest renewal first. Falls back to createdAt if no renewal date logic needed.
  const sortColumn =
    sortBy === "amount"
      ? subscriptions.amount
      : sortBy === "createdAt"
        ? subscriptions.createdAt
        : subscriptions.renewalDate;

  const result = await query.orderBy(asc(sortColumn));

  return { count: result.length, subscriptions: result };
});

const extractSchema = {
  body: {
    type: "object",
    required: ["emailText"],
    properties: {
      emailText: { type: "string", minLength: 1 },
    },
  },
};

fastify.post("/extract", { schema: extractSchema }, async (request, reply) => {
  const { emailText } = request.body as { emailText: string };

  try {
    const extracted = await extractSubscriptionFromEmail(emailText);
    return extracted;
  } catch (err) {
    fastify.log.error(err);
    reply.code(422); // 422 = Unprocessable Entity — request was valid, but we couldn't extract usable data
    return {
      error: "Extraction failed",
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
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
