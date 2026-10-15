// Opt-in: needs a real `bw serve` (and a logged-in account). Run with:
//   BW_SERVE_URL=http://localhost:8087 bun run test:integration
// Only read-only calls here; nothing in the vault is changed.
import { describe, expect, test } from 'bun:test';
import { BwServeClient } from '../../src/index';

const url = process.env.BW_SERVE_URL;

describe.skipIf(!url)('bw serve (live)', () => {
    const client = new BwServeClient({ baseUrl: url });

    test('status', async () => {
        const status = await client.status();
        expect(['unauthenticated', 'locked', 'unlocked']).toContain(status.status);
    });

    test('generate', async () => {
        expect((await client.generate({ length: 24 })).length).toBe(24);
    });

    test('templates', async () => {
        expect(await client.getTemplate('item')).toHaveProperty('name');
    });
});
