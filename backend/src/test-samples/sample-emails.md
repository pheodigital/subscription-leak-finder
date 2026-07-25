# Extraction Test Samples

This file documents the test cases used to validate the `/extract` endpoint
(Fastify → Ollama → qwen3:4b). Re-run these whenever the extraction prompt
in `backend/src/services/ollama.ts` changes, to confirm nothing regressed.

**How to re-run a test case:**

```bash
curl -X POST http://localhost:4000/extract \
  -H "Content-Type: application/json" \
  -d '{"emailText": "<paste the email text here>"}'
```

---

## Test 1 — Yearly billing, different phrasing

**Input:**

```
Thank you for your Adobe Creative Cloud purchase. Your annual plan ($599.88/year)
has been renewed. Your subscription will automatically renew again on
January 10, 2027 unless cancelled.
```

**Expected:** `billingCycle: "yearly"`, `renewalDate: "2027-01-10"`, `amount: 599.88`

**Actual output (2026-07-25):**

```json
{
  "merchant": "Adobe Creative Cloud",
  "amount": 599.88,
  "currency": "USD",
  "renewalDate": "2027-01-10",
  "billingCycle": "yearly",
  "category": null
}
```

**Result:** ✅ Pass — correctly parsed yearly billing despite non-standard phrasing ("annual plan", "automatically renew again on").

---

## Test 2 — Messy real-world formatting (marketing fluff + emoji)

**Input:**

```
Hey there! 🎉 Just a heads up — your Spotify Premium payment of $11.99 went
through today. Enjoy unlimited music! Questions? Visit our help center.
Next charge: Sept 2, 2026.
```

**Expected:** correctly ignores emoji/marketing text, `renewalDate: "2026-09-02"`

**Actual output (2026-07-25):**

```json
{
  "merchant": "Spotify",
  "amount": 11.99,
  "currency": "USD",
  "renewalDate": "2026-09-02",
  "billingCycle": "monthly",
  "category": null
}
```

**Result:** ✅ Pass — emoji and marketing copy correctly ignored, core data extracted cleanly.

---

## Test 3 — Ambiguous / missing renewal date (tests null-handling)

**Input:**

```
Your payment of $8.99 to Audible was successful. Thanks for being a member!
```

**Expected:** `renewalDate: null`, `billingCycle: null` — should NOT guess a date that isn't present.

**Actual output (2026-07-25):**

```json
{
  "merchant": "Audible",
  "amount": 8.99,
  "currency": "USD",
  "renewalDate": null,
  "billingCycle": null,
  "category": null
}
```

**Result:** ✅ Pass — correctly returned `null` instead of hallucinating a renewal date.

---

## Test 4 — Non-subscription email (tests hallucination guard rail)

**Input:**

```
Hi, just checking in about the project deadline next week. Let me know if
you need anything from my end.
```

**Expected:** should NOT invent a fake subscription. Either `merchant`/`amount`
come back empty/null, or the endpoint fails gracefully.

**Actual output (2026-07-25):**

```json
{
  "error": "Extraction failed",
  "message": "Extracted data missing required fields: {\"merchant\":\"unknown\",\"amount\":null,\"currency\":\"unknown\",\"renewalDate\":null,\"billingCycle\":null,\"category\":null}"
}
```

(HTTP 422)

**Result:** ✅ Pass — model did not hallucinate a fake subscription. Our backend
validation (`!parsed.merchant || typeof parsed.amount !== "number"`) correctly
caught the empty result and returned a `422` instead of silently inserting
garbage data into the database. This is the most important test case — it
proves the pipeline fails safely on unattended/automated runs (n8n).

---

## Test 0 — Baseline (clean, well-structured email)

**Input:**

```
Your Netflix subscription renewed. You were charged $15.99 on July 15, 2026.
Your next billing date is August 15, 2026.
```

**Expected:** `renewalDate` should be the FUTURE billing date (Aug 15), not the
past charge date (Jul 15) — this required a prompt fix (see notes below).

**Actual output (2026-07-25):**

```json
{
  "merchant": "Netflix",
  "amount": 15.99,
  "currency": "USD",
  "renewalDate": "2026-08-15",
  "billingCycle": "monthly",
  "category": null
}
```

**Result:** ✅ Pass (after prompt fix).

**Note:** The initial prompt version incorrectly picked the _past charge date_
(2026-07-15) instead of the _next renewal date_ (2026-08-15). Fixed by adding
this explicit rule to the prompt:

> "renewalDate must be the NEXT upcoming billing/renewal date — NOT the date
> the email says you were already charged. If the email mentions both a past
> charge date and a future renewal date, use only the future one."

---

## Summary

| Test | Scenario                                         | Result                     |
| ---- | ------------------------------------------------ | -------------------------- |
| 0    | Clean email, past vs. future date disambiguation | ✅ Pass (after prompt fix) |
| 1    | Yearly billing, non-standard phrasing            | ✅ Pass                    |
| 2    | Marketing fluff + emoji                          | ✅ Pass                    |
| 3    | Missing renewal date (null-handling)             | ✅ Pass                    |
| 4    | Non-subscription email (hallucination guard)     | ✅ Pass                    |

All 5 cases pass as of 2026-07-25 using `qwen3:4b` with `think: false`.
