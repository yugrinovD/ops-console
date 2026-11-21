.PHONY: help install dev build start lint typecheck test e2e docker-build up down clean

help:
	@echo "ops-console"
	@echo "  make install       npm ci"
	@echo "  make dev           Next.js dev server on :3100"
	@echo "  make build         production build"
	@echo "  make start         run the production build on :3100"
	@echo "  make lint          ESLint"
	@echo "  make typecheck     tsc --noEmit"
	@echo "  make test          Vitest + RTL + MSW"
	@echo "  make e2e           build + Playwright against mock upstreams"
	@echo "  make docker-build  build the runtime image"
	@echo "  make up            docker compose up -d --build"
	@echo "  make down          docker compose down"
	@echo "  make clean         remove local build/test artifacts"

install:
	npm ci

dev:
	npm run dev

build:
	npm run build

start:
	npm run start

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm test

e2e:
	npm run build
	npx playwright test

docker-build:
	docker build -t ops-console:local .

up:
	docker compose up -d --build

down:
	docker compose down

clean:
	rm -rf .next coverage test-results playwright-report data
