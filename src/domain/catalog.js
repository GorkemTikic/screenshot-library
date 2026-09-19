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

export const formatRemoteMetric = (value, ready) => {
    if (!ready) return '—';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
};

export function aggregateOwners(items = [], interactionRows = []) {
    const interactionMap = new Map(interactionRows.map((row) => [String(row.owner || row.name || '').trim().toLowerCase(), row]));
    const grouped = new Map();
    for (const item of items) {
        const isVisible = !item.archivedAt;
        const owner = String(item.owner || '').trim();
        if (owner) {
            const current = grouped.get(owner) || { owner, guides: 0, lifetimeIds: new Set(), languages: new Set(), topics: new Set(), latest: '' };
            if (isVisible) current.guides += 1;
            current.lifetimeIds.add(String(item.id));
            if (item.language) current.languages.add(item.language);
            if (item.topic) current.topics.add(item.topic);
            if (String(item.updatedAt || '') > current.latest) current.latest = String(item.updatedAt || '');
            grouped.set(owner, current);
        }
        for (const interval of Array.isArray(item.ownerHistory) ? item.ownerHistory : []) {
            const historicalOwner = String(interval.owner || '').trim();
            if (!historicalOwner) continue;
            const historical = grouped.get(historicalOwner) || { owner: historicalOwner, guides: 0, lifetimeIds: new Set(), languages: new Set(), topics: new Set(), latest: '' };
            historical.lifetimeIds.add(String(item.id));
            if (item.language) historical.languages.add(item.language);
            if (item.topic) historical.topics.add(item.topic);
            if (String(interval.from || '') > historical.latest) historical.latest = String(interval.from || '');
            grouped.set(historicalOwner, historical);
        }
    }
    return [...grouped.values()].map((entry) => {
        const interactions = interactionMap.get(entry.owner.toLowerCase()) || {};
        return {
            owner: entry.owner,
            guides: entry.guides,
            lifetime: Number(interactions.lifetime) || entry.lifetimeIds.size || entry.guides,
            interactions: Number(interactions.total ?? interactions.interactions) || 0,
            copies: Number(interactions.responseCopies ?? interactions.copies ?? interactions.copy_count) || 0,
            responseCopies: Number(interactions.responseCopies ?? interactions.copies ?? interactions.copy_count) || 0,
            imageCopies: Number(interactions.imageCopies) || 0,
            editedImageCopies: Number(interactions.editedImageCopies) || 0,
            views: Number(interactions.views ?? interactions.view_count) || 0,
            skippedCollisions: Number(interactions.skippedCollisions) || 0,
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
