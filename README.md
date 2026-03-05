# substreams-sink-sql-js

Universal client-side Substreams sink. Materialize any Substreams `DatabaseChanges` output into a local SQLite database. Zero infrastructure needed.

```
npm install substreams-sink-sql-js
```

## Why?

Substreams is powerful but getting data out requires setting up PostgreSQL, ClickHouse, or other infrastructure. This library skips all of that — connect to any Substreams package and query the data locally with SQL.

## Quick Start

```ts
import { SubstreamsSql } from "substreams-sink-sql-js";

const sink = new SubstreamsSql({
  endpoint: "https://mainnet.eth.streamingfast.io:443",
  token: process.env.SUBSTREAMS_API_TOKEN,
  manifest: "https://spkg.io/streamingfast/substreams-eth-block-meta-v0.4.3.spkg",
  outputModule: "db_out",
  startBlock: 1000000,
  onBlock(info) {
    console.log(`Block ${info.number}`);
  },
});

await sink.start();

// Query anytime — it's just SQL
const results = sink.query("SELECT * FROM block_meta ORDER BY id DESC LIMIT 10");
console.log(results);
```

## Features

- **Auto-table creation** — tables are created automatically from the first `DatabaseChanges` output. No schema definition needed.
- **Cursor-based resumption** — stop and restart without losing progress. The cursor is stored in the SQLite database.
- **Snapshot export/import** — export the entire database as a file, share it, import it to skip initial sync.
- **Reorg handling** — `BlockUndoSignal` triggers automatic rollback of affected rows via a history table.
- **Auto-reconnect** — exponential backoff on stream disconnects.
- **Per-block transactions** — atomic processing. Failed block = full rollback, cursor not advanced.

## API

### `new SubstreamsSql(options)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `endpoint` | `string` | Yes | Substreams gRPC endpoint URL |
| `token` | `string` | Yes | Substreams API JWT token |
| `manifest` | `string` | Yes | URL to `.spkg` package file |
| `outputModule` | `string` | Yes | Module name (e.g., `db_out`) |
| `startBlock` | `number` | No | Block to start from |
| `stopBlock` | `number` | No | Block to stop at |
| `onBlock` | `function` | No | Called after each block is processed |
| `onProgress` | `function` | No | Called with sync progress updates |
| `onError` | `function` | No | Called on stream errors |

### Methods

```ts
await sink.start();                    // Start streaming (non-blocking)
sink.stop();                           // Stop streaming
sink.query("SELECT ...");              // Query the local database
sink.getStatus();                      // Get current block number
const snapshot = sink.exportSnapshot(); // Export as Uint8Array
```

### Resume from snapshot

```ts
import { readFileSync } from "fs";

const snapshot = readFileSync("my-snapshot.sqlite");
const sink = await SubstreamsSql.fromSnapshot(snapshot, options);
await sink.start(); // Resumes from where the snapshot left off
```

## Supported Output Types

- **DatabaseChanges** (`db_out`) — fully supported
- **EntityChanges** (`graph_out`) — coming soon

## How It Works

```
Substreams gRPC stream
  → Decode DatabaseChanges protobuf
  → Auto-create SQLite tables from field names
  → INSERT/UPDATE/DELETE rows per operation
  → Save cursor for resumption
  → Track history for reorg rollback
  → Query with standard SQL anytime
```

The SQLite engine runs in-process via [sql.js](https://github.com/sql-js/sql.js/) (SQLite compiled to WASM). No external database needed.

## Endpoints

Find Substreams endpoints at [docs.substreams.dev](https://docs.substreams.dev/reference-and-specs/chains-and-endpoints). Common ones:

| Chain | Endpoint |
|-------|----------|
| Ethereum | `https://mainnet.eth.streamingfast.io:443` |
| Polygon | `https://polygon.substreams.pinax.network:443` |
| Arbitrum | `https://arb-one.substreams.pinax.network:443` |
| Base | `https://base-mainnet.substreams.pinax.network:443` |

## Find Packages

Browse available Substreams packages at [substreams.dev](https://substreams.dev). Look for packages with a `db_out` module.

## Development

```bash
git clone https://github.com/PaulieB14/substreams-sink-sql-js.git
cd substreams-sink-sql-js
npm install
npm run build

# Run example
export SUBSTREAMS_API_TOKEN=your_token
npx tsx examples/basic-usage.ts <manifest-url> [output-module] [start-block]
```

## License

MIT
