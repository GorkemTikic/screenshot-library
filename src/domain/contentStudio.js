import { normalizePlatform, visibleCatalog } from './catalog.js';

const SEARCHABLE_FIELDS = ['title', 'text', 'text_tr', 'owner', 'topic', 'language', 'platform'];

export function filterStudioItems(items = [], { query = '', platform = 'all', archiveMode = false } = {}) {
    const normalizedQuery = query.trim().toLowerCase();
    const source = archiveMode ? items.filter((item) => item.archivedAt) : visibleCatalog(items);
    return source.filter((item) => {
        const searchableValues = [
            ...SEARCHABLE_FIELDS.map((field) => item[field]),
            normalizePlatform(item.platform),
        ];
        const matchesQuery = !normalizedQuery || searchableValues.some((value) => String(value || '').toLowerCase().includes(normalizedQuery));
        return matchesQuery && (platform === 'all' || normalizePlatform(item.platform) === platform);
    });
}

export function studioCountLabel(count, archiveMode = false) {
    const noun = count === 1 ? 'guide' : 'guides';
    return `${count} ${archiveMode ? 'archived' : 'published'} ${noun}`;
}
