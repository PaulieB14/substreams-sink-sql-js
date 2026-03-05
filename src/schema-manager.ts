import type { SqlEngine } from "./sql-engine.js";

export class SchemaManager {
  private knownTables = new Map<string, Set<string>>();

  constructor(private sqlEngine: SqlEngine) {
    this.loadExistingSchema();
  }

  private loadExistingSchema(): void {
    const tables = this.sqlEngine.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__substreams_%'"
    );
    if (tables.length === 0) return;
    for (const row of tables[0].values) {
      const tableName = row[0] as string;
      const columns = this.sqlEngine.getTableColumns(tableName);
      this.knownTables.set(tableName, new Set(columns));
    }
  }

  ensureTable(
    tableName: string,
    pkColumns: string[],
    fieldNames: string[]
  ): void {
    if (!this.knownTables.has(tableName)) {
      this.createTable(tableName, pkColumns, fieldNames);
    } else {
      this.addMissingColumns(tableName, fieldNames);
    }
  }

  private createTable(
    tableName: string,
    pkColumns: string[],
    fieldNames: string[]
  ): void {
    const pkDefs = pkColumns.map((c) => `"${c}" TEXT NOT NULL`);
    const fieldDefs = fieldNames
      .filter((f) => !pkColumns.includes(f))
      .map((f) => `"${f}" TEXT`);
    const allDefs = [...pkDefs, ...fieldDefs];
    const pkConstraint = `PRIMARY KEY (${pkColumns.map((c) => `"${c}"`).join(", ")})`;

    this.sqlEngine.run(
      `CREATE TABLE IF NOT EXISTS "${tableName}" (${allDefs.join(", ")}, ${pkConstraint})`
    );

    const allColumns = new Set([...pkColumns, ...fieldNames]);
    this.knownTables.set(tableName, allColumns);
  }

  private addMissingColumns(tableName: string, fieldNames: string[]): void {
    const existing = this.knownTables.get(tableName)!;
    for (const name of fieldNames) {
      if (!existing.has(name)) {
        this.sqlEngine.run(
          `ALTER TABLE "${tableName}" ADD COLUMN "${name}" TEXT`
        );
        existing.add(name);
      }
    }
  }
}
