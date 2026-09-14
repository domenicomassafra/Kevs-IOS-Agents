import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeAppiumPageSource } from '../src/semantic/appium-source.js';
import { SemanticSnapshotStore } from '../src/semantic/snapshot.js';

test('normalizes XCUITest XML attributes into the semantic model', () => {
    const tree = normalizeAppiumPageSource(`<AppiumAUT type="XCUIElementTypeApplication" x="0" y="0" width="390" height="844">
      <XCUIElementTypeButton type="XCUIElementTypeButton" label="Done" enabled="true" visible="true" x="20" y="50" width="80" height="44" />
    </AppiumAUT>`);
    const snapshot = new SemanticSnapshotStore().build('sim-1', tree, { width: 390, height: 844 });
    assert.equal(snapshot.count, 1);
    assert.equal(snapshot.elements[0]?.label, 'Done');
});
