.PHONY: install check-render validate-solution validate-candidate-main-expected-failure validate-docker-integration validate-rendered-smoke render scan-safety validate

node_modules/.package-lock.json: package-lock.json package.json
	npm ci

install: node_modules/.package-lock.json

validate-solution: install
	npm run validate:solution

validate-candidate-main-expected-failure: install
	npm run validate:candidate-main-expected-failure

validate-docker-integration: install
	npm run validate:docker-integration

render: install
	npm run render

scan-safety: install
	npm run scan:safety

check-render: install
	npm run check:render

validate-rendered-smoke: install
	npm run validate:rendered-smoke

validate: install
	npm run validate
