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

**First publish is manual.** npm can only attach a Trusted Publisher to a package that already exists (this applies to the website and to `npm trust` alike), so version `0.1.0` goes out by hand once. Every release after that is OIDC-only.

1. Merge the first release PR (`0.1.0`). The `publish` job will fail on this first run: expected, no trusted publisher yet.
2. Publish by hand from the tag (needs 2FA on your npm account and write access to the `@themusicdev` org):
   ```sh
   git fetch --tags && git checkout v0.1.0
   bun install --frozen-lockfile && bun run build
   npm login
   npm publish --access public
   ```
3. Register the Trusted Publisher. Use the CLI (needs npm >= 11.15, interactive 2FA) or the npmjs.com UI (package -> Settings -> Trusted Publisher -> GitHub Actions):
   ```sh
   npx -y npm@latest trust github @themusicdev/bw-serve-client \
     --repo TheMusicDev/bw-serve-client --file release.yml --env release --allow-publish
   ```
   The values must match exactly (case-sensitive): repo `TheMusicDev/bw-serve-client`, workflow file `release.yml`, environment `release`. npm does not validate them when you save; mistakes only show up at publish time. `package.json` `repository.url` must also match the GitHub repo.
4. **Within 2 days**, ship a second release (`0.1.1`): merge any `fix:`/`feat:` PR, then merge the release PR. npm expires a Trusted Publisher config whose first OIDC publish doesn't succeed within 2 days; if that happens, `npm trust revoke` it and create it again.
5. Lock it down: package -> Settings -> Publishing access -> **Require two-factor authentication and disallow tokens**. OIDC publishes keep working.

Stricter option: register with `--allow-stage-publish` instead of `--allow-publish` and change the last step of the `publish` job to `npm stage publish`. CI then only stages the package, and you approve each release with 2FA (`npm stage approve`).

## Troubleshooting

- **`publish` fails with 404/403 on OIDC**: the Trusted Publisher fields don't match the repo, workflow filename, or environment name exactly.
- **Release PR has no checks**: set `RELEASE_PLEASE_TOKEN` (above).
- **No release PR appears**: need at least one releasable commit (`feat`/`fix`) since the last release; check the `Release` workflow logs.
