import { z } from "zod"

import { SLUG_PATTERN } from "@/features/blog/utils/slug"

// Caps exist so a single row cannot become a denial-of-service by itself. Sized
// generously against real writing: 200 characters is a long title, and 200k of
// markdown is roughly a 30,000-word article.
export const LIMITS = {
  title: 200,
  slug: 120,
  excerpt: 300,
  content: 200_000,
  tagName: 50,
  coverAlt: 300,
} as const

export const slugSchema = z
  .string()
  .trim()
  .min(1, "A slug is required.")
  .max(LIMITS.slug, `A slug cannot exceed ${LIMITS.slug} characters.`)
  .regex(SLUG_PATTERN, "Use lowercase letters, digits and single hyphens only.")

export const postStatusSchema = z.enum(["draft", "published", "archived"])

export const tagNameSchema = z
  .string()
  .trim()
  .min(1, "A tag needs a name.")
  .max(LIMITS.tagName, `A tag name cannot exceed ${LIMITS.tagName} characters.`)

/**
 * A post as it arrives from an author.
 *
 * `readingTime`, `publishedAt`, `createdAt` and `updatedAt` are absent by design:
 * all four are set server-side. Accepting them would mean trusting a client with
 * values it has no business asserting (PRD US-3.1).
 *
 * Used to validate the seed today. It is the same shape the authoring phase's
 * server actions will validate, which is why it lives in `lib/validators` rather
 * than beside the seed that currently happens to be its only caller.
 */
export const postInputSchema = z
  .object({
    title: z.string().trim().min(1, "A title is required.").max(LIMITS.title),
    slug: slugSchema.optional(),
    excerpt: z.string().trim().max(LIMITS.excerpt).optional(),
    content: z.string().min(1, "An article needs a body.").max(LIMITS.content),
    coverUrl: z.url("A cover must be an absolute URL.").optional(),
    coverAlt: z.string().trim().max(LIMITS.coverAlt).optional(),
    status: postStatusSchema.default("draft"),
    tags: z.array(tagNameSchema).max(10).default([]),
  })
  .refine((post) => !post.coverUrl || Boolean(post.coverAlt), {
    // An image with no alternative text is invisible to anyone who cannot see it,
    // and this is the only place that can still be fixed cheaply (PRD US-3.6).
    path: ["coverAlt"],
    message: "A cover image needs alt text.",
  })

export type PostInput = z.infer<typeof postInputSchema>
