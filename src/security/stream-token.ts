import crypto from 'node:crypto';

export interface StreamCapability {
    expiresAt: number;
    signature: string;
}

export class StreamTokenService {
    readonly secret: Buffer;
    readonly ttlMs: number;

    constructor(secret: string | Buffer = crypto.randomBytes(32), ttlMs = 60_000) {
        this.secret = Buffer.isBuffer(secret) ? secret : Buffer.from(secret, 'utf8');
        if (this.secret.length < 16) throw new Error('Stream token secret must be at least 16 bytes');
        this.ttlMs = Math.max(5_000, Math.min(ttlMs, 5 * 60_000));
    }

    issue(udid: string, now = Date.now()): StreamCapability {
        const expiresAt = now + this.ttlMs;
        return { expiresAt, signature: this.sign(udid, expiresAt) };
    }

    verify(udid: string, expiresAt: number, signature: string, now = Date.now()): boolean {
        if (!Number.isSafeInteger(expiresAt) || expiresAt < now || expiresAt > now + this.ttlMs + 5_000) return false;
        if (!/^[A-Za-z0-9_-]{20,100}$/.test(signature)) return false;
        const expected = this.sign(udid, expiresAt);
        const a = Buffer.from(signature);
        const b = Buffer.from(expected);
        return a.length === b.length && crypto.timingSafeEqual(a, b);
    }

    private sign(udid: string, expiresAt: number): string {
        return crypto.createHmac('sha256', this.secret).update(`${udid}\n${expiresAt}`).digest('base64url');
    }
}
