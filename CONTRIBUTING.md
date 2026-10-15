# Contributing

Thanks for helping. Small, focused PRs are easiest to review.

## Setup

```sh
bun install   # installs git hooks via lefthook
```

Requires [Bun](https://bun.sh) 1.3+. The [Bitwarden CLI](https://bitwarden.com/help/cli/) is only needed for the optional integration tests.

## Workflow

1. Fork, branch from `main`.
2. Make the change. Add or update tests in `tests/unit/`.
3. `bun run lint && bun run check:types && bun run test` must pass (the pre-commit hook runs them on staged files).
4. Open a PR. **The PR title must be a Conventional Commit** (`feat(client): add sendList`), because PRs are squash-merged and release-please builds the changelog from that title. CI checks it.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/), enforced locally by the `commit-msg` hook and in CI.

| Type | Effect |
|---|---|
| `feat` | minor release |
| `fix`, `perf` | patch release |
| `feat!` / `BREAKING CHANGE:` footer | major release (minor while < 1.0) |
| `docs`, `test`, `chore`, `ci`, `refactor`, `build` | no release |

## Adding an endpoint

See "Source of truth for the API" in [CLAUDE.md](CLAUDE.md). In short: method in `src/client.ts`, types in `src/types.ts`, a unit test, a README table row.

## Ground rules

- No runtime dependencies.
- Never commit real vault data or secrets, even in tests. Use obvious fakes.
- Integration tests must stay read-only.

## Releases

Maintainers only; automated by release-please. See [PUBLISH.md](PUBLISH.md).
