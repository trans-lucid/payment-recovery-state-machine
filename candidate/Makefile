.PHONY: dev logs seed test test-unit test-integration eval run clean

dev:
	docker compose up -d

logs:
	docker compose logs -f

seed:
	npm run seed

test:
	npm run test

test-unit:
	npm run test:unit

test-integration:
	npm run test:integration

eval:
	npm run eval

run:
	npm run run

clean:
	docker compose down -v
