import assert from 'node:assert/strict';
import test from 'node:test';

import { renderLaunchAgent, serviceSpecs } from '../src/service.js';

test('launchd supervision uses one process per farm responsibility and no shell wrapper', () => {
    const specs = serviceSpecs('/tmp/phone-farm', '/usr/local/bin/node');
    assert.equal(Object.keys(specs).length, 4);
    assert.match(specs.appium.args.join(' '), /node_modules\/appium\/index\.js/);
    assert.match(specs.wda.args.join(' '), /wda-service\.ts/);
    assert.match(specs.worker.args.join(' '), /scheduler\/worker\.ts/);
    assert.match(specs.web.args.join(' '), /api\/server\.ts/);

    const plist = renderLaunchAgent('web', '/tmp/phone&farm', '/usr/local/bin/node', '/Users/test');
    assert.match(plist, /com\.phone-farm\.web/);
    assert.match(plist, /\/tmp\/phone&amp;farm/);
    assert.doesNotMatch(plist, /\/bin\/sh/);
});
