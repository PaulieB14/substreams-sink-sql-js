-- Schema for substreams-eth-block-meta
-- Replace or extend this schema to match your Substreams db_out module output.
--
-- Each table should match a table name used in your Substreams
-- DatabaseChanges output (tables.create_row("table_name", ...)).
--
-- Use proper PostgreSQL types: INTEGER, BIGINT, NUMERIC, TEXT, TIMESTAMP, BOOLEAN
-- Add indexes on columns you'll query frequently.

CREATE TABLE IF NOT EXISTS block_meta (
    id              TEXT NOT NULL PRIMARY KEY,
    number          BIGINT NOT NULL,
    hash            TEXT NOT NULL,
    parent_hash     TEXT NOT NULL,
    timestamp       TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_block_meta_number ON block_meta (number);
CREATE INDEX IF NOT EXISTS idx_block_meta_hash ON block_meta (hash);
CREATE INDEX IF NOT EXISTS idx_block_meta_timestamp ON block_meta (timestamp);
