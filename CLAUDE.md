# CLAUDE.md

`@themusicdev/bw-serve-client`: zero-dependency, typed `fetch` client for the Bitwarden Vault Management API (`bw serve`). Public npm package, org TheMusicDev. Unofficial.

## Commands

```sh
bun install
bun run lint            # biome check (lint:fix to write)
bun run check:types     # tsc --noEmit
bun run test            # tests/unit, mocked fetch
bun run test:integration  # needs BW_SERVE_URL; skipped otherwise
bun run build           # tsdown -> dist/index.js + index.d.ts (single bundle)
bun run check:package   # publint + attw
```

Run lint, check:types, and test before declaring work done.

## Layout

- `src/client.ts`: `BwServeClient`. One private `#call` (JSON + envelope handling) and `#send` (raw fetch + error mapping). Each endpoint is a one-liner on top.
- `src/types.ts`: API types. `src/errors.ts`: `BwApiError`, `BwConnectionError`. `src/index.ts`: public exports.
- `tests/unit/`: stub-fetch tests. `tests/integration/`: opt-in, read-only, live `bw serve`.

## Source of truth for the API

Routes and behavior: `apps/cli/src/oss-serve-configurator.ts` in https://github.com/bitwarden/clients (the help page is a rendered Swagger and hard to scrape). Facts that matter:
- Every reply is `{ success, message?, data? }`; failures are HTTP 400 + `success:false`.
- `data` is wrapped: lists `{object:'list',data}`, strings `{object:'string',data}`, templates `{object:'template',template}`. `unwrap()` in `client.ts` flattens these.
- Query keys are read lowercase (`folderid`, `organizationid`, `itemid`); `toQueryString` lowercases them.
- Locked vault errors are `"Vault is locked."` / `"You are not logged in."` (`BwApiError.isLocked`).
- No auth on the server. Browsers can't call it (Origin protection), so Node/Bun/Deno only.

To add an endpoint: add the method in `client.ts` (use `seg()` for path ids), types in `types.ts`, a unit test asserting URL, method, and body/query, and a row in the README API table.

## Rules

- **No runtime dependencies.** devDependencies only. Plain `fetch`, no axios/ofetch/zod.
- Runtime-agnostic code in `src/`: no `Bun.*`, no `node:*` imports.
- Relative imports have **no file extension** (`from './errors'`). tsdown bundles `src/` into one ESM file + one `.d.ts`, so dist is valid under plain Node ESM; don't switch back to tsc-per-file emit.
- **Never log, stringify, or put secrets (passwords, item bodies, session keys) in errors, fixtures, or test output.**
- Style: Biome (4 spaces, single quotes, semicolons, width 120). Don't hand-format.
- Commits: Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, `ci:`, `test:`, `refactor:`). `feat` -> minor, `fix` -> patch, `feat!`/`BREAKING CHANGE:` -> major (minor while < 1.0). release-please reads these; never hand-edit `CHANGELOG.md`, the `version` in `package.json`, or `.release-please-manifest.json`.
- **Do not stage, commit, or push unless explicitly asked.**
