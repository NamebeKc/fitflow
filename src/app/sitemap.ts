// src/app/sitemap.ts
import type { MetadataRoute } from "next";

import { GUIDES } from "@/content/guides";
import { absoluteUrl } from "@/lib/site";

/**
 * Only pages a stranger can actually read are listed.
 *
 * A sitemap is a set of claims that these URLs are worth fetching. An
 * app route behind auth is not, and listing one trains a crawler to
 * discount the file.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: absoluteUrl("/guides"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    // Generated from the registry, so a new guide appears in the sitemap
    // the moment it is added and cannot be forgotten here.
    ...GUIDES.map((entry) => ({
      url: absoluteUrl(`/guides/${entry.slug}`),
      lastModified: new Date(`${entry.modified}T00:00:00Z`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
    {
      url: absoluteUrl("/research/does-exercise-reduce-health-insurance-claims"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: absoluteUrl("/research"),
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: absoluteUrl("/privacy"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
    {
      url: absoluteUrl("/terms"),
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.4,
    },
  ];
}
