import {
  fetchSubstream,
  createRegistry,
  createRequest,
  streamBlocks,
  unpackMapOutput,
  createAuthInterceptor,
} from "@substreams/core";
import { createGrpcTransport } from "@connectrpc/connect-node";

const token = process.env.SUBSTREAMS_API_TOKEN!;
const manifest = process.argv[2] ?? "https://spkg.io/streamingfast/substreams-eth-block-meta-v0.4.3.spkg";
const outputModule = process.argv[3] ?? "db_out";
const startBlock = Number(process.argv[4] ?? 1000000);

console.log("Fetching manifest:", manifest);
const substreamPackage = await fetchSubstream(manifest);

// List all modules
console.log("\nAvailable modules:");
for (const mod of substreamPackage.modules?.modules ?? []) {
  console.log(`  - ${mod.name} (output: ${mod.output?.type ?? "none"})`);
}

const registry = createRegistry(substreamPackage);

const transport = createGrpcTransport({
  baseUrl: "https://mainnet.eth.streamingfast.io:443",
  httpVersion: "2",
  interceptors: [createAuthInterceptor(token)],
});

const request = createRequest({
  substreamPackage,
  outputModule,
  startBlockNum: startBlock,
  stopBlockNum: startBlock + 10,
  productionMode: true,
});

console.log(`\nStreaming ${outputModule} from block ${startBlock} to ${startBlock + 10}...\n`);

let blockCount = 0;
for await (const response of streamBlocks(transport, request)) {
  const msg = response.message;
  console.log(`Response case: ${msg.case}`);

  if (msg.case === "blockScopedData") {
    const blockData = msg.value;
    const clock = blockData.clock;
    console.log(`  Block ${clock?.number} (${clock?.id?.slice(0, 16)}...)`);

    const mapOutput = blockData.output?.mapOutput;
    console.log(`  mapOutput typeUrl: ${mapOutput?.typeUrl}`);
    console.log(`  mapOutput value length: ${mapOutput?.value?.length ?? 0} bytes`);

    const output = unpackMapOutput(response, registry);
    if (output) {
      const json = output.toJson({ typeRegistry: registry });
      console.log(`  Unpacked output type: ${output.getType().typeName}`);
      console.log(`  JSON preview:`, JSON.stringify(json).slice(0, 500));
    } else {
      console.log(`  No output (empty block)`);
    }

    blockCount++;
    if (blockCount >= 5) break;
  } else if (msg.case === "progress") {
    console.log("  (progress message)");
  } else if (msg.case === "session") {
    console.log("  Session started");
  }
}

console.log(`\nDone. Processed ${blockCount} blocks.`);
