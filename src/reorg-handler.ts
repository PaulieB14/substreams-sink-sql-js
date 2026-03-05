import type { SqlEngine } from "./sql-engine.js";
import type { HistoryEntry } from "./types.js";

export class ReorgHandler {
  constructor(private sqlEngine: SqlEngine) {}

  initialize(): void {
    this.sqlEngine.run(`
      CREATE TABLE IF NOT EXISTS __substreams_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        block_num INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        pk_json TEXT NOT NULL,
        operation TEXT NOT NULL,
        prev_row_json TEXT
      )
    `);
    this.sqlEngine.run(
      "CREATE INDEX IF NOT EXISTS idx_history_block ON __substreams_history(block_num)"
    );
  }

  recordOperation(entry: HistoryEntry): void {
    this.sqlEngine.run(
      `INSERT INTO __substreams_history (block_num, table_name, pk_json, operation, prev_row_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        entry.blockNum,
        entry.tableName,
        JSON.stringify(entry.pk),
        entry.operation,
        entry.prevRow ? JSON.stringify(entry.prevRow) : null,
      ]
    );
  }

  undoAboveBlock(lastValidBlockNum: number): void {
    const result = this.sqlEngine.exec(
      `SELECT table_name, pk_json, operation, prev_row_json
       FROM __substreams_history
       WHERE block_num > ?
       ORDER BY id DESC`,
      [lastValidBlockNum]
    );

    if (result.length === 0) return;

    for (const row of result[0].values) {
      const [tableName, pkJson, operation, prevRowJson] = row as [
        string,
        string,
        string,
        string | null,
      ];
      const pk = JSON.parse(pkJson) as Record<string, string>;
      const whereClause = Object.keys(pk)
        .map((k) => `"${k}" = ?`)
        .join(" AND ");
      const whereValues = Object.values(pk);

      switch (operation) {
        case "INSERT":
          this.sqlEngine.run(
            `DELETE FROM "${tableName}" WHERE ${whereClause}`,
            whereValues
          );
          break;
        case "UPDATE": {
          const prevRow = JSON.parse(prevRowJson!) as Record<string, any>;
          const setClauses = Object.keys(prevRow)
            .map((k) => `"${k}" = ?`)
            .join(", ");
          this.sqlEngine.run(
            `UPDATE "${tableName}" SET ${setClauses} WHERE ${whereClause}`,
            [...Object.values(prevRow), ...whereValues]
          );
          break;
        }
        case "DELETE": {
          const fullRow = JSON.parse(prevRowJson!) as Record<string, any>;
          const cols = Object.keys(fullRow)
            .map((c) => `"${c}"`)
            .join(", ");
          const placeholders = Object.keys(fullRow)
            .map(() => "?")
            .join(", ");
          this.sqlEngine.run(
            `INSERT INTO "${tableName}" (${cols}) VALUES (${placeholders})`,
            Object.values(fullRow)
          );
          break;
        }
      }
    }

    this.sqlEngine.run(
      "DELETE FROM __substreams_history WHERE block_num > ?",
      [lastValidBlockNum]
    );
  }

  pruneBelow(finalBlockHeight: number): void {
    this.sqlEngine.run(
      "DELETE FROM __substreams_history WHERE block_num <= ?",
      [finalBlockHeight]
    );
  }
}
