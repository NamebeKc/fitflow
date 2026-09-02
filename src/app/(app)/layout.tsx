// src/app/(app)/layout.tsx
import { AuthGate } from "@/components/auth/AuthGate";
import { Sidebar } from "@/components/layout/Sidebar";
import { InstallPrompt } from "@/components/pwa/InstallPrompt";

/**
 * Layout for the product itself.
 *
 * Everything that requires a signed-in user lives under this group:
 * dashboard, coach, log, profile. The gate, the navigation, and the
 * install prompt all belong here rather than at the root, so public
 * pages don't inherit them.
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
          {children}
        </div>
      </main>

      {/* Only ever shown to signed-in users — asking a stranger to
          install before they've seen the product converts badly and
          burns the prompt permanently. */}
      <InstallPrompt />
    </AuthGate>
  );
}