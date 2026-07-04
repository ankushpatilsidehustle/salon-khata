import * as SQLite from "expo-sqlite";

export const database = SQLite.openDatabaseSync("salon-khata.db");

export function runInTransaction(work: () => void) {
  database.withTransactionSync(work);
}