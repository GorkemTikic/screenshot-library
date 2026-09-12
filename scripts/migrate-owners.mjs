import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

export const OWNER_BY_LANGUAGE = {
    English: 'CS Gorkem T',
    Arabic: 'CS Gorkem T',
    Russian: 'CS Gorkem T',
    Vietnamese: 'CS Gorkem T',
    Chinese: 'CS Enzo',
};

function ownershipDate(item, now) {
    const numericId = Number(item.id);
    if (Number.isFinite(numericId)) {
        const fromId = new Date(numericId);
        if (!Number.isNaN(fromId.getTime())) return { date: fromId, fallback: false };
    }

    if (item.updatedAt) {
        const fromUpdated = new Date(item.updatedAt);
        if (!Number.isNaN(fromUpdated.getTime())) return { date: fromUpdated, fallback: false };
    }

    return { date: now, fallback: true };
}

export function migrateRecord(item, now = new Date()) {
    if (String(item.owner || '').trim()) return item;
    const owner = OWNER_BY_LANGUAGE[item.language];
    if (!owner) return item;
    const { date } = ownershipDate(item, now);
    return { ...item, owner, ownerSince: date.toISOString() };
}

export function migrateRecords(items, now = new Date()) {
    const assignments = {};
    let preserved = 0;
    let fallbackDates = 0;

    const migrated = items.map((item) => {
        if (String(item.owner || '').trim() || !OWNER_BY_LANGUAGE[item.language]) {
            preserved += 1;
            return item;
        }
        const { fallback } = ownershipDate(item, now);
        const next = migrateRecord(item, now);
        assignments[next.owner] = (assignments[next.owner] || 0) + 1;
        if (fallback) fallbackDates += 1;
        return next;
    });

    return { items: migrated, assignments, preserved, fallbackDates };
}

async function main() {
    const scriptDir = path.dirname(fileURLToPath(import.meta.url));
    const dataPath = path.resolve(scriptDir, '../src/data/data.json');
    const source = JSON.parse(await readFile(dataPath, 'utf8'));
    const result = migrateRecords(source);
    await writeFile(dataPath, `${JSON.stringify(result.items, null, 2)}\n`, 'utf8');
    process.stdout.write(`${JSON.stringify({ total: result.items.length, assignments: result.assignments, preserved: result.preserved, fallbackDates: result.fallbackDates })}\n`);
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
    await main();
}
