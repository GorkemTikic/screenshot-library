export const TOPIC_META = {
    'Futures Trading': { icon: 'CandlestickChart', tone: 'amber' },
    'Margin Trading': { icon: 'Scale', tone: 'blue' },
    General: { icon: 'LayoutGrid', tone: 'slate' },
    LOAN: { icon: 'HandCoins', tone: 'green' },
    'Copy Trading': { icon: 'CopyCheck', tone: 'violet' },
    'Event Contract': { icon: 'TicketCheck', tone: 'rose' },
    BOTS: { icon: 'Bot', tone: 'cyan' },
};

const cleanTopic = (value) => typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/gu, ' ').trim() : '';
export const topicKey = (value) => cleanTopic(value).toLowerCase();

// Built-ins keep their established order and spelling. Archived topic names
// are included by editors so recreating content reuses the original category.
export function getTopics(items = []) {
    const names = new Map(Object.keys(TOPIC_META).map((name) => [topicKey(name), name]));
    const custom = [];
    for (const item of items) {
        const name = cleanTopic(item.topic);
        const key = topicKey(name);
        if (!name || names.has(key)) continue;
        names.set(key, name);
        custom.push(name);
    }
    return [...Object.keys(TOPIC_META), ...custom.sort((a, b) => a.localeCompare(b))];
}

export function resolveTopic(value, items = []) {
    const key = topicKey(value);
    return getTopics(items).find((name) => topicKey(name) === key) || cleanTopic(value);
}

export function validateTopic(value) {
    const name = cleanTopic(value);
    if (!name) return 'Enter a category name.';
    if (name.length > 80) return 'Category names must be 80 characters or fewer.';
    if (topicKey(name) === 'all') return 'Choose a name other than “All”, which is reserved for the library filter.';
    return '';
}

export function topicMeta(value) {
    const name = resolveTopic(value);
    return Object.hasOwn(TOPIC_META, name) ? TOPIC_META[name] : TOPIC_META.General;
}
