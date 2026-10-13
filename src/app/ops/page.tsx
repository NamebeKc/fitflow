// src/app/ops/page.tsx
"use client";

import { AuthGate } from "@/components/auth/AuthGate";
import { OpsDashboard } from "@/components/ops/OpsDashboard";

/**
 * The operations dashboard.
 *
 * DELIBERATELY OUTSIDE THE `(app)` ROUTE GROUP. That group carries
 * `PaywallGate` and the product navigation; neither belongs here. An
 * admin screen behind a paywall is a bug waiting for the day the
 * founder's own subscription lapses, and putting ops in the tab bar
 * invites a customer to find it.
 *
 * `AuthGate` is still needed — the API authenticates by uid, so the
 * page needs a signed-in user before it can ask anything. The real
 * authorisation is `OPS_UIDS`, server-side, and a signed-in stranger
 * gets a 404 from the route rather than a hint that it exists.
 *
 * There is no link to this page anywhere in the product. That is not
 * the security boundary — the allowlist is — but an unlinked route is
 * one fewer thing to explain.
 */
export default function OpsPage() {
  return (
    <AuthGate>
      <main className="min-h-dvh bg-paper">
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-10 lg:py-12">
          <OpsDashboard />
        </div>
      </main>
    </AuthGate>
  );
}
