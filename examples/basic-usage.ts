import { SubstreamsSql } from "../src/index.js";
import { writeFileSync } from "fs";

const SUBSTREAMS_API_TOKEN = process.env.SUBSTREAMS_API_TOKEN;
if (!SUBSTREAMS_API_TOKEN) {
  console.error("Set SUBSTREAMS_API_TOKEN environment variable");
  process.exit(1);
}

// Pick any Substreams package that outputs DatabaseChanges (db_out)
// Example: a Uniswap v3 swaps package on Polygon
const MANIFEST = process.argv[2];
const OUTPUT_MODULE = process.argv[3] ?? "db_out";
const START_BLOCK = Number(process.argv[4] ?? 0);

if (!MANIFEST) {
  console.error(
    "Usage: tsx examples/basic-usage.ts <manifest-url> [output-module] [start-block]"
  );
  console.error(
    "  Example: tsx examples/basic-usage.ts https://spkg.io/streamingfast/substreams-uniswap-v3-v0.2.10.spkg db_out 44000000"
  );
  process.exit(1);
}

const sink = new SubstreamsSql({
  endpoint: "https://polygon.substreams.pinax.network:443",
  token: SUBSTREAMS_API_TOKEN,
  manifest: MANIFEST,
  outputModule: OUTPUT_MODULE,
  startBlock: START_BLOCK,

  onBlock(info) {
    if (info.number % 100 === 0) {
      console.log(
        `Block ${info.number} | tables: ${info.tablesAffected.join(", ") || "(none)"}`
      );
    }
  },

  onError(error) {
    console.error("Stream error:", error.message);
  },
});

await sink.start();

// Let it run for a bit, then query
console.log("Streaming started. Waiting 30 seconds to collect data...\n");

setTimeout(() => {
  console.log("\n--- Querying local SQLite database ---\n");

  // List all tables
  const tables = sink.query(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE '__substreams_%'"
  );
  if (tables.length > 0) {
    console.log("Tables created:");
    for (const row of tables[0].values) {
      console.log(`  - ${row[0]}`);

      // Show row count and sample
      const count = sink.query(`SELECT COUNT(*) FROM "${row[0]}"`);
      console.log(`    Rows: ${count[0]?.values[0]?.[0] ?? 0}`);

      const sample = sink.query(`SELECT * FROM "${row[0]}" LIMIT 3`);
      if (sample.length > 0 && sample[0].values.length > 0) {
        console.log(`    Columns: ${sample[0].columns.join(", ")}`);
        for (const sampleRow of sample[0].values) {
          const obj: Record<string, any> = {};
          sample[0].columns.forEach((col, i) => {
            obj[col] = sampleRow[i];
          });
          console.log(`    Sample: ${JSON.stringify(obj)}`);
        }
      }
    }
  } else {
    console.log("No tables created yet. Try increasing the wait time or check your manifest.");
  }

  // Show sync status
  const status = sink.getStatus();
  if (status) {
    console.log(`\nSync status: block ${status.blockNum}`);
  }

  // Export snapshot
  const snapshot = sink.exportSnapshot();
  writeFileSync("snapshot.sqlite", snapshot);
  console.log(`\nSnapshot exported: snapshot.sqlite (${(snapshot.length / 1024).toFixed(1)} KB)`);

  sink.stop();
  console.log("\nDone.");
  process.exit(0);
}, 30000);
