import { describe, expect, test } from 'bun:test';
import { BwApiError, BwConnectionError, BwServeClient, type FetchLike } from '../../src/index';

interface Call {
    url: string;
    init: RequestInit;
}

/** Stub fetch that records calls and replies with `reply`. */
function stub(reply: unknown, status = 200) {
    const calls: Call[] = [];
    const fetch: FetchLike = async (url, init = {}) => {
        calls.push({ url, init });
        return new Response(typeof reply === 'string' ? reply : JSON.stringify(reply), { status });
    };
    return { client: new BwServeClient({ fetch }), calls };
}

const ok = (data?: unknown) => ({ success: true, data });

describe('envelope unwrapping', () => {
    test('list -> array', async () => {
        const { client } = stub(ok({ object: 'list', data: [{ id: '1', name: 'a' }] }));
        expect(await client.listItems()).toEqual([{ id: '1', name: 'a' } as never]);
    });

    test('string -> string', async () => {
        const { client } = stub(ok({ object: 'string', data: 'hunter2' }));
        expect(await client.getPassword('x')).toBe('hunter2');
    });

    test('template -> template body (status)', async () => {
        const { client } = stub(ok({ object: 'template', template: { status: 'locked', serverUrl: null } }));
        expect((await client.status()).status).toBe('locked');
    });

    test('single object passes through', async () => {
        const { client } = stub(ok({ object: 'folder', id: 'f1', name: 'Work' }));
        expect((await client.getFolder('f1')).name).toBe('Work');
    });

    test('no data -> undefined', async () => {
        const { client } = stub({ success: true });
        expect(await client.deleteFolder('f1')).toBeUndefined();
    });
});

describe('requests', () => {
    test('lowercases query keys, drops false/undefined', async () => {
        const { client, calls } = stub(ok({ object: 'list', data: [] }));
        await client.listItems({ folderId: 'f1', organizationId: 'o1', trash: false, search: undefined });
        expect(calls[0]?.url).toBe('http://localhost:8087/list/object/items?folderid=f1&organizationid=o1');
    });

    test('trims trailing slash from baseUrl and encodes ids', async () => {
        const calls: string[] = [];
        const client = new BwServeClient({
            baseUrl: 'http://bw:9000//',
            fetch: async (url) => {
                calls.push(url);
                return new Response(JSON.stringify(ok({ object: 'string', data: 'x' })));
            },
        });
        await client.getUsername('a b/c');
        expect(calls[0]).toBe('http://bw:9000/object/username/a%20b%2Fc');
    });

    test('JSON body gets content-type; unlock sends password', async () => {
        const { client, calls } = stub(ok({ object: 'message', title: 'unlocked' }));
        await client.unlock('pw');
        expect(calls[0]?.init.method).toBe('POST');
        expect(calls[0]?.init.body).toBe('{"password":"pw"}');
        expect(calls[0]?.init.headers).toEqual({ 'Content-Type': 'application/json' });
    });

    test('moveItem body is a bare array', async () => {
        const { client, calls } = stub(ok({ object: 'item', id: 'i' }));
        await client.moveItem('i', 'o', ['c1', 'c2']);
        expect(calls[0]?.url).toBe('http://localhost:8087/move/i/o');
        expect(calls[0]?.init.body).toBe('["c1","c2"]');
    });

    test('upload sends multipart without a manual content-type', async () => {
        const { client, calls } = stub(ok({ object: 'item', id: 'i' }));
        await client.uploadAttachment('i', new Blob(['hi']), 'a.txt');
        expect(calls[0]?.url).toBe('http://localhost:8087/attachment?itemid=i');
        expect(calls[0]?.init.body).toBeInstanceOf(FormData);
        expect(calls[0]?.init.headers).toBeUndefined();
    });

    test('download returns raw bytes', async () => {
        const client = new BwServeClient({ fetch: async () => new Response(new Uint8Array([1, 2, 3])) });
        expect(await client.downloadAttachment('i', 'a')).toEqual(new Uint8Array([1, 2, 3]));
    });

    test('generate sends only set options', async () => {
        const { client, calls } = stub(ok({ object: 'string', data: 'pw' }));
        await client.generate({ length: 20, special: 2, passphrase: false });
        expect(calls[0]?.url).toBe('http://localhost:8087/generate?length=20&special=2');
    });
});

describe('errors', () => {
    test('400 + success:false -> BwApiError with server message, isLocked', async () => {
        const { client } = stub({ success: false, message: 'Vault is locked.' }, 400);
        const err = await client.listItems().catch((e) => e);
        expect(err).toBeInstanceOf(BwApiError);
        expect(err.message).toBe('Vault is locked.');
        expect(err.status).toBe(400);
        expect(err.isLocked).toBe(true);
    });

    test('200 + success:false still throws', async () => {
        const { client } = stub({ success: false, message: 'Not found.' });
        await expect(client.getItem('x')).rejects.toBeInstanceOf(BwApiError);
    });

    test('non-JSON body throws BwApiError', async () => {
        const { client } = stub('<html>');
        await expect(client.status()).rejects.toBeInstanceOf(BwApiError);
    });

    test('error never echoes the request body', async () => {
        const { client } = stub({ success: false, message: 'bad' }, 400);
        const err = await client.unlock('super-secret-pw').catch((e) => e);
        expect(JSON.stringify(err)).not.toContain('super-secret-pw');
        expect(err.message).not.toContain('super-secret-pw');
    });

    test('network failure -> BwConnectionError with cause', async () => {
        const cause = new TypeError('fetch failed');
        const client = new BwServeClient({
            fetch: async () => {
                throw cause;
            },
        });
        const err = await client.status().catch((e) => e);
        expect(err).toBeInstanceOf(BwConnectionError);
        expect(err.cause).toBe(cause);
    });
});
