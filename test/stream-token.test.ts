import assert from 'node:assert/strict';
import test from 'node:test';

import { StreamTokenService } from '../src/security/stream-token.js';

test('stream capabilities are device-bound, expiring, and tamper-resistant', () => {
    const service = new StreamTokenService('0123456789abcdef0123456789abcdef', 30_000);
    const issued = service.issue('phone-a', 1_000_000);
    assert.equal(service.verify('phone-a', issued.expiresAt, issued.signature, 1_010_000), true);
    assert.equal(service.verify('phone-b', issued.expiresAt, issued.signature, 1_010_000), false);
    assert.equal(service.verify('phone-a', issued.expiresAt, `${issued.signature.slice(0, -1)}A`, 1_010_000), false);
    assert.equal(service.verify('phone-a', issued.expiresAt, issued.signature, issued.expiresAt + 1), false);
});
