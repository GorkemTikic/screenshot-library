export const TOPIC_META = {
    'Futures Trading': { icon: 'CandlestickChart', tone: 'amber' },
    'Margin Trading': { icon: 'Scale', tone: 'blue' },
    General: { icon: 'LayoutGrid', tone: 'slate' },
    LOAN: { icon: 'HandCoins', tone: 'green' },
    'Copy Trading': { icon: 'CopyCheck', tone: 'violet' },
    'Event Contract': { icon: 'TicketCheck', tone: 'rose' },
    BOTS: { icon: 'Bot', tone: 'cyan' },
};

export const normalizePlatform = (value) => value === 'web' ? 'web' : 'mobile';

export const visibleCatalog = (items = []) => items.filter((item) => !item.archivedAt);

export const ownerInitials = (name = '') => name
    .replace(/^CS\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || '—';

export const buildPatch = (base, draft, fields) => Object.fromEntries(
    fields
        .filter((field) => JSON.stringify(base?.[field]) !== JSON.stringify(draft?.[field]))
        .map((field) => [field, draft[field]])
);

export const recordVersion = (item) => item?.version || item?.updatedAt || String(item?.id || '');

export function topicCounts(items = [], platform = 'mobile') {
    return visibleCatalog(items).reduce((counts, item) => {
        if (normalizePlatform(item.platform) !== platform || !item.topic) return counts;
        counts[item.topic] = (counts[item.topic] || 0) + 1;
        return counts;
    }, {});
}

export function latestCatalogUpdate(items = []) {
    const timestamps = visibleCatalog(items).map((item) => {
        const updated = Date.parse(item.updatedAt || '');
        return Number.isNaN(updated) ? Number(item.id) || 0 : updated;
    });
    return new Date(timestamps.length ? Math.max(...timestamps) : 0);
}

const OWNER_HUES = new Map([
    ['cs gorkem t', 18],
    ['cs enzo', 215],
    ['cs vera', 275],
]);

export function ownerHue(name = '') {
    const normalized = String(name).trim().toLowerCase();
    if (OWNER_HUES.has(normalized)) return OWNER_HUES.get(normalized);
    let hash = 0;
    for (const character of normalized) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return ((hash % 360) + 360) % 360;
}

export const ownerColorStyle = (name = '') => {
    const hue = `${ownerHue(name)}deg`;
    return { '--avatar-hue': hue, '--owner-hue': hue };
};

export function aggregateOwners(items = [], interactionRows = []) {
    const interactionMap = new Map(interactionRows.map((row) => [String(row.owner || row.name || '').trim().toLowerCase(), row]));
    const grouped = new Map();
    for (const item of visibleCatalog(items)) {
        const owner = String(item.owner || '').trim();
        if (!owner) continue;
        const current = grouped.get(owner) || { owner, guides: 0, languages: new Set(), topics: new Set(), latest: '' };
        current.guides += 1;
        if (item.language) current.languages.add(item.language);
        if (item.topic) current.topics.add(item.topic);
        if (String(item.updatedAt || '') > current.latest) current.latest = String(item.updatedAt || '');
        grouped.set(owner, current);
    }
    return [...grouped.values()].map((entry) => {
        const interactions = interactionMap.get(entry.owner.toLowerCase()) || {};
        return {
            owner: entry.owner,
            guides: entry.guides,
            interactions: Number(interactions.total ?? interactions.interactions) || 0,
            copies: Number(interactions.copies ?? interactions.copy_count) || 0,
            views: Number(interactions.views ?? interactions.view_count) || 0,
            languages: [...entry.languages].sort(),
            topics: [...entry.topics].sort(),
            latest: entry.latest,
        };
    }).sort((a, b) => b.guides - a.guides || a.owner.localeCompare(b.owner));
}

export function filterCatalog(items = [], filters = {}) {
    const {
        matchedIds = null,
        platform = 'mobile',
        topic = 'All',
        language = 'All',
        favoritesOnly = false,
        favoriteTitles = [],
    } = filters;
    const favorites = new Set(favoriteTitles);

    return visibleCatalog(items)
        .filter((item) => normalizePlatform(item.platform) === platform)
        .filter((item) => !matchedIds || matchedIds.has(item.id))
        .filter((item) => topic === 'All' || item.topic === topic)
        .filter((item) => language === 'All' || item.language === language)
        .filter((item) => !favoritesOnly || favorites.has(item.title))
        .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0));
}
