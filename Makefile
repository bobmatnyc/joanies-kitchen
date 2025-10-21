.PHONY: help install dev build start clean

# Default target
.DEFAULT_GOAL := help

##@ General

help: ## Display this help message
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies
	pnpm install

dev: ## Start development server (port 3002)
	pnpm dev

dev-clean: ## Clean cache and restart dev server
	@echo "Cleaning Next.js cache..."
	@rm -rf .next
	@rm -rf node_modules/.cache
	@echo "Stopping existing dev servers on port 3002..."
	@lsof -ti:3002 | xargs kill -9 2>/dev/null || true
	@sleep 2
	@echo "Starting clean dev server..."
	@pnpm dev

dev-stable: ## Start dev server without Turbopack (more stable)
	@echo "Starting development server with webpack (stable mode)..."
	@rm -rf .next
	@next dev -p 3002

dev-monitor: ## Start dev server with auto-restart monitoring
	@echo "Starting monitored dev server..."
	@bash scripts/dev-server-monitor.sh

dev-stop: ## Stop all Next.js dev servers on port 3002
	@echo "Stopping dev servers on port 3002..."
	@lsof -ti:3002 | xargs kill -9 2>/dev/null || true
	@pkill -f "next dev.*3002" 2>/dev/null || true
	@echo "All dev servers stopped"

dev-logs: ## Show dev server logs
	@tail -f tmp/logs/dev-server.log 2>/dev/null || echo "No logs found. Run 'make dev-monitor' first."

build: ## Build for production
	pnpm build

start: ## Start production server
	pnpm start

clean: ## Clean build artifacts and caches
	rm -rf .next
	rm -rf node_modules/.cache
	rm -rf tmp/logs
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

##@ Image Generation

image-setup: ## Setup image generation environment (one-time)
	@echo "Setting up image generation with Stable Diffusion XL..."
	@./scripts/image-gen/setup.sh

image-test-mps: ## Test Metal Performance Shaders availability
	@echo "Testing MPS availability..."
	@source venv-image-gen/bin/activate && python scripts/image-gen/test_mps.py

image-test: ## Generate test image
	@echo "Generating test image..."
	@source venv-image-gen/bin/activate && python scripts/image-gen/generate_test.py

image-generate: ## Generate recipe image (usage: make image-generate RECIPE="Pasta Carbonara")
	@if [ -z "$(RECIPE)" ]; then \
		echo "Error: RECIPE not specified"; \
		echo "Usage: make image-generate RECIPE=\"Your Recipe Name\""; \
		exit 1; \
	fi
	@echo "Generating image for: $(RECIPE)"
	@source venv-image-gen/bin/activate && python scripts/image-gen/recipe_image_generator.py --recipe "$(RECIPE)"

image-batch: ## Batch generate from file (usage: make image-batch FILE=recipes.txt)
	@if [ -z "$(FILE)" ]; then \
		FILE="scripts/image-gen/examples/recipes.txt"; \
	fi
	@echo "Batch generating from: $(FILE)"
	@source venv-image-gen/bin/activate && python scripts/image-gen/recipe_image_generator.py --batch "$(FILE)"

image-docs: ## View image generation documentation
	@cat scripts/image-gen/QUICKSTART.md

##@ Documentation

docs-serve: ## Serve documentation locally (TO BE IMPLEMENTED)
	@echo "TODO: Implement documentation server"

docs-build: ## Build documentation (TO BE IMPLEMENTED)
	@echo "TODO: Implement documentation build"
