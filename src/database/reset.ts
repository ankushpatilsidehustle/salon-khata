import * as SQLite from "expo-sqlite";
import { DevSettings } from "react-native";

import { database } from "./sqlite-client";

const DB_NAME = "salon-khata.db";

/**
 * Development helper: closes the SQLite connection, deletes the database file,
 * and reloads the JS bundle so `AppRoot` re-runs migrations against an empty
 * schema. Only meaningful in a dev build (`DevSettings.reload` is a no-op in
 * production).
 */
export async function resetAppData(): Promise<void> {
  try {
    await database.closeAsync();
  } catch {
    // Already closed, or opened by another handle — ignore and continue so
    // the delete step still runs.
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);

  if (typeof DevSettings.reload === "function") {
    DevSettings.reload();
  }
}
