import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const ownerKey = (name = '') => String(name).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function initialOwnerHistory(item) {
    const owner = String(item.owner || '').trim();
    if (!owner) return [];
    const from = /^CS (Gorkem T|Enzo)$/i.test(owner) ? null : item.ownerSince || null;
    return [{ ownerKey: ownerKey(owner), owner, from, to: null, reason: 'initial-attribution', changedBy: 'migration' }];
}

export function migrateOwnerHistoryRecord(item) {
    if (!String(item.owner || '').trim()) return item;
    const key = item.ownerKey || ownerKey(item.owner);
    const history = Array.isArray(item.ownerHistory) && item.ownerHistory.length ? item.ownerHistory : initialOwnerHistory(item);
    if (item.ownerKey === key && item.ownerHistory === history) return item;
    return { ...item, ownerKey: key, ownerHistory: history };
}

export function migrateOwnerHistory(items) {
    let migrated = 0;
    let preserved = 0;
    const next = items.map((item) => {
        const result = migrateOwnerHistoryRecord(item);
        if (result === item) preserved += 1;
        else migrated += 1;
        return result;
    });
    const openIntervals = next.reduce((sum, item) => sum + (item.ownerHistory || []).filter((interval) => interval.to == null).length, 0);
    return { items: next, summary: { total: next.length, migrated, preserved, openIntervals } };
}

async function main() {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const dataPath = path.resolve(scriptDir, '../src/data/data.json');
    const source = JSON.parse(await readFile(dataPath, 'utf8'));
    const result = migrateOwnerHistory(source);
    await writeFile(dataPath, `${JSON.stringify(result.items, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify(result.summary)}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();
