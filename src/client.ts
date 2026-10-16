import { BwApiError, BwConnectionError } from './errors';
import type {
    Collection,
    Folder,
    GenerateOptions,
    Item,
    ListItemsFilter,
    Message,
    NewItem,
    Organization,
    OrgMember,
    Status,
    TemplateType,
} from './types';

/** Minimal fetch signature, so any fetch (Bun, Node, undici, a test stub) fits. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface BwServeClientOptions {
    /** Where `bw serve` listens. Default `http://localhost:8087`. */
    baseUrl?: string;
    /** Custom fetch (tests, proxies, instrumentation). Default `globalThis.fetch`. */
    fetch?: FetchLike;
    /** Abort a request after this many ms. Default 30000. */
    timeoutMs?: number;
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface CallOptions {
    query?: Query;
    body?: BodyInit | object;
}

interface Envelope {
    success: boolean;
    message?: string;
    data?: unknown;
}

/** bw wraps payloads: lists as `{object:'list',data}`, strings as `{object:'string',data}`, templates as `{object:'template',template}`. */
function unwrap(data: unknown): unknown {
    if (data && typeof data === 'object' && 'object' in data) {
        const d = data as { object: string; data?: unknown; template?: unknown };
        if (d.object === 'list' || d.object === 'string') return d.data;
        if (d.object === 'template') return d.template;
    }
    return data;
}

/** bw reads lowercase query keys (`folderid`); false/undefined are dropped. */
function toQueryString(query: Query = {}): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
        if (value === undefined || value === null || value === false) continue;
        params.set(key.toLowerCase(), String(value));
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
}

const seg = encodeURIComponent;

/**
 * Client for the Bitwarden Vault Management API (`bw serve`).
 * Item payloads contain secrets: this client never logs them and keeps them out of error messages.
 */
export class BwServeClient {
    readonly #baseUrl: string;
    readonly #fetch: FetchLike;
    readonly #timeoutMs: number;

    constructor({
        baseUrl = 'http://localhost:8087',
        fetch: fetchImpl,
        timeoutMs = 30_000,
    }: BwServeClientOptions = {}) {
        this.#baseUrl = baseUrl.replace(/\/+$/, '');
        this.#fetch = fetchImpl ?? ((input, init) => globalThis.fetch(input, init));
        this.#timeoutMs = timeoutMs;
    }

    async #send(method: string, path: string, { query, body }: CallOptions = {}): Promise<Response> {
        const isJson = body !== undefined && !(body instanceof FormData) && typeof body === 'object';
        const init: RequestInit = {
            method,
            signal: AbortSignal.timeout(this.#timeoutMs),
            ...(body !== undefined && { body: isJson ? JSON.stringify(body) : (body as BodyInit) }),
            ...(isJson && { headers: { 'Content-Type': 'application/json' } }),
        };
        let res: Response;
        try {
            res = await this.#fetch(`${this.#baseUrl}${path}${toQueryString(query)}`, init);
        } catch (error) {
            throw new BwConnectionError(this.#baseUrl, error);
        }
        if (res.ok) return res;
        // bw answers failures with 400 + {success:false,message}
        const env = await res.json().catch(() => undefined);
        throw new BwApiError(
            (env as Envelope | undefined)?.message ?? (res.statusText || `HTTP ${res.status}`),
            res.status,
            method,
            path
        );
    }

    async #call<T>(method: string, path: string, options?: CallOptions): Promise<T> {
        const res = await this.#send(method, path, options);
        const env = (await res.json().catch(() => undefined)) as Envelope | undefined;
        if (!env || env.success === false) {
            throw new BwApiError(env?.message ?? 'Unexpected response from bw serve', res.status, method, path);
        }
        return unwrap(env.data) as T;
    }

    // ---- session ----

    /** Auth state. Works while locked; use it to check before other calls. */
    status(): Promise<Status> {
        return this.#call('GET', '/status');
    }

    /** Unlock with the master password. `raw` in the reply is the session key: do not log it. */
    unlock(password: string): Promise<Message> {
        return this.#call('POST', '/unlock', { body: { password } });
    }

    lock(): Promise<Message> {
        return this.#call('POST', '/lock');
    }

    /** Sync with the server. */
    sync({ force }: { force?: boolean } = {}): Promise<string> {
        return this.#call('POST', '/sync', { query: { force } });
    }

    /** ISO timestamp of the last sync, or null. */
    lastSync(): Promise<string | null> {
        return this.#call('POST', '/sync', { query: { last: true } });
    }

    // ---- tools ----

    generate(options: GenerateOptions = {}): Promise<string> {
        return this.#call('GET', '/generate', { query: { ...options } });
    }

    /** Field templates for building request bodies, e.g. `getTemplate('item.login')`. */
    getTemplate<T = Record<string, unknown>>(type: TemplateType): Promise<T> {
        return this.#call('GET', `/object/template/${seg(type)}`);
    }

    // ---- items ----

    listItems(filter: ListItemsFilter = {}): Promise<Item[]> {
        return this.#call('GET', '/list/object/items', { query: { ...filter } });
    }

    getItem(id: string): Promise<Item> {
        return this.#call('GET', `/object/item/${seg(id)}`);
    }

    createItem(item: NewItem): Promise<Item> {
        return this.#call('POST', '/object/item', { body: item });
    }

    /** `bw` replaces the whole item: pass the full object from `getItem`, modified. */
    editItem(id: string, item: Partial<Item>): Promise<Item> {
        return this.#call('PUT', `/object/item/${seg(id)}`, { body: item });
    }

    /** Moves to trash unless `permanent`. */
    deleteItem(id: string, { permanent }: { permanent?: boolean } = {}): Promise<void> {
        return this.#call('DELETE', `/object/item/${seg(id)}`, { query: { permanent } });
    }

    restoreItem(id: string): Promise<Item> {
        return this.#call('POST', `/restore/item/${seg(id)}`);
    }

    archiveItem(id: string): Promise<Item> {
        return this.#call('POST', `/archive/item/${seg(id)}`);
    }

    /** Share an item to an organization's collections. */
    moveItem(id: string, organizationId: string, collectionIds: string[]): Promise<Item> {
        return this.#call('POST', `/move/${seg(id)}/${seg(organizationId)}`, { body: collectionIds });
    }

    // Each takes an item id or a search term; throws BwApiError if nothing (or more than one item) matches.
    getPassword(idOrSearch: string): Promise<string> {
        return this.#call('GET', `/object/password/${seg(idOrSearch)}`);
    }

    getUsername(idOrSearch: string): Promise<string> {
        return this.#call('GET', `/object/username/${seg(idOrSearch)}`);
    }

    getUri(idOrSearch: string): Promise<string> {
        return this.#call('GET', `/object/uri/${seg(idOrSearch)}`);
    }

    /** Current TOTP code. */
    getTotp(idOrSearch: string): Promise<string> {
        return this.#call('GET', `/object/totp/${seg(idOrSearch)}`);
    }

    /** How many times the item's password appears in known data breaches. */
    getExposed(idOrSearch: string): Promise<string> {
        return this.#call('GET', `/object/exposed/${seg(idOrSearch)}`);
    }

    // ---- attachments ----

    uploadAttachment(itemId: string, file: Blob, fileName: string): Promise<Item> {
        const form = new FormData();
        form.set('file', file, fileName);
        return this.#call('POST', '/attachment', { query: { itemId }, body: form });
    }

    async downloadAttachment(itemId: string, attachmentId: string): Promise<Uint8Array> {
        const res = await this.#send('GET', `/object/attachment/${seg(attachmentId)}`, { query: { itemId } });
        return new Uint8Array(await res.arrayBuffer());
    }

    deleteAttachment(itemId: string, attachmentId: string): Promise<void> {
        return this.#call('DELETE', `/object/attachment/${seg(attachmentId)}`, { query: { itemId } });
    }

    // ---- folders ----

    listFolders({ search }: { search?: string } = {}): Promise<Folder[]> {
        return this.#call('GET', '/list/object/folders', { query: { search } });
    }

    getFolder(id: string): Promise<Folder> {
        return this.#call('GET', `/object/folder/${seg(id)}`);
    }

    createFolder(name: string): Promise<Folder> {
        return this.#call('POST', '/object/folder', { body: { name } });
    }

    editFolder(id: string, name: string): Promise<Folder> {
        return this.#call('PUT', `/object/folder/${seg(id)}`, { body: { name } });
    }

    deleteFolder(id: string): Promise<void> {
        return this.#call('DELETE', `/object/folder/${seg(id)}`);
    }

    // ---- organizations ----

    listCollections({ search }: { search?: string } = {}): Promise<Collection[]> {
        return this.#call('GET', '/list/object/collections', { query: { search } });
    }

    listOrganizations(): Promise<Organization[]> {
        return this.#call('GET', '/list/object/organizations');
    }

    listOrgCollections(organizationId: string): Promise<Collection[]> {
        return this.#call('GET', '/list/object/org-collections', { query: { organizationId } });
    }

    listOrgMembers(organizationId: string): Promise<OrgMember[]> {
        return this.#call('GET', '/list/object/org-members', { query: { organizationId } });
    }

    /** Confirm an accepted organization member. */
    confirmMember(memberId: string, organizationId: string): Promise<void> {
        return this.#call('POST', `/confirm/org-member/${seg(memberId)}`, { query: { organizationId } });
    }
}
