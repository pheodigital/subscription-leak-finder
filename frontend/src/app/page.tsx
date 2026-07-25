"use client";

import { useEffect, useState } from "react";

// Type describing what one subscription row looks like.
// Mirrors our backend schema — keeping frontend/backend shapes in sync manually for now.
// (In a larger app, we'd share this type between frontend/backend via a shared package.)
type Subscription = {
  id: number;
  merchant: string;
  amount: string; // comes back as a string from Postgres numeric type
  currency: string;
  renewalDate: string | null;
  billingCycle: string | null;
  category: string | null;
  source: string;
  createdAt: string;
};

// Normalizes any billing cycle into an equivalent monthly cost.
// Subscriptions with unknown/missing billing cycles are excluded from the total
// (better to omit than silently guess and mislead the user).
function toMonthlyAmount(sub: Subscription): number | null {
  const amount = parseFloat(sub.amount);
  if (isNaN(amount)) return null;

  switch (sub.billingCycle) {
    case "monthly":
      return amount;
    case "yearly":
      return amount / 12;
    case "weekly":
      return amount * 4.33;
    default:
      return null; // unknown cycle — don't guess
  }
}

export default function DashboardPage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSubscriptions() {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/subscriptions`,
        );
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = await res.json();
        setSubscriptions(data.subscriptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchSubscriptions();
  }, []);

  // Derived stats — computed from the subscriptions already in memory, no extra fetch needed
  const monthlyAmounts = subscriptions
    .map(toMonthlyAmount)
    .filter((n): n is number => n !== null);
  const totalMonthlyBurn = monthlyAmounts.reduce((sum, n) => sum + n, 0);
  const excludedCount = subscriptions.length - monthlyAmounts.length;

  const activeCount = subscriptions.length;

  const nextRenewal = subscriptions
    .filter((s) => s.renewalDate)
    .sort(
      (a, b) =>
        new Date(a.renewalDate!).getTime() - new Date(b.renewalDate!).getTime(),
    )[0];

  if (loading) return <main className="p-8">Loading subscriptions...</main>;
  if (error) return <main className="p-8 text-red-600">Error: {error}</main>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Leak Finder</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="border border-gray-300 rounded-lg p-4">
          <p className="text-sm text-gray-500">Total Monthly Burn</p>
          <p className="text-2xl font-bold">${totalMonthlyBurn.toFixed(2)}</p>
          {excludedCount > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              ({excludedCount} subscription{excludedCount > 1 ? "s" : ""}{" "}
              excluded — unknown billing cycle)
            </p>
          )}
        </div>

        <div className="border border-gray-300 rounded-lg p-4">
          <p className="text-sm text-gray-500">Active Subscriptions</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>

        <div className="border border-gray-300 rounded-lg p-4">
          <p className="text-sm text-gray-500">Next Renewal</p>
          <p className="text-2xl font-bold">
            {nextRenewal
              ? `${nextRenewal.merchant} — ${nextRenewal.renewalDate}`
              : "—"}
          </p>
        </div>
      </div>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border border-gray-300 px-4 py-2 text-left">
              Merchant
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Amount
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Renewal Date
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Billing Cycle
            </th>
            <th className="border border-gray-300 px-4 py-2 text-left">
              Category
            </th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((sub) => (
            <tr key={sub.id}>
              <td className="border border-gray-300 px-4 py-2">
                {sub.merchant}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {sub.currency} {sub.amount}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {sub.renewalDate ?? "—"}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {sub.billingCycle ?? "—"}
              </td>
              <td className="border border-gray-300 px-4 py-2">
                {sub.category ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {subscriptions.length === 0 && (
        <p className="mt-4 text-gray-500">No subscriptions yet.</p>
      )}
    </main>
  );
}
