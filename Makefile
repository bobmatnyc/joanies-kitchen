.PHONY: help install dev build start clean

# Default target
.DEFAULT_GOAL := help

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies
	pnpm install

dev: ## Start development server (port 3004)
	pnpm dev

build: ## Build for production
	pnpm build

start: ## Start production server
	pnpm start

clean: ## Clean build artifacts and caches
	rm -rf .next
	rm -rf node_modules/.cache
	@echo "Cleaned build artifacts"

##@ Database

db-push: ## Push database schema changes
	pnpm db:push

db-studio: ## Open Drizzle Studio
	pnpm db:studio

db-generate: ## Generate database migrations
	pnpm db:generate

db-migrate: ## Run database migrations
	pnpm db:migrate

db-init: ## Initialize database
	pnpm db:init

db-seed: ## Seed system recipes
	pnpm db:seed:system

##@ Authentication

auth-validate: ## Validate authentication configuration
	pnpm auth:validate

auth-test-prod: ## Test production keys on localhost
	node scripts/test-production-keys.js

##@ Code Quality (To Be Implemented)

lint: ## Run linter (TO BE IMPLEMENTED)
	@echo "TODO: Implement linting with ESLint"
	@echo "Run: pnpm lint"

lint-fix: ## Auto-fix linting issues (TO BE IMPLEMENTED)
	@echo "TODO: Implement lint auto-fix"
	@echo "Run: pnpm lint:fix"

format: ## Format code (TO BE IMPLEMENTED)
	@echo "TODO: Implement code formatting with Prettier"
	@echo "Run: pnpm format"

typecheck: ## Run TypeScript type checking
	pnpm tsc --noEmit

test: ## Run all tests (TO BE IMPLEMENTED)
	@echo "TODO: Implement testing with Vitest"
	@echo "Run: pnpm test"

test-unit: ## Run unit tests (TO BE IMPLEMENTED)
	@echo "TODO: Implement unit tests"
	@echo "Run: pnpm test:unit"

test-integration: ## Run integration tests (TO BE IMPLEMENTED)
	@echo "TODO: Implement integration tests"
	@echo "Run: pnpm test:integration"

test-e2e: ## Run end-to-end tests (TO BE IMPLEMENTED)
	@echo "TODO: Implement E2E tests with Playwright"
	@echo "Run: pnpm test:e2e"

quality: typecheck ## Run all quality checks
	@echo "✓ Type checking complete"
	@echo "TODO: Add linting, formatting, and tests"

##@ Utilities

reset: clean install db-push ## Reset environment (clean + install + db push)
	@echo "Environment reset complete"

logs: ## View development logs
	@echo "Check console output from 'make dev'"

setup: install db-push db-seed ## Complete setup for new developers
	@echo "Setup complete! Run 'make dev' to start"

##@ Documentation

docs-serve: ## Serve documentation locally (TO BE IMPLEMENTED)
	@echo "TODO: Implement documentation server"

docs-build: ## Build documentation (TO BE IMPLEMENTED)
	@echo "TODO: Implement documentation build"
