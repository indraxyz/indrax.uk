/**
 * Serialise a structured-data object for `dangerouslySetInnerHTML`.
 *
 * `<` is escaped so a value containing "</script>" cannot close the tag early and
 * spill the rest of the document onto the page. That is a formality for the
 * resume, whose block is built from committed data, and load-bearing for an
 * article, whose title comes from the database.
 */
export const serialiseJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c")
