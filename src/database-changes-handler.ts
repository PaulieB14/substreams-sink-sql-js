import type { SqlEngine } from "./sql-engine.js";
import type { SchemaManager } from "./schema-manager.js";
import type { ReorgHandler } from "./reorg-handler.js";
import type { PrimaryKeyInfo } from "./types.js";

interface TableChange {
  table: string;
  pk?: string;
  compositePk?: { keys: Record<string, string> };
  ordinal: string;
  operation: string | number;
  fields: Array<{ name: string; newValue: string; oldValue: string }>;
}

interface DatabaseChanges {
  tableChanges: TableChange[];
}

export class DatabaseChangesHandler {
  constructor(
    private sqlEngine: SqlEngine,
    private schemaManager: SchemaManager,
    private reorgHandler: ReorgHandler
  ) {}

  handleOutput(decoded: unknown, blockNum: number, isFinal: boolean): string[] {
    const changes = decoded as DatabaseChanges;
    if (!changes?.tableChanges?.length) return [];

    const tablesAffected = new Set<string>();

    for (const change of changes.tableChanges) {
      const pk = this.extractPrimaryKey(change);
      const fieldNames = change.fields.map((f) => f.name);

      this.schemaManager.ensureTable(change.table, pk.columns, fieldNames);
      tablesAffected.add(change.table);

      const op = this.normalizeOperation(change.operation);

      if (op === "CREATE") {
        if (!isFinal) {
          this.reorgHandler.recordOperation({
            blockNum,
            tableName: change.table,
            pk: Object.fromEntries(pk.columns.map((c, i) => [c, pk.values[i]])),
            operation: "INSERT",
            prevRow: null,
          });
        }
        this.handleCreate(change, pk);
      } else if (op === "UPDATE") {
        if (!isFinal) {
          const prevRow = this.fetchCurrentRow(change.table, pk);
          this.reorgHandler.recordOperation({
            blockNum,
            tableName: change.table,
            pk: Object.fromEntries(pk.columns.map((c, i) => [c, pk.values[i]])),
            operation: "UPDATE",
            prevRow,
          });
        }
        this.handleUpdate(change, pk);
      } else if (op === "DELETE") {
        if (!isFinal) {
          const prevRow = this.fetchCurrentRow(change.table, pk);
          this.reorgHandler.recordOperation({
            blockNum,
            tableName: change.table,
            pk: Object.fromEntries(pk.columns.map((c, i) => [c, pk.values[i]])),
            operation: "DELETE",
            prevRow,
          });
        }
        this.handleDelete(change, pk);
      }
    }

    return [...tablesAffected];
  }

  private extractPrimaryKey(change: TableChange): PrimaryKeyInfo {
    if (change.compositePk?.keys) {
      const keys = change.compositePk.keys;
      return {
        columns: Object.keys(keys),
        values: Object.values(keys),
      };
    }
    return { columns: ["id"], values: [change.pk ?? ""] };
  }

  private normalizeOperation(op: string | number): string {
    if (typeof op === "number") {
      return ["UNSET", "CREATE", "UPDATE", "DELETE"][op] ?? "UNSET";
    }
    // Handle both "OPERATION_CREATE" and "CREATE" formats
    return op.replace("OPERATION_", "");
  }

  private handleCreate(change: TableChange, pk: PrimaryKeyInfo): void {
    const allColumns = [...pk.columns, ...change.fields.map((f) => f.name)];
    const allValues = [...pk.values, ...change.fields.map((f) => f.newValue)];
    const placeholders = allColumns.map(() => "?").join(", ");
    const columns = allColumns.map((c) => `"${c}"`).join(", ");

    this.sqlEngine.run(
      `INSERT OR REPLACE INTO "${change.table}" (${columns}) VALUES (${placeholders})`,
      allValues
    );
  }

  private handleUpdate(change: TableChange, pk: PrimaryKeyInfo): void {
    const setClauses = change.fields.map((f) => `"${f.name}" = ?`).join(", ");
    const setValues = change.fields.map((f) => f.newValue);
    const whereClause = pk.columns.map((c) => `"${c}" = ?`).join(" AND ");

    this.sqlEngine.run(
      `UPDATE "${change.table}" SET ${setClauses} WHERE ${whereClause}`,
      [...setValues, ...pk.values]
    );
  }

  private handleDelete(change: TableChange, pk: PrimaryKeyInfo): void {
    const whereClause = pk.columns.map((c) => `"${c}" = ?`).join(" AND ");
    this.sqlEngine.run(
      `DELETE FROM "${change.table}" WHERE ${whereClause}`,
      pk.values
    );
  }

  private fetchCurrentRow(
    tableName: string,
    pk: PrimaryKeyInfo
  ): Record<string, any> | null {
    const whereClause = pk.columns.map((c) => `"${c}" = ?`).join(" AND ");
    const result = this.sqlEngine.exec(
      `SELECT * FROM "${tableName}" WHERE ${whereClause}`,
      pk.values
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    const row: Record<string, any> = {};
    result[0].columns.forEach((col, i) => {
      row[col] = result[0].values[0][i];
    });
    return row;
  }
}
