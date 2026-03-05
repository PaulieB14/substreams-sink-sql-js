import {
  fetchSubstream,
  createRegistry,
  createRequest,
  streamBlocks,
  unpackMapOutput,
  createAuthInterceptor,
} from "@substreams/core";
import { createGrpcTransport } from "@connectrpc/connect-node";
import type { SubstreamsSqlOptions } from "./types.js";

export interface StreamHandlers {
  onBlockScopedData: (
    output: unknown,
    cursor: string,
    blockNum: number,
    blockId: string,
    timestamp: Date,
    finalBlockHeight: number
  ) => void;
  onBlockUndoSignal: (lastValidBlockNum: number, lastValidCursor: string) => void;
  onProgress: () => void;
  onError: (error: Error) => void;
}

export class StreamConsumer {
  private running = false;

  constructor(
    private options: SubstreamsSqlOptions,
    private handlers: StreamHandlers
  ) {}

  async start(cursor?: string): Promise<void> {
    this.running = true;
    let retryDelay = 1000;

    while (this.running) {
      try {
        await this.streamLoop(cursor);
        break; // Clean exit (stopBlock reached)
      } catch (error) {
        if (!this.running) return;
        this.handlers.onError(error as Error);
        await this.sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  private async streamLoop(cursor?: string): Promise<void> {
    const substreamPackage = await fetchSubstream(this.options.manifest);
    const registry = createRegistry(substreamPackage);

    const transport = createGrpcTransport({
      baseUrl: this.options.endpoint,
      httpVersion: "2",
      interceptors: [createAuthInterceptor(this.options.token)],
    });

    const request = createRequest({
      substreamPackage,
      outputModule: this.options.outputModule,
      startBlockNum: this.options.startBlock,
      stopBlockNum: this.options.stopBlock,
      startCursor: cursor,
      productionMode: true,
    });

    for await (const response of streamBlocks(transport, request)) {
      if (!this.running) return;

      const msg = response.message;

      if (msg.case === "blockScopedData") {
        const blockData = msg.value;

        // unpackMapOutput expects the full Response object
        const output = unpackMapOutput(response, registry);
        if (!output) continue;

        // Convert to plain JSON object for easier handling
        const outputJson = output.toJson({ typeRegistry: registry });

        const clock = blockData.clock;
        const blockNum = Number(clock?.number ?? 0n);
        const blockId = clock?.id ?? "";
        const timestamp = new Date(
          Number(clock?.timestamp?.seconds ?? 0n) * 1000
        );
        const finalBlockHeight = Number(blockData.finalBlockHeight ?? 0n);

        this.handlers.onBlockScopedData(
          outputJson,
          blockData.cursor,
          blockNum,
          blockId,
          timestamp,
          finalBlockHeight
        );

        // Update cursor for reconnection
        cursor = blockData.cursor;
      } else if (msg.case === "blockUndoSignal") {
        const signal = msg.value;
        const lastValidBlock = Number(signal.lastValidBlock?.number ?? 0n);
        this.handlers.onBlockUndoSignal(lastValidBlock, signal.lastValidCursor);
        cursor = signal.lastValidCursor;
      } else if (msg.case === "progress") {
        this.handlers.onProgress();
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
