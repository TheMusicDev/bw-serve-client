/** Vault item types. */
export const ItemType = { Login: 1, SecureNote: 2, Card: 3, Identity: 4, SshKey: 5 } as const;
export type ItemTypeValue = (typeof ItemType)[keyof typeof ItemType];

export interface Status {
    serverUrl: string | null;
    lastSync: string | null;
    userEmail?: string;
    userId?: string;
    status: 'unauthenticated' | 'locked' | 'unlocked';
}

/** Reply to `lock` / `unlock`. `raw` on unlock is the session key: treat it as a secret. */
export interface Message {
    object: 'message';
    title: string;
    message?: string;
    raw?: string;
}

export interface LoginUri {
    match: number | null;
    uri: string | null;
}

export interface Login {
    uris?: LoginUri[];
    username: string | null;
    password: string | null;
    totp: string | null;
    passwordRevisionDate?: string | null;
}

export interface Field {
    name: string;
    value: string | null;
    /** 0 text, 1 hidden, 2 boolean, 3 linked */
    type: 0 | 1 | 2 | 3;
    linkedId?: number | null;
}

export interface Attachment {
    id: string;
    fileName: string;
    size: string;
    sizeName: string;
    url: string;
}

export interface Item {
    object: 'item';
    id: string;
    organizationId: string | null;
    folderId: string | null;
    type: ItemTypeValue;
    reprompt: 0 | 1;
    name: string;
    notes: string | null;
    favorite: boolean;
    login?: Login;
    secureNote?: { type: 0 };
    card?: Record<string, string | null>;
    identity?: Record<string, string | null>;
    sshKey?: Record<string, string | null>;
    fields?: Field[];
    attachments?: Attachment[];
    collectionIds: string[] | null;
    revisionDate: string;
    creationDate: string;
    deletedDate: string | null;
}

/** Body for `createItem`. Use `getTemplate('item')` to see every field `bw` accepts. */
export type NewItem = Pick<Item, 'type' | 'name'> &
    Partial<Omit<Item, 'object' | 'id' | 'revisionDate' | 'creationDate' | 'deletedDate' | 'attachments'>>;

export interface Folder {
    object: 'folder';
    id: string | null;
    name: string;
}

export interface Collection {
    object: 'collection' | 'org-collection';
    id: string;
    organizationId: string;
    name: string;
    externalId: string | null;
    readOnly?: boolean;
    groups?: unknown[];
}

export interface Organization {
    object: 'organization';
    id: string;
    name: string;
    status: number;
    type: number;
    enabled: boolean;
}

export interface OrgMember {
    object: 'org-member';
    id: string;
    userId: string;
    email: string;
    name: string | null;
    status: number;
    type: number;
}

export interface ListItemsFilter {
    search?: string;
    url?: string;
    folderId?: string;
    collectionId?: string;
    organizationId?: string;
    /** List items in the trash instead. */
    trash?: boolean;
}

export interface GenerateOptions {
    /** Generate a passphrase instead of a password. */
    passphrase?: boolean;
    /** Password length (default 14). */
    length?: number;
    /** Minimum count of each character class. */
    uppercase?: number;
    lowercase?: number;
    number?: number;
    special?: number;
    /** Passphrase word count (default 3). */
    words?: number;
    separator?: string;
    capitalize?: boolean;
    includeNumber?: boolean;
}

export type TemplateType =
    | 'item'
    | 'item.field'
    | 'item.login'
    | 'item.login.uri'
    | 'item.card'
    | 'item.identity'
    | 'item.securenote'
    | 'item.sshkey'
    | 'folder'
    | 'collection'
    | 'item-collections'
    | 'org-collection';
