import initSqlJs, { type Database } from "sql.js";
import type { QueryResult } from "./types.js";

export class SqlEngine {
  private db: Database;

  private constructor(db: Database) {
    this.db = db;
  }

  static async create(snapshot?: Uint8Array): Promise<SqlEngine> {
    const SQL = await initSqlJs();
    const db = snapshot ? new SQL.Database(snapshot) : new SQL.Database();
    db.run("PRAGMA journal_mode = WAL");
    db.run("PRAGMA synchronous = NORMAL");
    return new SqlEngine(db);
  }

  run(sql: string, params?: any[]): void {
    this.db.run(sql, params);
  }

  exec(sql: string, params?: any[]): QueryResult[] {
    if (params && params.length > 0) {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      const results: QueryResult[] = [];
      const columns: string[] = stmt.getColumnNames();
      const values: any[][] = [];
      while (stmt.step()) {
        values.push(stmt.get());
      }
      stmt.free();
      if (columns.length > 0) {
        results.push({ columns, values });
      }
      return results;
    }
    return this.db.exec(sql).map((r: { columns: string[]; values: any[][] }) => ({
      columns: r.columns,
      values: r.values,
    }));
  }

  begin(): void {
    this.db.run("BEGIN TRANSACTION");
  }

  commit(): void {
    this.db.run("COMMIT");
  }

  rollback(): void {
    this.db.run("ROLLBACK");
  }

  tableExists(tableName: string): boolean {
    const result = this.exec(
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
      [tableName]
    );
    return result.length > 0 && result[0].values[0][0] === 1;
  }

  getTableColumns(tableName: string): string[] {
    const result = this.exec(`PRAGMA table_info("${tableName}")`);
    if (result.length === 0) return [];
    return result[0].values.map((row) => row[1] as string);
  }

  export(): Uint8Array {
    return this.db.export();
  }

  close(): void {
    this.db.close();
  }
}
