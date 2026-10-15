# Publishing `@themusicdev/bw-serve-client`

Releases are automated by [release-please](https://github.com/googleapis/release-please) + npm Trusted Publishing (OIDC). No npm token lives in the repo.

## How a release happens

1. Conventional-commit PRs land on `main` (`feat:` -> minor, `fix:` -> patch).
2. The `Release` workflow opens/updates a PR titled `chore(main): release X.Y.Z` with the version bump and `CHANGELOG.md`.
3. Merging that PR creates the `vX.Y.Z` tag and GitHub Release, then the `publish` job lints, tests, builds, runs `publint`/`attw`, and runs `npm publish` with provenance.

Never edit `CHANGELOG.md`, `version`, or `.release-please-manifest.json` by hand. To force a version (e.g. 1.0.0), add a `Release-As: 1.0.0` footer to a commit.

The tarball contains only `dist/`, `LICENSE`, `README.md`, `package.json` (`files: ["dist"]`; CI asserts it).

## One-time setup

**GitHub** (repo settings)
- Actions -> General -> Workflow permissions: enable **Allow GitHub Actions to create and approve pull requests**.
- Environments -> create **`release`** (optionally add required reviewers / restrict to `main`).
- Optional: add a PAT as secret `RELEASE_PLEASE_TOKEN` (needs `contents` + `pull-requests` write). PRs created with the default `GITHUB_TOKEN` do not trigger CI, so without it the release PR shows no checks.

**First publish is manual.** npm can't configure a Trusted Publisher until the package exists:

1. Merge the first release PR (`0.1.0`). The `publish` job will fail on this first run: expected, no trusted publisher yet.
2. Publish by hand from the tag:
   ```sh
   git fetch --tags && git checkout v0.1.0
   bun install --frozen-lockfile && bun run build
   npm publish --access public      # npm login first; needs write access to the @themusicdev org
   ```
3. On npmjs.com -> package -> Settings -> **Trusted Publisher** -> GitHub Actions:
   - Organization/user: `TheMusicDev`
   - Repository: `bw-serve-client`
   - Workflow filename: `release.yml`
   - Environment: `release`
4. From `0.1.1` on, merging the release PR publishes automatically.

## Troubleshooting

- **`publish` fails with 404/403 on OIDC**: the Trusted Publisher fields don't match the repo, workflow filename, or environment name exactly.
- **Release PR has no checks**: set `RELEASE_PLEASE_TOKEN` (above).
- **No release PR appears**: need at least one releasable commit (`feat`/`fix`) since the last release; check the `Release` workflow logs.
