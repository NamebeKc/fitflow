// src/app/(legal)/layout.tsx

/**
 * Layout for public policy pages.
 *
 * Intentionally a pass-through. `LegalPage` supplies its own header
 * and footer, and nothing here may depend on authentication — these
 * documents have to be readable by anyone, including someone deciding
 * whether to sign up at all.
 */
export default function LegalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}