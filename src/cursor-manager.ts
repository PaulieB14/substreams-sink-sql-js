import type { SqlEngine } from "./sql-engine.js";
import type { CursorState } from "./types.js";

export class CursorManager {
  constructor(private sqlEngine: SqlEngine) {}

  initialize(): void {
    this.sqlEngine.run(`
      CREATE TABLE IF NOT EXISTS __substreams_cursors (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        cursor TEXT NOT NULL,
        block_num INTEGER NOT NULL,
        block_id TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  saveCursor(cursor: string, blockNum: number, blockId: string): void {
    this.sqlEngine.run(
      `INSERT OR REPLACE INTO __substreams_cursors (id, cursor, block_num, block_id, updated_at)
       VALUES (1, ?, ?, ?, datetime('now'))`,
      [cursor, blockNum, blockId]
    );
  }

  loadCursor(): CursorState | null {
    const result = this.sqlEngine.exec(
      "SELECT cursor, block_num, block_id FROM __substreams_cursors WHERE id = 1"
    );
    if (result.length === 0 || result[0].values.length === 0) return null;
    const [cursor, blockNum, blockId] = result[0].values[0];
    return {
      cursor: cursor as string,
      blockNum: blockNum as number,
      blockId: blockId as string,
    };
  }
}
