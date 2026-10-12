// src/components/marketing/SocialLinks.tsx
import { SOCIAL_PROFILES } from "@/lib/social";
import { cn } from "@/lib/utils";

interface SocialLinksProps {
  className?: string;
}

/**
 * ── SOCIAL PROFILE ROW ──────────────────────────────────────────────
 * Four marks, linked out, in the footer.
 *
 * NO BRAND COLOURS ON HOVER. The obvious treatment is to light each
 * icon up in its platform colour. It is wrong here for two reasons:
 * X's black is invisible on an obsidian footer, and four saturated
 * brand colours arriving at once turns a quiet footer into a toolbar
 * from 2011. They inherit the footer's own white/50 → white and the
 * lime focus ring, exactly like the text links beside them, so the row
 * reads as part of the site rather than as borrowed furniture.
 *
 * `rel="me"` alongside `noopener noreferrer`: the first is the
 * long-standing convention for "this profile is the same entity as
 * this site", and it pairs with the `sameAs` array in the structured
 * data. The other two are the security defaults any `target="_blank"`
 * needs.
 *
 * The 40px hit area is deliberate. The icon is 18px, which is a fine
 * size to look at and a poor size to hit with a thumb; WCAG 2.5.8 sets
 * 24×24 as the floor and these sit well clear of it.
 */
export function SocialLinks({ className }: SocialLinksProps) {
  return (
    <ul className={cn("flex items-center gap-1", className)}>
      {SOCIAL_PROFILES.map((profile) => (
        <li key={profile.id}>
          <a
            href={profile.href}
            target="_blank"
            rel="me noopener noreferrer"
            aria-label={profile.label}
            className="flex size-10 items-center justify-center rounded-full text-ink-muted outline-none transition-colors hover:bg-paper-sunken hover:text-ink focus-visible:ring-2 focus-visible:ring-moss"
          >
            <svg
              viewBox="0 0 24 24"
              className="size-[18px]"
              fill="currentColor"
              aria-hidden="true"
              focusable="false"
            >
              <path d={profile.path} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
