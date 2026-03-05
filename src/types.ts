export interface SubstreamsSqlOptions {
  endpoint: string;
  token: string;
  manifest: string;
  outputModule: string;
  startBlock?: number;
  stopBlock?: number;
  onBlock?: (info: BlockInfo) => void;
  onProgress?: (info: ProgressInfo) => void;
  onError?: (error: Error) => void;
}

export interface BlockInfo {
  number: number;
  id: string;
  timestamp: Date;
  cursor: string;
  tablesAffected: string[];
  operationCount: number;
}

export interface ProgressInfo {
  processedBlocks: number;
  blocksPerSecond: number;
}

export interface CursorState {
  cursor: string;
  blockNum: number;
  blockId: string;
}

export interface QueryResult {
  columns: string[];
  values: any[][];
}

export interface PrimaryKeyInfo {
  columns: string[];
  values: string[];
}

export interface HistoryEntry {
  blockNum: number;
  tableName: string;
  pk: Record<string, string>;
  operation: "INSERT" | "UPDATE" | "DELETE";
  prevRow: Record<string, any> | null;
}
