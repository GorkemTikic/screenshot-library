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
