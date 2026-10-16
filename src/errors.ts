/** `bw serve` answered, but with `success: false` or a non-2xx status (e.g. "Vault is locked."). */
export class BwApiError extends Error {
    override readonly name = 'BwApiError';

    constructor(
        message: string,
        readonly status: number,
        readonly method: string,
        readonly path: string
    ) {
        super(message);
    }

    /** True for the "Vault is locked." / "You are not logged in." replies. */
    get isLocked(): boolean {
        return /vault is locked|not logged in/i.test(this.message);
    }
}

/** No answer from `bw serve`: not running, wrong port, or no reply within `timeoutMs` (see `timedOut`). */
export class BwConnectionError extends Error {
    override readonly name = 'BwConnectionError';

    /** True when the request hit `timeoutMs` (bw serve is reachable but slow or stuck), not a refused connection. */
    readonly timedOut: boolean;

    constructor(baseUrl: string, cause: unknown, timeoutMs?: number) {
        const timedOut = cause instanceof Error && cause.name === 'TimeoutError';
        super(
            timedOut
                ? `bw serve at ${baseUrl} did not answer within ${timeoutMs}ms.`
                : `Could not reach bw serve at ${baseUrl}. Is it running? (bw serve --port 8087)`,
            { cause }
        );
        this.timedOut = timedOut;
    }
}
