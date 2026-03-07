# Substreams SQL Sink - Makefile
#
# Configure these variables or override via environment / .env file
# Example: make dev ENDPOINT=eth.substreams.pinax.network:443 START_BLOCK=20000000

ENDPOINT ?= eth.substreams.pinax.network:443
START_BLOCK ?= 1000000
STOP_BLOCK ?= +100

# PostgreSQL connection string
PG_DSN ?= psql://dev-node:insecure-change-me-in-prod@localhost:5432/substreams?sslmode=disable

.DEFAULT_GOAL := help

.PHONY: help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.PHONY: pack
pack: ## Pack the substreams manifest into an .spkg
	substreams pack

.PHONY: up
up: ## Start Postgres and pgweb via Docker Compose
	docker compose up -d
	@echo "Postgres running on localhost:5432"
	@echo "pgweb UI at http://localhost:8081"

.PHONY: down
down: ## Stop Docker Compose services
	docker compose down

.PHONY: setup
setup: pack ## Create system tables and apply schema.sql to Postgres
	substreams-sink-sql setup $(PG_DSN) substreams.yaml

.PHONY: dev
dev: pack ## Run the sink in development mode (short range, fast flush)
	substreams-sink-sql run $(PG_DSN) substreams.yaml \
		-e $(ENDPOINT) \
		$(START_BLOCK):$(STOP_BLOCK) \
		--undo-buffer-size 0 \
		--on-module-hash-mistmatch=warn \
		--batch-block-flush-interval 1 \
		--live-block-flush-interval 1 \
		--infinite-retry \
		--development-mode

.PHONY: run
run: pack ## Run the sink in production mode (from START_BLOCK, live streaming)
	substreams-sink-sql run $(PG_DSN) substreams.yaml \
		-e $(ENDPOINT) \
		$(START_BLOCK): \
		--infinite-retry

.PHONY: reset
reset: ## Drop and recreate all tables (WARNING: destructive)
	@echo "This will DROP all data. Press Ctrl+C to cancel, Enter to continue."
	@read _confirm
	substreams-sink-sql setup --reset $(PG_DSN) substreams.yaml

.PHONY: clean
clean: ## Remove packed .spkg files
	rm -f *.spkg
