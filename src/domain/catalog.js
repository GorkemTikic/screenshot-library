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

export function ownerHue(name = '') {
    let hash = 0;
    for (const character of name) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
    return ((hash % 360) + 360) % 360;
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
