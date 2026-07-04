import { runMigrations as runMigration001 } from "./001-initial-schema";
import { runMigration002 } from "./002-add-service-gender";
import { runMigration003 } from "./003-service-categories";
import { runMigration004 } from "./004-employees-expanded";
import { runMigration005 } from "./005-income-discount";
import { runMigration006 } from "./006-income-item-employee";

/** Run every migration in order. Safe to call on every app start. */
export function runAllMigrations(): void {
  runMigration001();
  runMigration002();
  runMigration003();
  runMigration004();
  runMigration005();
  runMigration006();
}
