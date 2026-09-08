# The API is plain Go. `make test` runs natively; `make wasm` produces the
# Cloudflare Worker, which wrangler picks up from ./build.

VERSION ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
GZIP_LIMIT := 3000000   # Workers free plan: 3 MB after compression

# sqlc turns internal/store/queries.sql into internal/store/queries. Point
# SQLC at a local binary to skip compiling it: `make sqlc SQLC=sqlc`.
SQLC_VERSION := 1.31.1
SQLC ?= go run github.com/sqlc-dev/sqlc/cmd/sqlc@v$(SQLC_VERSION)

.PHONY: test fmt sqlc sqlc-check wasm size dev run clean

test:
	go vet ./...
	go test ./... -count=1

fmt:
	@test -z "$$(gofmt -l .)" || { gofmt -l .; echo "run gofmt -w ."; exit 1; }

sqlc:
	$(SQLC) generate

# Fails if internal/store/queries is out of date with queries.sql or the
# migrations — i.e. someone edited SQL and forgot to regenerate.
sqlc-check:
	$(SQLC) diff

# workers-assets-gen writes the JS shim (and wipes ./build first), then the
# Go program is compiled to WebAssembly beside it.
wasm:
	go run github.com/syumai/workers-go/cmd/workers-assets-gen -mode=go -o build
	GOOS=js GOARCH=wasm go build -trimpath -ldflags "-s -w -X main.version=$(VERSION)" -o build/app.wasm .

# Fails if the compressed binary would be refused by the free plan.
size: wasm
	@bytes=$$(gzip -9 -c build/app.wasm | wc -c); \
	echo "app.wasm: $$(wc -c < build/app.wasm) raw, $$bytes gzipped"; \
	test $$bytes -lt $(GZIP_LIMIT) || { echo "over the $(GZIP_LIMIT)-byte limit"; exit 1; }

# The real Worker on a local D1, via wrangler.
dev:
	npm run dev

# The same API on net/http with an in-memory store — no wrangler needed.
run:
	go run .

clean:
	rm -rf build
