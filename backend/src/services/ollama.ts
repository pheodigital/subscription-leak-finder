const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "qwen3:4b";

// Builds the extraction prompt for a given raw email text.
// Kept as its own function so we can iterate on prompt wording in one place.
function buildExtractionPrompt(emailText: string): string {
  return `You are a data extraction assistant. Extract subscription information from the email below and respond with ONLY a JSON object, no other text.

Required JSON shape:
{
  "merchant": string,
  "amount": number,
  "currency": string,
  "renewalDate": string or null (format YYYY-MM-DD),
  "billingCycle": "monthly" | "yearly" | "weekly" | null,
  "category": string or null
}

Rules:
- If you cannot confidently determine a field, use null (except merchant and amount, which are required).
- amount must be a plain number, no currency symbols.
- renewalDate must be the NEXT upcoming billing/renewal date — NOT the date the email says you were already charged. If the email mentions both a past charge date and a future renewal date, use only the future one.
- Do not invent information not present in the email.

Email:
"""
${emailText}
"""`;
}

// Shape of what we expect back after successful extraction
export type ExtractedSubscription = {
  merchant: string;
  amount: number;
  currency: string;
  renewalDate: string | null;
  billingCycle: "monthly" | "yearly" | "weekly" | null;
  category: string | null;
};

// Calls Ollama and returns parsed, structured subscription data.
// Throws a descriptive error if the model output can't be parsed as valid JSON.
export async function extractSubscriptionFromEmail(
  emailText: string,
): Promise<ExtractedSubscription> {
  const controller = new AbortController();
  // Abort after 30s — local models can occasionally hang; we don't want a stuck request forever
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let ollamaResponse: Response;

  try {
    ollamaResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        format: "json",
        stream: false,
        think: false, // qwen3 is a reasoning model — this forces the answer into `response`, not `thinking`
        prompt: buildExtractionPrompt(emailText),
      }),
      signal: controller.signal,
    });
  } catch (error) {
    throw new Error("Failed to reach Ollama server. Is it running?");
  } finally {
    clearTimeout(timeout);
  }

  if (!ollamaResponse.ok) {
    throw new Error(`Ollama request failed: ${ollamaResponse.status}`);
  }

  const data = await ollamaResponse.json();

  // Defensive fallback: prefer `response`, but fall back to `thinking`
  // in case a model/version puts the answer there instead (as we saw during testing)
  const rawText = data.response?.trim() || data.thinking?.trim() || "";

  if (!rawText) {
    throw new Error("Ollama returned an empty response");
  }

  let parsed: ExtractedSubscription;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`Failed to parse model output as JSON: ${rawText}`);
  }

  // Basic sanity check on required fields before we trust this data
  if (!parsed.merchant || typeof parsed.amount !== "number") {
    throw new Error(
      `Extracted data missing required fields: ${JSON.stringify(parsed)}`,
    );
  }

  return parsed;
}
