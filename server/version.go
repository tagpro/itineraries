package main

// version is stamped at build time with -ldflags "-X main.version=…" and
// reported by /api/v1/healthz, so a deployed Worker can say which commit
// it is.
var version = "dev"
