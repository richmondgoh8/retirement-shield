SHELL := /bin/sh
.DEFAULT_GOAL := dev

PORT ?= 4173

.PHONY: run build stop

run:
	$(MAKE) build
	$(MAKE) stop
	@printf '\nOpen http://localhost:$(PORT)\nPress Ctrl+C to stop.\n\n'
	python3 -m http.server $(PORT) --bind 127.0.0.1 --directory dist

build:
	npm run build

stop:
	@set -eu; \
	command -v lsof >/dev/null 2>&1 || { echo 'Install lsof to clear the local port.' >&2; exit 1; }; \
	pids=$$(lsof -tiTCP:$(PORT) -sTCP:LISTEN 2>/dev/null || true); \
	if [ -n "$$pids" ]; then \
		printf 'Stopping listener(s) on port $(PORT): %s\n' "$$pids"; \
		kill $$pids; \
	fi; \
	attempt=0; \
	while lsof -tiTCP:$(PORT) -sTCP:LISTEN >/dev/null 2>&1; do \
		if [ "$$attempt" -ge 30 ]; then echo 'Port $(PORT) is still occupied.' >&2; exit 1; fi; \
		sleep 0.1; \
		attempt=$$((attempt + 1)); \
	done
