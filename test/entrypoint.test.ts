import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import { isEntrypoint } from '../src/entrypoint.js';

test('entrypoint detection accepts the relative argv shape used by launchd jobs', () => {
    const relative = 'src/device-worker-server.ts';
    assert.equal(isEntrypoint(pathToFileURL(path.resolve(relative)).href, relative), true);
    assert.equal(isEntrypoint(pathToFileURL(path.resolve('src/api/server.ts')).href, relative), false);
});
