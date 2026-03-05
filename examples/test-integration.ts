import { SubstreamsSql } from "../src/index.js";

const token = process.env.SUBSTREAMS_API_TOKEN!;

const sink = new SubstreamsSql({
  endpoint: "https://mainnet.eth.streamingfast.io:443",
  token,
  manifest: "https://spkg.io/streamingfast/substreams-eth-block-meta-v0.4.3.spkg",
  outputModule: "db_out",
  startBlock: 1000000,
  stopBlock: 1000010,

  onBlock(info) {
    console.log(`[onBlock] Block ${info.number} | tables: ${info.tablesAffected.join(", ") || "(none)"} | ops: ${info.operationCount}`);
  },

  onError(error) {
    console.error(`[onError] ${error.message}`);
    console.error(error.stack);
  },
});

console.log("Starting sink...");
await sink.start();

// Check every 2 seconds
let checks = 0;
const interval = setInterval(() => {
  checks++;
  const status = sink.getStatus();
  console.log(`[check ${checks}] Status:`, status);

  const tables = sink.query(
    "SELECT name FROM sqlite_master WHERE type='table'"
  );
  console.log(`[check ${checks}] All tables:`, tables[0]?.values.map(r => r[0]));

  if (status && status.blockNum >= 1000009) {
    clearInterval(interval);

    console.log("\n--- Final query ---");
    const result = sink.query("SELECT * FROM block_meta LIMIT 5");
    if (result.length > 0) {
      console.log("Columns:", result[0].columns);
      for (const row of result[0].values) {
        console.log("Row:", row);
      }
    } else {
      console.log("No results from block_meta");
    }

    sink.stop();
    process.exit(0);
  }

  if (checks > 30) {
    console.log("Timed out waiting for blocks");
    sink.stop();
    process.exit(1);
  }
}, 2000);
