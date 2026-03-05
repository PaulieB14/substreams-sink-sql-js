import { SqlEngine } from "./sql-engine.js";
import { CursorManager } from "./cursor-manager.js";
import { SchemaManager } from "./schema-manager.js";
import { DatabaseChangesHandler } from "./database-changes-handler.js";
import { ReorgHandler } from "./reorg-handler.js";
import { StreamConsumer } from "./stream-consumer.js";
import type {
  SubstreamsSqlOptions,
  QueryResult,
  BlockInfo,
  ProgressInfo,
} from "./types.js";

export class SubstreamsSql {
  private sqlEngine!: SqlEngine;
  private cursorManager!: CursorManager;
  private schemaManager!: SchemaManager;
  private dbChangesHandler!: DatabaseChangesHandler;
  private reorgHandler!: ReorgHandler;
  private consumer!: StreamConsumer;
  private startTime = 0;
  private blocksProcessed = 0;

  constructor(private options: SubstreamsSqlOptions) {}

  async start(): Promise<void> {
    await this.initialize();

    const savedState = this.cursorManager.loadCursor();
    if (savedState) {
      console.log(
        `Resuming from block ${savedState.blockNum} (cursor found)`
      );
    } else {
      console.log(
        `Starting fresh from block ${this.options.startBlock ?? 0}`
      );
    }

    this.startTime = Date.now();
    this.blocksProcessed = 0;

    this.consumer = new StreamConsumer(this.options, {
      onBlockScopedData: (
        output,
        cursor,
        blockNum,
        blockId,
        timestamp,
        finalBlockHeight
      ) => {
        this.processBlock(
          output,
          cursor,
          blockNum,
          blockId,
          timestamp,
          finalBlockHeight
        );
      },
      onBlockUndoSignal: (lastValidBlockNum, lastValidCursor) => {
        this.handleUndo(lastValidBlockNum, lastValidCursor);
      },
      onProgress: () => {
        if (this.options.onProgress) {
          const elapsed = (Date.now() - this.startTime) / 1000;
          this.options.onProgress({
            processedBlocks: this.blocksProcessed,
            blocksPerSecond:
              elapsed > 0 ? this.blocksProcessed / elapsed : 0,
          });
        }
      },
      onError: (error) => {
        if (this.options.onError) {
          this.options.onError(error);
        } else {
          console.error("Stream error (will retry):", error.message);
        }
      },
    });

    // Start streaming (non-blocking via fire-and-forget)
    const cursor = savedState?.cursor;
    this.consumer.start(cursor).catch((err) => {
      if (this.options.onError) {
        this.options.onError(err);
      } else {
        console.error("Fatal stream error:", err);
      }
    });
  }

  stop(): void {
    this.consumer?.stop();
  }

  query(sql: string, params?: any[]): QueryResult[] {
    return this.sqlEngine.exec(sql, params);
  }

  exportSnapshot(): Uint8Array {
    return this.sqlEngine.export();
  }

  static async fromSnapshot(
    snapshot: Uint8Array,
    options: SubstreamsSqlOptions
  ): Promise<SubstreamsSql> {
    const instance = new SubstreamsSql(options);
    instance.sqlEngine = await SqlEngine.create(snapshot);
    instance.cursorManager = new CursorManager(instance.sqlEngine);
    instance.schemaManager = new SchemaManager(instance.sqlEngine);
    instance.reorgHandler = new ReorgHandler(instance.sqlEngine);
    instance.reorgHandler.initialize();
    instance.dbChangesHandler = new DatabaseChangesHandler(
      instance.sqlEngine,
      instance.schemaManager,
      instance.reorgHandler
    );
    return instance;
  }

  getStatus(): { blockNum: number; blockId: string } | null {
    const state = this.cursorManager.loadCursor();
    if (!state) return null;
    return { blockNum: state.blockNum, blockId: state.blockId };
  }

  private async initialize(): Promise<void> {
    this.sqlEngine = await SqlEngine.create();
    this.cursorManager = new CursorManager(this.sqlEngine);
    this.cursorManager.initialize();
    this.schemaManager = new SchemaManager(this.sqlEngine);
    this.reorgHandler = new ReorgHandler(this.sqlEngine);
    this.reorgHandler.initialize();
    this.dbChangesHandler = new DatabaseChangesHandler(
      this.sqlEngine,
      this.schemaManager,
      this.reorgHandler
    );
  }

  private processBlock(
    output: unknown,
    cursor: string,
    blockNum: number,
    blockId: string,
    timestamp: Date,
    finalBlockHeight: number
  ): void {
    const isFinal = blockNum <= finalBlockHeight;

    this.sqlEngine.begin();
    try {
      const tablesAffected = this.dbChangesHandler.handleOutput(
        output,
        blockNum,
        isFinal
      );
      this.cursorManager.saveCursor(cursor, blockNum, blockId);
      if (isFinal) {
        this.reorgHandler.pruneBelow(finalBlockHeight);
      }
      this.sqlEngine.commit();

      this.blocksProcessed++;

      if (this.options.onBlock) {
        this.options.onBlock({
          number: blockNum,
          id: blockId,
          timestamp,
          cursor,
          tablesAffected,
          operationCount: tablesAffected.length,
        });
      }
    } catch (error) {
      this.sqlEngine.rollback();
      throw error;
    }
  }

  private handleUndo(
    lastValidBlockNum: number,
    lastValidCursor: string
  ): void {
    this.sqlEngine.begin();
    try {
      this.reorgHandler.undoAboveBlock(lastValidBlockNum);
      this.cursorManager.saveCursor(lastValidCursor, lastValidBlockNum, "");
      this.sqlEngine.commit();
      console.log(`Reorg: rolled back to block ${lastValidBlockNum}`);
    } catch (error) {
      this.sqlEngine.rollback();
      throw error;
    }
  }
}
