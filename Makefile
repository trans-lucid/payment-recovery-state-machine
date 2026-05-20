.PHONY: check-render validate-solution validate-candidate-main-expected-failure validate-docker-integration render scan-safety validate

validate-solution:
	npm run validate:solution

validate-candidate-main-expected-failure:
	npm run validate:candidate-main-expected-failure

validate-docker-integration:
	npm run validate:docker-integration

render:
	npm run render

scan-safety:
	npm run scan:safety

check-render:
	npm run check:render

validate:
	npm run validate
