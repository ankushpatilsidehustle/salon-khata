import { runMigrations as runMigration001 } from "./001-initial-schema";
import { runMigration002 } from "./002-add-service-gender";
import { runMigration003 } from "./003-service-categories";
import { runMigration004 } from "./004-employees-expanded";
import { runMigration005 } from "./005-income-discount";
import { runMigration006 } from "./006-income-item-employee";
import { runMigration007 } from "./007-expense-payment-mode";
import { runMigration008 } from "./008-expense-settled-at";
import { runMigration009 } from "./009-onboarding";
import { runMigration010 } from "./010-service-product-cost";
import { runMigration011 } from "./011-customers";
import { runMigration012 } from "./012-employee-advances";
import { runMigration013 } from "./013-salon-owner-uid";

/** Run every migration in order. Safe to call on every app start. */
export function runAllMigrations(): void {
  runMigration001();
  runMigration002();
  runMigration003();
  runMigration004();
  runMigration005();
  runMigration006();
  runMigration007();
  runMigration008();
  runMigration009();
  runMigration010();
  runMigration011();
  runMigration012();
  runMigration013();
}
