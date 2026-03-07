# create-substreams-sink-sql

Scaffold a Substreams SQL sink for PostgreSQL in one command.

> **New to Substreams?** Each scaffolded project includes a **TUTORIAL.md** covering concepts, setup, finding packages with [substreams-search-mcp](https://www.npmjs.com/package/substreams-search-mcp), multi-chain usage, and troubleshooting.

## Usage

```bash
# Create a new project
npm init substreams-sink-sql my-sink

# Or use npx
npx create-substreams-sink-sql my-sink

# Or scaffold in current directory
npx create-substreams-sink-sql .
```

## What You Get

```
my-sink/
├── substreams.yaml      # Sink config — imports .spkg, defines sink type
├── schema.sql           # PostgreSQL DDL — tables, indexes, types
├── docker-compose.yml   # Postgres 16 + pgweb for local dev
├── Makefile             # Automation: pack, setup, dev, run, reset
├── .env.example         # Configuration template
├── .gitignore
└── TUTORIAL.md          # Complete beginner's tutorial
```

## Quick Start

```bash
npm init substreams-sink-sql my-sink
cd my-sink
cp .env.example .env     # Add your SUBSTREAMS_API_TOKEN
make up                  # Start Postgres + pgweb
make setup               # Create tables
make dev                 # Stream data
# Browse data at http://localhost:8081
```

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

## Using Your Own Substreams

The template ships with `substreams-eth-block-meta` as an example. To use your own:

### 1. Update `substreams.yaml`

Change the `imports` section to point to your `.spkg`:

```yaml
imports:
  spkg: https://spkg.io/your-org/your-substreams-v1.0.0.spkg
```

### 2. Write `schema.sql`

Create tables matching your Substreams `db_out` output:

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

For AI-assisted discovery, install [substreams-search-mcp](https://www.npmjs.com/package/substreams-search-mcp) — it lets tools like Claude search the Substreams registry directly. See the scaffolded `TUTORIAL.md` for setup instructions.

## License

MIT
