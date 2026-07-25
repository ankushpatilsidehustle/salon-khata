import * as SQLite from "expo-sqlite";

export const database = SQLite.openDatabaseSync("salon-khata.db");

/**
 * Run `work` inside a SQLite transaction.
 *
 * Do NOT use `database.withTransactionSync()` directly. When the inner
 * statement fails (constraint violation, disk full, IO error, etc.),
 * SQLite may auto-rollback the transaction. `withTransactionSync` then
 * runs its own `ROLLBACK`, which fails with
 *
 *     "cannot rollback - no transaction is active"
 *
 * — masking the ORIGINAL cause of the failure.
 *
 * This wrapper runs `BEGIN` / `COMMIT` / `ROLLBACK` manually, swallows a
 * failed rollback (SQLite already handled it), and rethrows the real
 * error so callers see the actual problem (e.g. UNIQUE constraint).
 *
 * NOTE: SQLite does not support nested transactions. Callers must not
 * wrap other `runInTransaction` calls — repos already open their own tx.
 */
export function runInTransaction(work: () => void): void {
  database.execSync("BEGIN");
  let workError: unknown = null;
  try {
    work();
  } catch (err) {
    workError = err;
  }
  if (workError !== null) {
    try {
      database.execSync("ROLLBACK");
    } catch {
      // SQLite likely auto-rolled back already — swallow so the caller
      // sees the ORIGINAL error, not this misleading rollback error.
    }
    throw workError;
  }
  database.execSync("COMMIT");
}
