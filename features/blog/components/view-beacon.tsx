import { BLOG_CONFIG } from "@/features/blog/config"

interface ViewBeaconProps {
  slug: string
}

/**
 * Counts a read, without shipping any JavaScript to do it.
 *
 * An image request rather than a script, so it fires on a cached page and for a
 * reader with JavaScript disabled - and so the article's zero-JavaScript property
 * survives a decorative feature (NFR-5).
 *
 * Hidden from assistive technology and from print: it carries no information, and
 * a screen reader announcing an unnamed image is worse than one that is not there.
 */
export function ViewBeacon({ slug }: ViewBeaconProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`${BLOG_CONFIG.viewPath}/${encodeURIComponent(slug)}`}
      alt=""
      aria-hidden
      width={1}
      height={1}
      className="absolute h-px w-px opacity-0 print:hidden"
    />
  )
}
