import assert from 'node:assert/strict';
import test from 'node:test';

import { percentile } from '../src/video-benchmark.js';

test('video benchmark percentile is deterministic for small samples', () => {
    assert.equal(percentile([], 0.95), null);
    assert.equal(percentile([100], 0.95), 100);
    assert.equal(percentile([30, 10, 20, 40, 50], 0.5), 30);
    assert.equal(percentile([30, 10, 20, 40, 50], 0.95), 50);
});
