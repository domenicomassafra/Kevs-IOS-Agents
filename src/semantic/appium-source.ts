import { XMLParser } from 'fast-xml-parser';

interface NormalizedNode {
    type: string;
    name?: string;
    label?: string;
    value?: string;
    rect?: { x: number; y: number; width: number; height: number };
    visible?: boolean;
    enabled?: boolean;
    children: NormalizedNode[];
}

const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text',
    trimValues: true,
    parseAttributeValue: false,
});

function stringValue(value: unknown): string | undefined {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return;
    const text = String(value).trim();
    return text || undefined;
}

function booleanValue(value: unknown, fallback = true): boolean {
    if (value === undefined || value === null) return fallback;
    return value === true || value === 1 || value === '1' || value === 'true';
}

function numberValue(value: unknown): number | undefined {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
}

function rectangle(record: Record<string, unknown>): NormalizedNode['rect'] {
    const x = numberValue(record['@_x']);
    const y = numberValue(record['@_y']);
    const width = numberValue(record['@_width']);
    const height = numberValue(record['@_height']);
    if ([x, y, width, height].every((value) => value !== undefined)) return { x: x!, y: y!, width: width!, height: height! };
    return;
}

function childEntries(record: Record<string, unknown>): Array<[string, Record<string, unknown>]> {
    const result: Array<[string, Record<string, unknown>]> = [];
    for (const [tag, value] of Object.entries(record)) {
        if (tag.startsWith('@_') || tag === '#text' || tag.startsWith('?')) continue;
        const values = Array.isArray(value) ? value : [value];
        for (const child of values) {
            if (child && typeof child === 'object' && !Array.isArray(child)) result.push([tag, child as Record<string, unknown>]);
        }
    }
    return result;
}

function normalize(tag: string, record: Record<string, unknown>): NormalizedNode {
    const label = stringValue(record['@_label'])
        ?? stringValue(record['@_name'])
        ?? stringValue(record['#text']);
    const value = stringValue(record['@_value']);
    return {
        type: stringValue(record['@_type']) ?? tag,
        ...(label ? { label, name: label } : {}),
        ...(value && value !== label ? { value } : {}),
        ...(rectangle(record) ? { rect: rectangle(record) } : {}),
        visible: booleanValue(record['@_visible'], true),
        enabled: booleanValue(record['@_enabled'], true),
        children: childEntries(record).map(([childTag, child]) => normalize(childTag, child)),
    };
}

export function normalizeAppiumPageSource(xml: string): NormalizedNode {
    if (!xml.trim()) throw new Error('Appium returned an empty page source');
    const parsed = parser.parse(xml) as Record<string, unknown>;
    const root = childEntries(parsed)[0];
    if (!root) throw new Error('Appium returned an invalid page source');
    const normalized = normalize(root[0], root[1]);
    return normalized;
}
