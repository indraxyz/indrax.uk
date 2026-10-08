import { getTableName, sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

// Single-table Drizzle selects strip column qualifiers even inside subqueries.
// Explicit identifiers preserve correlation with the outer row.
export const qualified = (column: AnyPgColumn) =>
  sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`
