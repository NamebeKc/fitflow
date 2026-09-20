// src/app/(app)/layout.tsx
import { AuthGate } from "@/components/auth/AuthGate";
import { PaywallGate } from "@/components/billing/PaywallGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/**
 * Layout for the product itself.
 *
 * Everything that requires a signed-in user lives under this group:
 * dashboard, coach, log, profile. The gates, the navigation, and the
 * install prompt all belong here rather than at the root, so public
 * pages don't inherit them.
 *
 * Two gates, in order: AuthGate decides whether there is a user,
 * PaywallGate whether that user has paid. The sidebar sits BETWEEN
 * them deliberately — someone who hasn't subscribed still gets the
 * navigation, so the paywall reads as a step in the product rather
 * than a wall the app has become.
 */
export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AuthGate>
      <Sidebar />

      {/* Bottom padding clears the mobile tab bar AND the home
          indicator on gesture-navigation phones. */}
      <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0 md:pl-[76px] lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-5 md:px-8 md:py-10 lg:px-10">
          <PaywallGate>{children}</PaywallGate>
        </div>
      </main>

      {/* Only ever shown to signed-in users — asking a stranger to
          install before they've seen the product converts badly and
          burns the prompt permanently. */}
      <InstallPrompt />
    </AuthGate>
  );
}