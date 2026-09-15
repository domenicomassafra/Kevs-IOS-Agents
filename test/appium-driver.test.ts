import assert from 'node:assert/strict';
import test from 'node:test';

import { remoteWithFetch } from '../src/devices/appium-driver.js';

interface SeenRequest {
    method: string;
    pathname: string;
    body?: unknown;
}

test('internal Appium driver covers recipe selectors and element primitives', async () => {
    const requests: SeenRequest[] = [];
    const fetchImpl: typeof fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        const method = String(init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
        requests.push({ method, pathname: url.pathname, ...(body === undefined ? {} : { body }) });

        if (method === 'POST' && url.pathname === '/session') return Response.json({ value: { sessionId: 'recipe-session' } });
        if (method === 'POST' && url.pathname.endsWith('/element')) return Response.json({ value: { 'element-6066-11e4-a52e-4f735466cecf': 'element-1' } });
        if (method === 'POST' && url.pathname.endsWith('/elements')) return Response.json({ value: [
            { 'element-6066-11e4-a52e-4f735466cecf': 'element-1' },
            { ELEMENT: 'element-2' },
        ] });
        if (method === 'GET' && url.pathname.endsWith('/displayed')) return Response.json({ value: true });
        if (method === 'GET' && url.pathname.endsWith('/attribute/label')) return Response.json({ value: 'Done' });
        if (method === 'GET' && url.pathname.endsWith('/text')) return Response.json({ value: 'Done' });
        if (method === 'GET' && url.pathname.endsWith('/rect')) return Response.json({ value: { x: 10, y: 20, width: 80, height: 44 } });
        if (method === 'POST' && url.pathname.endsWith('/appium/device/app_state')) return Response.json({ value: 4 });
        return Response.json({ value: null });
    };

    const driver = await remoteWithFetch({
        hostname: 'appium.test', port: 4725, path: '/', connectionRetryTimeout: 5_000,
        capabilities: { platformName: 'iOS', 'appium:automationName': 'XCUITest', 'appium:udid': 'PHONE-1' },
    }, fetchImpl);

    const byAccessibility = await driver.$('~Done');
    assert.equal(await byAccessibility.isExisting(), true);
    assert.equal(await byAccessibility.isDisplayed(), true);
    assert.equal(await byAccessibility.getAttribute('label'), 'Done');
    assert.equal(await byAccessibility.getText(), 'Done');
    assert.deepEqual(await byAccessibility.getLocation(), { x: 10, y: 20 });
    assert.deepEqual(await byAccessibility.getSize(), { width: 80, height: 44 });
    await byAccessibility.click();
    await byAccessibility.clearValue();
    await byAccessibility.setValue('caption');

    const classChain = await driver.$$('-ios class chain:**/XCUIElementTypeCollectionView/XCUIElementTypeCell');
    assert.equal(classChain.length, 2);
    const nested = await classChain[0]!.$$('-ios class chain:**/XCUIElementTypeStaticText');
    assert.equal(nested.length, 2);
    await driver.$('-ios predicate string:type == "XCUIElementTypeTextView"');
    await driver.$('//XCUIElementTypeButton[@name="Post"]');

    await driver.updateSettings({ defaultActiveApplication: 'com.example.app' });
    await driver.setTimeout({ implicit: 2500 });
    await driver.hideKeyboard();
    await driver.keys('abc');
    await driver.execute('mobile: paste');
    assert.equal(await driver.queryAppState('com.example.app'), 4);

    const locatorBodies = requests
        .filter(({ pathname }) => /\/elements?$/.test(pathname))
        .map(({ body }) => body as { using?: string; value?: string });
    assert.equal(locatorBodies.some(({ using, value }) => using === 'accessibility id' && value === 'Done'), true);
    assert.equal(locatorBodies.some(({ using }) => using === '-ios class chain'), true);
    assert.equal(locatorBodies.some(({ using }) => using === '-ios predicate string'), true);
    assert.equal(locatorBodies.some(({ using }) => using === 'xpath'), true);

    const setValue = requests.find(({ pathname }) => pathname.endsWith('/element/element-1/value'))?.body as { value?: string[]; text?: string };
    assert.deepEqual(setValue.value, ['c', 'a', 'p', 't', 'i', 'o', 'n']);
    assert.equal(setValue.text, 'caption');
    const settings = requests.find(({ pathname }) => pathname.endsWith('/appium/settings'))?.body;
    assert.deepEqual(settings, { settings: { defaultActiveApplication: 'com.example.app' } });
    const paste = requests.find(({ pathname, body }) => pathname.endsWith('/execute/sync') && (body as { script?: string })?.script === 'mobile: paste')?.body as { args?: unknown[] };
    assert.deepEqual(paste.args, []);
});

test('internal Appium driver returns a non-existing element for ordinary no-such-element responses', async () => {
    const fetchImpl: typeof fetch = async (input) => {
        const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
        if (url.pathname === '/session') return Response.json({ value: { sessionId: 'missing-session' } });
        if (url.pathname.endsWith('/element')) {
            return Response.json({ value: { error: 'no such element', message: 'not found' } }, { status: 404 });
        }
        return Response.json({ value: null });
    };
    const driver = await remoteWithFetch({
        hostname: 'appium.test', port: 4725, capabilities: { platformName: 'iOS' },
    }, fetchImpl);
    const element = await driver.$('~Missing');
    assert.equal(await element.isExisting(), false);
    assert.equal(await element.isDisplayed(), false);
});

test('internal Appium driver does not retry non-transient session errors', async () => {
    let attempts = 0;
    const fetchImpl: typeof fetch = async () => {
        attempts += 1;
        return Response.json({ value: { error: 'invalid argument', message: 'bad capability' } }, { status: 400 });
    };
    await assert.rejects(() => remoteWithFetch({
        hostname: 'appium.test', port: 4725, connectionRetryCount: 3, capabilities: { platformName: 'iOS' },
    }, fetchImpl), /bad capability/);
    assert.equal(attempts, 1);
});
