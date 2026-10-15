# @themusicdev/bw-serve-client

[![npm](https://img.shields.io/npm/v/@themusicdev/bw-serve-client)](https://www.npmjs.com/package/@themusicdev/bw-serve-client)
[![CI](https://github.com/TheMusicDev/bw-serve-client/actions/workflows/ci.yml/badge.svg)](https://github.com/TheMusicDev/bw-serve-client/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@themusicdev/bw-serve-client)](LICENSE)

Typed, zero-dependency `fetch` client for the [Bitwarden Vault Management API](https://bitwarden.com/help/vault-management-api/), the local REST server started by `bw serve`.

> **Unofficial.** Not affiliated with, endorsed by, or sponsored by Bitwarden, Inc. "Bitwarden" is a trademark of Bitwarden, Inc.

- Plain `fetch`, no runtime dependencies. Works on Bun, Node 18+, and Deno.
- Fully typed; ships ESM + `.d.ts`.
- Injectable `fetch` for tests and proxies.
- Typed errors; secrets never end up in error messages.

## Prerequisites

1. Install the [Bitwarden CLI](https://bitwarden.com/help/cli/) and log in: `bw login`.
2. Start the server: `bw serve` (defaults to `http://localhost:8087`).
3. Unlock the vault, either by starting `bw serve` with `BW_SESSION` set, or by calling `client.unlock(masterPassword)`.

## Install

```sh
bun add @themusicdev/bw-serve-client
# or: npm i @themusicdev/bw-serve-client
```

## Usage

```ts
import { BwServeClient, BwApiError, BwConnectionError, ItemType } from '@themusicdev/bw-serve-client';

const bw = new BwServeClient(); // { baseUrl, fetch, timeoutMs } all optional

const { status } = await bw.status(); // 'unauthenticated' | 'locked' | 'unlocked'
if (status === 'locked') await bw.unlock(process.env.BW_PASSWORD!);

// read
const logins = await bw.listItems({ search: 'github' });
const password = await bw.getPassword(logins[0]!.id);
const totp = await bw.getTotp(logins[0]!.id);

// write
const item = await bw.createItem({
    type: ItemType.Login,
    name: 'example.com',
    login: { username: 'me', password: await bw.generate({ length: 24 }), totp: null },
});
await bw.deleteItem(item.id); // to trash; { permanent: true } to erase

try {
    await bw.getItem('nope');
} catch (error) {
    if (error instanceof BwApiError && error.isLocked) { /* unlock and retry */ }
    else if (error instanceof BwConnectionError) { /* bw serve is not running */ }
    else throw error;
}
```

More in [`examples/`](examples).

## API

| Area | Methods |
|---|---|
| Session | `status`, `unlock`, `lock`, `sync`, `lastSync` |
| Tools | `generate`, `getTemplate` |
| Items | `listItems`, `getItem`, `createItem`, `editItem`, `deleteItem`, `restoreItem`, `archiveItem`, `moveItem` |
| Item fields | `getPassword`, `getUsername`, `getUri`, `getTotp`, `getExposed` |
| Attachments | `uploadAttachment`, `downloadAttachment`, `deleteAttachment` |
| Folders | `listFolders`, `getFolder`, `createFolder`, `editFolder`, `deleteFolder` |
| Organizations | `listCollections`, `listOrganizations`, `listOrgCollections`, `listOrgMembers`, `confirmMember` |

Not yet supported: Bitwarden Send. Open an issue if you need it.

`editItem` replaces the whole item on the server side: fetch it with `getItem`, change it, and send it back.

Routes mirror [`oss-serve-configurator.ts`](https://github.com/bitwarden/clients/blob/main/apps/cli/src/oss-serve-configurator.ts) in the Bitwarden CLI source.

## Security notes

- **`bw serve` has no authentication.** While the vault is unlocked, anything that can reach the port can read every secret. Keep the default `localhost` binding; never expose it to a network.
- `bw serve` rejects requests carrying an `Origin` header (CSRF protection). Server-side runtimes don't send one, but **browsers do, so this client is not meant for browser use**.
- `unlock()` returns the session key in `raw`. Don't log it.
- This client never logs requests or responses, and errors carry only bw's message, status, method and path.

Report vulnerabilities privately: see [SECURITY.md](SECURITY.md).

## Development

```sh
bun install            # also installs lefthook git hooks
bun run lint           # biome
bun run check:types    # tsc
bun run test           # unit tests (mocked fetch)
bun run build          # tsc -> dist/
bun run check:package  # publint + are-the-types-wrong
BW_SERVE_URL=http://localhost:8087 bun run test:integration   # optional, needs a live bw serve
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint). Releases are automated by release-please. See [CONTRIBUTING.md](CONTRIBUTING.md) and [PUBLISH.md](PUBLISH.md).

## License

[MIT](LICENSE)
