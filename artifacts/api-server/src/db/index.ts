import { sqlite, db } from "./connection";
import { runMigrations } from "./migrate";

// Run migrations on startup
runMigrations(sqlite);

export { db };
export * from "./schema";
