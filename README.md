# Substreams SQL Sink (PostgreSQL)

Sink any Substreams `db_out` module into PostgreSQL using [StreamingFast's `substreams-sink-sql`](https://github.com/streamingfast/substreams-sink-sql).

This repo is a ready-to-use template. Swap in your own `.spkg` and `schema.sql` to get started.

## How It Works

```
Substreams .spkg (db_out module)
  → substreams-sink-sql (StreamingFast CLI tool)
  → PostgreSQL
  → Query with any SQL client / pgweb UI
```

No custom sink code needed — `substreams-sink-sql` handles streaming, cursor management, reorg handling, and database writes.

## Prerequisites

1. **substreams CLI** — [Install guide](https://substreams.streamingfast.io/getting-started/installing-the-cli)
2. **substreams-sink-sql** — `brew install streamingfast/tap/substreams-sink-sql`
3. **Docker** — For running Postgres locally
4. **Substreams API token** — Get one at [app.pinax.network](https://app.pinax.network) or [app.streamingfast.io](https://app.streamingfast.io)

## Quick Start

```bash
# 1. Clone this repo
git clone https://github.com/PaulieB14/substreams-sink-sql-js.git
cd substreams-sink-sql-js

# 2. Copy and configure environment
cp .env.example .env
# Edit .env with your SUBSTREAMS_API_TOKEN

# 3. Start Postgres + pgweb
make up

# 4. Create tables
make setup

# 5. Stream data into Postgres
make dev

# 6. Browse data at http://localhost:8081
```

## Project Structure

```
.
├── substreams.yaml      # Sink config — imports .spkg, defines sink type
├── schema.sql           # PostgreSQL DDL — tables, indexes, types
├── docker-compose.yml   # Postgres 16 + pgweb for local dev
├── Makefile             # Automation: pack, setup, dev, run, reset
├── .env.example         # Configuration template
└── README.md
```

## Using Your Own Substreams

This template ships with `substreams-eth-block-meta` as an example. To use your own:

### 1. Update `substreams.yaml`

Change the `imports` section to point to your `.spkg`:

```yaml
imports:
  spkg: https://spkg.io/your-org/your-substreams-v1.0.0.spkg
  # Or a local file:
  # spkg: ./your-substreams-v1.0.0.spkg
```

### 2. Write `schema.sql`

Create tables matching your Substreams `db_out` output. Use proper PostgreSQL types:

```sql
CREATE TABLE IF NOT EXISTS erc20_transfers (
    block_num       INTEGER NOT NULL,
    tx_hash         TEXT NOT NULL,
    log_index       INTEGER NOT NULL,
    contract        TEXT NOT NULL,
    "from"          TEXT NOT NULL,
    "to"            TEXT NOT NULL,
    amount          NUMERIC NOT NULL,
    timestamp       TIMESTAMP NOT NULL,
    PRIMARY KEY (block_num, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_erc20_transfers_contract ON erc20_transfers (contract);
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_from ON erc20_transfers ("from");
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_to ON erc20_transfers ("to");
CREATE INDEX IF NOT EXISTS idx_erc20_transfers_timestamp ON erc20_transfers (timestamp);
```

### 3. Run it

```bash
make setup   # Apply new schema
make dev     # Stream data
```

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make help` | Show all available commands |
| `make up` | Start Postgres + pgweb |
| `make down` | Stop Docker services |
| `make pack` | Pack manifest into `.spkg` |
| `make setup` | Create system tables + apply `schema.sql` |
| `make dev` | Run sink in dev mode (short block range) |
| `make run` | Run sink in production mode (live streaming) |
| `make reset` | Drop and recreate all tables |
| `make clean` | Remove `.spkg` files |

## Configuration

Override defaults via environment variables or `.env`:

```bash
# Custom endpoint and block range
make dev ENDPOINT=polygon.substreams.pinax.network:443 START_BLOCK=50000000 STOP_BLOCK=+500

# Custom Postgres DSN
make dev PG_DSN=psql://user:pass@myhost:5432/mydb?sslmode=disable
```

## Common Endpoints

| Chain | Endpoint |
|-------|----------|
| Ethereum | `eth.substreams.pinax.network:443` |
| Polygon | `polygon.substreams.pinax.network:443` |
| Arbitrum | `arb-one.substreams.pinax.network:443` |
| Base | `base-mainnet.substreams.pinax.network:443` |
| BSC | `bsc.substreams.pinax.network:443` |

Full list: [Chains & Endpoints](https://substreams.streamingfast.io/reference-and-specs/chains-and-endpoints)

## Find Substreams Packages

Browse available `.spkg` files at [substreams.dev](https://substreams.dev). Look for packages with a `db_out` module.

## Writing Your Own Substreams

If you need a custom `db_out` module, create a Rust Substreams project:

```rust
use substreams_database_change::pb::sf::substreams::sink::database::v1::DatabaseChanges;
use substreams_database_change::tables::Tables;

#[substreams::handlers::map]
pub fn db_out(events: MyEvents) -> Result<DatabaseChanges, substreams::errors::Error> {
    let mut tables = Tables::new();

    for event in events.items {
        tables
            .create_row("my_table", format!("{}-{}", event.tx_hash, event.log_index))
            .set("tx_hash", &event.tx_hash)
            .set("amount", &event.amount)
            .set("timestamp", &event.timestamp);
    }

    Ok(tables.to_database_changes())
}
```

See the [Substreams SQL docs](https://substreams.streamingfast.io/documentation/consume/sql) for the full guide.

## License

MIT
