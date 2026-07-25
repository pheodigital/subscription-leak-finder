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

  if (loading) return <main className="p-8">Loading subscriptions...</main>;
  if (error) return <main className="p-8 text-red-600">Error: {error}</main>;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Subscription Leak Finder</h1>

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
