/**
 * Bucket items by a derived key, ordered by an explicit list.
 *
 * Groups named in `order` come first in that order; anything else keeps the order
 * it appeared in the source data, which lets a section add a group without also
 * having to register it here.
 */
export function groupInOrder<T>(
  items: readonly T[],
  getGroup: (item: T) => string,
  order: readonly string[] = []
): [string, T[]][] {
  const grouped = new Map<string, T[]>()

  for (const item of items) {
    const key = getGroup(item)
    const bucket = grouped.get(key)

    if (bucket) {
      bucket.push(item)
    } else {
      grouped.set(key, [item])
    }
  }

  const rank = (group: string) => {
    const index = order.indexOf(group)
    return index >= 0 ? index : Number.MAX_SAFE_INTEGER
  }

  // Array#sort is stable, so unranked groups keep their insertion order.
  return [...grouped].sort(([a], [b]) => rank(a) - rank(b))
}
