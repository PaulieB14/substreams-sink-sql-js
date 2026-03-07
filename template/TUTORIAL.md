# 🚀 Substreams Made Easy — Complete Beginner's Tutorial

> A step-by-step guide to streaming blockchain data into PostgreSQL — no Rust required, no complex infrastructure.

---

## Table of Contents

- [What Is This Tutorial About?](#what-is-this-tutorial-about)
- [Concepts First — What Is Substreams?](#-concepts-first--what-is-substreams)
- [What You Need Before Starting](#️-what-you-need-before-starting)
- [Quick Start — 6 Steps](#-quick-start--from-zero-to-streaming-in-6-steps)
- [Understanding the Key Files](#-understanding-the-key-files)
- [Using Your Own Substreams Package](#-using-your-own-substreams-package)
- [Finding Packages with substreams-search-mcp](#-finding-packages-with-substreams-search-mcp)
- [Switching Chains](#-switching-chains)
- [Advanced Configuration](#️-advanced-configuration)
- [Writing a Custom db_out Module](#-writing-a-custom-db_out-module-advanced)
- [Troubleshooting](#-troubleshooting-common-issues)
- [Quick Reference Checklist](#-quick-reference-checklist)
- [Useful Links](#-useful-links)

---

## What Is This Tutorial About?

This guide walks you through **create-substreams-sink-sql** — a scaffolding tool that sets up everything you need to pull blockchain data from any chain directly into a PostgreSQL database. No Rust expertise required for basic use. No complex DevOps. Just scaffold, configure, and stream.

---

## 🧠 Concepts First — What Is Substreams?

Before touching any code, let's understand what's happening under the hood.

### The Big Picture

Blockchains produce data constantly — every block contains transactions, events, and state changes. The problem? Querying that raw data in real-time is painful and slow.

**Substreams** is a streaming technology built by StreamingFast that solves this. Think of it like a high-speed data pipeline that:

1. **Reads** raw blockchain blocks in parallel (very fast)
2. **Filters & transforms** the data using modules (`.spkg` packages)
3. **Sinks** the output to a destination — in our case, PostgreSQL

### The Flow Visualized

```
🔗 Blockchain (Ethereum, Polygon, Base, etc.)
         ↓
📦 Substreams .spkg package (transforms the data)
         ↓
🔧 substreams-sink-sql (StreamingFast CLI tool)
         ↓
🗄️  PostgreSQL database (your local DB)
         ↓
🌐 pgweb UI (browse your data at localhost:8081)
```

### Key Terms

| Term | What It Means |
|------|---------------|
| `.spkg` | A compiled Substreams package — the "recipe" for what data to extract |
| `db_out` | The output module in an `.spkg` that formats data for SQL databases |
| Sink | A program that takes Substreams output and writes it somewhere (like Postgres) |
| Cursor | A checkpoint that tracks where streaming left off (allows resuming) |
| Endpoint | The gRPC URL for a specific chain's Substreams node |
| DSN | Database connection string (e.g., `psql://user:pass@host:5432/db`) |

---

## 🛠️ What You Need Before Starting

You'll need **4 things** installed and configured:

### 1. The Substreams CLI

```bash
# On Mac (recommended)
brew install streamingfast/tap/substreams

# Or download directly:
# https://github.com/streamingfast/substreams/releases
```

Verify: `substreams --version`

### 2. The substreams-sink-sql CLI

```bash
brew install streamingfast/tap/substreams-sink-sql
```

Verify: `substreams-sink-sql --version`

### 3. Docker Desktop

Download from https://docker.com — this runs your local Postgres and pgweb UI.

Verify: `docker --version`

### 4. A Substreams API Token

Get one free at **https://app.pinax.network** or **https://app.streamingfast.io**.
Sign up, create an API key, and keep it ready.

---

## ⚡ Quick Start — From Zero to Streaming in 6 Steps

### Step 1 — Scaffold Your Project

```bash
npm init substreams-sink-sql my-sink
cd my-sink
```

Or with npx:

```bash
npx create-substreams-sink-sql my-sink
cd my-sink
```

What's inside:

```
📁 my-sink/
├── substreams.yaml       ← Main config: which .spkg to use & sink settings
├── schema.sql            ← Your database table definitions
├── docker-compose.yml    ← Runs Postgres + pgweb locally
├── Makefile              ← Shortcut commands (make up, make dev, etc.)
├── .env.example          ← Template for your environment variables
├── .gitignore
└── TUTORIAL.md           ← This file
```

### Step 2 — Set Your API Token

```bash
cp .env.example .env
# Edit .env and set your token:
# SUBSTREAMS_API_TOKEN=your_token_here
```

> ⚠️ **Never commit your `.env` file to Git.** It's already in `.gitignore`.

### Step 3 — Start Postgres + pgweb

```bash
make up
```

Spins up:
- **Postgres 16** on port `5433` (mapped to avoid conflicts with local Postgres)
- **pgweb** browser UI at http://localhost:8081

### Step 4 — Create the Database Tables

```bash
make setup
```

This creates cursor tracking tables (for resumability) and runs `schema.sql`.

### Step 5 — Start Streaming!

```bash
make dev
```

Runs the sink in **dev mode** — streams a short block range (500 blocks) for fast testing.

You'll see output like:
```
2024-01-01T12:00:00.000Z INFO applying block ... block_num=18000000
2024-01-01T12:00:01.000Z INFO flushed ... rows=42
```

### Step 6 — Browse Your Data

Open **http://localhost:8081** in your browser.

```sql
SELECT * FROM block_meta LIMIT 10;
```

🎉 **You're streaming blockchain data into SQL!**

---

## 📋 Understanding the Key Files

### `substreams.yaml` — The Sink Config

```yaml
package:
  name: substreams_sink_sql
  version: v0.1.0

imports:
  spkg: https://spkg.io/streamingfast/substreams-eth-block-meta-v0.4.3.spkg

sink:
  module: db_out
  type: sf.substreams.sink.sql.v1.Service
```

The `imports.spkg` URL is where you point to your chosen Substreams package.

### `schema.sql` — Your Database Tables

Must match the output of your `.spkg`'s `db_out` module:

```sql
CREATE TABLE IF NOT EXISTS block_meta (
    id          TEXT NOT NULL,
    number      INTEGER NOT NULL,
    hash        TEXT NOT NULL,
    timestamp   TEXT NOT NULL,
    parent_hash TEXT NOT NULL,
    PRIMARY KEY (id)
);
```

### `Makefile` — Your Command Center

| Command | What It Does |
|---------|-------------|
| `make help` | List all available commands |
| `make up` | Start Postgres + pgweb |
| `make down` | Stop Docker services |
| `make setup` | Create system tables + apply schema |
| `make dev` | Stream a short block range (for testing) |
| `make run` | Stream live, production mode |
| `make reset` | Drop all tables and start fresh |
| `make clean` | Remove compiled `.spkg` files |

---

## 🔄 Using Your Own Substreams Package

### Step 1 — Find a Package

Browse **https://substreams.dev** or use the [substreams-search-mcp](#-finding-packages-with-substreams-search-mcp) tool. Look for packages with a `db_out` module.

Popular package types:
- ERC-20 token transfers
- DEX swaps (Uniswap, Curve, etc.)
- NFT mints and transfers
- DeFi lending events

### Step 2 — Update `substreams.yaml`

```yaml
imports:
  # Option A: Remote package
  spkg: https://spkg.io/your-org/your-package-v1.0.0.spkg

  # Option B: Local file
  # spkg: ./your-package-v1.0.0.spkg
```

### Step 3 — Write Your `schema.sql`

Tables must match the `db_out` output. Check the package docs for field names:

```sql
CREATE TABLE IF NOT EXISTS erc20_transfers (
    block_num   INTEGER NOT NULL,
    tx_hash     TEXT NOT NULL,
    log_index   INTEGER NOT NULL,
    contract    TEXT NOT NULL,
    "from"      TEXT NOT NULL,
    "to"        TEXT NOT NULL,
    amount      NUMERIC NOT NULL,
    timestamp   TIMESTAMP NOT NULL,
    PRIMARY KEY (block_num, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_transfers_contract ON erc20_transfers (contract);
CREATE INDEX IF NOT EXISTS idx_transfers_from ON erc20_transfers ("from");
CREATE INDEX IF NOT EXISTS idx_transfers_to ON erc20_transfers ("to");
```

### Step 4 — Apply & Run

```bash
make reset    # Clear old tables
make setup    # Apply new schema
make dev      # Test stream
```

---

## 🔍 Finding Packages with substreams-search-mcp

> 💡 **Power move:** Instead of manually browsing substreams.dev, use the `substreams-search-mcp` tool to search the live registry directly from your AI assistant.

### What Is substreams-search-mcp?

**[substreams-search-mcp](https://www.npmjs.com/package/substreams-search-mcp)** is an [MCP (Model Context Protocol)](https://modelcontextprotocol.io) server that lets AI tools like Claude search the substreams.dev package registry on your behalf. It exposes a `search_substreams` tool that queries the registry by keyword, network, and sort order — right from your chat or IDE.

### Install

```bash
npm install -g substreams-search-mcp
# or one-off:
npx substreams-search-mcp
```

### Add to Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "substreams-search": {
      "command": "npx",
      "args": ["-y", "substreams-search-mcp"]
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude things like *"find me ERC-20 transfer packages on Ethereum"* and it will query the live registry.

### Tool Parameters

| Parameter | Description | Example |
|-----------|-------------|--------|
| `query` | What you're looking for | `"ethereum transfers"` |
| `network` | Filter by blockchain | `"mainnet"`, `"solana"`, `"bnb"` |
| `sort` | Sort order | `"most_downloaded"`, `"last_uploaded"`, `"alphabetical"` |

### Live Search Examples

Real results from the registry:

**Query: `"ethereum transfers"`**

| Package | Network | Version | Downloads |
|---------|---------|---------|----------|
| `substreams-eth-token-transfers` | any | v0.4.0 | 294 |
| `usdc-transfers-substreams` | bnb | v0.1.1 | 90 |
| `erc20-token-transfers-with-metadata` | mainnet | v0.2.0 | 56 |
| `erc20-transfers` | mainnet | v0.2.0 | new |
| `evm-native-transfers` | mainnet | v0.2.0 | new |

**Query: `"block meta"`**

| Package | Network | Version | Downloads |
|---------|---------|---------|----------|
| `mpl-token-metadata-events` | solana | v0.1.7 | 807,242 |
| `substreams-eth-block-meta` | any | v0.4.3 | 329 |
| `erc20-token-transfers-with-metadata` | mainnet | v0.2.0 | 56 |

> 📌 **Note:** Not all packages include a `db_out` module. Check the package page on substreams.dev to confirm before using it with this template.

### Plug In a Found Package

```yaml
# substreams.yaml
imports:
  spkg: https://substreams.dev/packages/substreams-eth-token-transfers/v0.4.0
```

Then:
```bash
make reset && make setup && make dev
```

---

## 🌐 Switching Chains

```bash
# Polygon
make dev ENDPOINT=polygon.substreams.pinax.network:443

# Arbitrum from block 100M
make dev ENDPOINT=arb-one.substreams.pinax.network:443 START_BLOCK=100000000

# Specific block range
make dev START_BLOCK=18000000 STOP_BLOCK=+500
```

### Chain Endpoints

| Chain | Endpoint |
|-------|----------|
| Ethereum | `eth.substreams.pinax.network:443` |
| Polygon | `polygon.substreams.pinax.network:443` |
| Arbitrum | `arb-one.substreams.pinax.network:443` |
| Base | `base-mainnet.substreams.pinax.network:443` |
| BSC | `bsc.substreams.pinax.network:443` |

Full list: [Chains & Endpoints](https://substreams.streamingfast.io/reference-and-specs/chains-and-endpoints)

---

## ⚙️ Advanced Configuration

### Custom Postgres Connection

```bash
make dev PG_DSN=psql://myuser:mypassword@myhost.com:5432/mydb?sslmode=require
```

### Production Mode (Live Streaming)

```bash
make run
```

Streams live blocks indefinitely. The cursor system tracks progress and resumes automatically if interrupted.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|--------|
| `SUBSTREAMS_API_TOKEN` | Your API token (required) | — |
| `ENDPOINT` | Chain gRPC endpoint | eth mainnet |
| `START_BLOCK` | Block to start from | 0 |
| `STOP_BLOCK` | Block to stop at (`+N` = relative) | live |
| `PG_DSN` | Postgres connection string | local Docker |

---

## 🦀 Writing a Custom `db_out` Module (Advanced)

If no existing package covers your needs, write one in Rust:

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

See the full guide: [Substreams SQL docs](https://substreams.streamingfast.io/documentation/consume/sql)

---

## 📊 What to Do After Streaming

Once your data is in PostgreSQL, here's how to put it to work.

### Query Patterns in pgweb

Open http://localhost:8081 and try these queries:

```sql
-- Most recent blocks
SELECT * FROM block_meta ORDER BY number DESC LIMIT 20;

-- Count rows to verify streaming progress
SELECT COUNT(*) FROM block_meta;

-- Time-based queries (if your schema has timestamps)
SELECT * FROM block_meta
WHERE timestamp >= NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC;
```

### Connect External Tools

Your Postgres is accessible at `localhost:5433`. Connect any SQL client or BI tool:

| Tool | Connection |
|------|-----------|
| **psql** (CLI) | `psql postgresql://dev-node:insecure-change-me-in-prod@localhost:5433/substreams` |
| **DBeaver / DataGrip** | Host: `localhost`, Port: `5433`, DB: `substreams` |
| **Metabase / Grafana** | Use the same Postgres DSN as a data source |
| **Python (pandas)** | `pd.read_sql("SELECT * FROM block_meta", "postgresql://dev-node:insecure-change-me-in-prod@localhost:5433/substreams")` |
| **Node.js (pg)** | `new Pool({ connectionString: "postgresql://dev-node:insecure-change-me-in-prod@localhost:5433/substreams" })` |

### Export to CSV

```bash
psql postgresql://dev-node:insecure-change-me-in-prod@localhost:5433/substreams \
  -c "\COPY block_meta TO 'block_meta.csv' CSV HEADER"
```

### Go to Production

When you're ready to stream live data continuously:

```bash
# Switch from dev mode (short range) to production (live streaming)
make run
```

The cursor system automatically tracks progress — if the process crashes or restarts, it picks up exactly where it left off.

For production deployments, consider:
- Using a managed Postgres instance (e.g., Supabase, Neon, RDS)
- Setting `PG_DSN` to your production database
- Running `make run` in a process manager (systemd, pm2, Docker)

---

## 🐛 Troubleshooting Common Issues

### "Permission denied" on make commands

```bash
chmod +x Makefile
```

### Docker containers not starting

```bash
# Check if ports 5432 or 8081 are already in use
lsof -i :5432
lsof -i :8081

make down && make up
```

### "Unauthorized" API token error

- Double-check your token in `.env`
- No spaces around the `=` sign
- Try regenerating at [app.pinax.network](https://app.pinax.network)

### Schema mismatch errors

```bash
make reset   # Drop everything
make setup   # Recreate with updated schema
```

### Streaming is very slow

- Use `+500` block ranges for testing
- Historical blocks stream faster than near-tip blocks
- gRPC streaming is bandwidth-sensitive — check your connection

---

## ✅ Quick Reference Checklist

- [ ] Install substreams CLI
- [ ] Install substreams-sink-sql CLI
- [ ] Install Docker Desktop
- [ ] Get API token from [app.pinax.network](https://app.pinax.network)
- [ ] Scaffold project: `npm init substreams-sink-sql my-sink`
- [ ] Copy `.env.example` → `.env` and add token
- [ ] `make up`
- [ ] `make setup`
- [ ] `make dev`
- [ ] Open http://localhost:8081 and query your data
- [ ] *(Optional)* Install `substreams-search-mcp` and discover packages via AI
- [ ] *(Optional)* Swap in your own `.spkg` and `schema.sql`

---

## 🔗 Useful Links

| Resource | URL |
|----------|-----|
| NPM package | https://www.npmjs.com/package/create-substreams-sink-sql |
| GitHub repo | https://github.com/PaulieB14/substreams-sink-sql-js |
| Browse packages | https://substreams.dev |
| substreams-search-mcp | https://www.npmjs.com/package/substreams-search-mcp |
| Get API token | https://app.pinax.network |
| Substreams docs | https://substreams.streamingfast.io |
| Chain endpoints | https://substreams.streamingfast.io/reference-and-specs/chains-and-endpoints |
| SQL sink docs | https://substreams.streamingfast.io/documentation/consume/sql |
| StreamingFast GitHub | https://github.com/streamingfast |
