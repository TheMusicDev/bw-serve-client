// Opt-in: needs a real `bw serve` for a logged-in account. Run with:
//   BW_SERVE_URL=http://localhost:8087 bun run test:integration
// Read-only and secret-free: asserts shapes and counts, never prints vault contents.
// Vault-backed tests only run when the vault is unlocked.
import { describe, expect, test } from 'bun:test';
import { BwApiError, BwServeClient } from '../../src/index';

const url = process.env.BW_SERVE_URL;
const client = new BwServeClient({ baseUrl: url });
const vault = url
    ? await client.status().then(
          (s) => s.status,
          () => 'unreachable'
      )
    : 'unreachable';

describe.skipIf(!url)('bw serve (live, any state)', () => {
    test('status', () => {
        expect(['unauthenticated', 'locked', 'unlocked']).toContain(vault);
    });

    test('generate password and passphrase', async () => {
        expect((await client.generate({ length: 24 })).length).toBe(24);
        expect((await client.generate({ passphrase: true, words: 4, separator: '-' })).split('-')).toHaveLength(4);
    });
});

describe.skipIf(vault !== 'unlocked')('bw serve (live, unlocked)', () => {
    test('templates', async () => {
        expect(await client.getTemplate('item')).toHaveProperty('name');
        expect(await client.getTemplate('item.login')).toHaveProperty('username');
    });

    test('lists unwrap to arrays', async () => {
        expect(Array.isArray(await client.listFolders())).toBe(true);
        expect(Array.isArray(await client.listOrganizations())).toBe(true);
        expect(await client.listItems({ search: 'zzz-no-match-9f3a' })).toEqual([]);
    });

    test('unknown id -> BwApiError', async () => {
        const err = await client.getItem('00000000-0000-0000-0000-000000000000').catch((e) => e);
        expect(err).toBeInstanceOf(BwApiError);
        expect(err.status).toBe(400);
        expect(err.message).toBe('Not found.');
    });

    test('lastSync is a string', async () => {
        expect(typeof (await client.lastSync())).toBe('string');
    });
});
