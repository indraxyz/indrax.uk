import type { DatabaseSync } from "node:sqlite"

interface Statement {
  rows(): Record<string, unknown>[]
}

/** Run the production quota SQL with real SQLite, including D1 batch transactions. */
export function sqliteQuotaBinding(database: DatabaseSync) {
  return {
    prepare(sql: string) {
      return {
        bind(...args: (string | number)[]) {
          return {
            rows: () => database.prepare(sql).all(...args),
            first: async () => database.prepare(sql).get(...args) ?? null,
          }
        },
      }
    },
    async batch(statements: Statement[]) {
      database.exec("BEGIN")
      try {
        const results = statements.map((statement) => ({ results: statement.rows() }))
        database.exec("COMMIT")
        return results
      } catch (error) {
        database.exec("ROLLBACK")
        throw error
      }
    },
  }
}
