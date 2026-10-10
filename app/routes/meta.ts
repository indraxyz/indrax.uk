import type { MetaDescriptor } from "react-router"

import { OG_CARD_SIZE, OG_CARD_CONTENT_TYPE } from "@/lib/og/brand"

import { SITE_URL } from "@/config/site"

export function pageMeta(
  title: string,
  description: string,
  path: string,
  type = "website",
  imagePath = `${path === "/" ? "" : path}/opengraph-image`
): MetaDescriptor[] {
  const url = new URL(path, SITE_URL).href
  const image = new URL(imagePath, SITE_URL).href
  return [
    { title },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    {
      property: "og:image",
      content: image,
    },
    { property: "og:image:width", content: String(OG_CARD_SIZE.width) },
    { property: "og:image:height", content: String(OG_CARD_SIZE.height) },
    { property: "og:image:type", content: OG_CARD_CONTENT_TYPE },
    { property: "og:image:alt", content: title },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
    { name: "twitter:image:alt", content: title },
  ]
}
