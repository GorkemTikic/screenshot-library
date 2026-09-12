const PRICE_ASSETS = [
    ['bitcoin', 'BTC'],
    ['ethereum', 'ETH'],
    ['solana', 'SOL'],
];

export function buildTickerItems(priceData = {}, newsData = {}) {
    const prices = PRICE_ASSETS.flatMap(([key, name]) => {
        const value = priceData[key];
        return Number.isFinite(value?.usd)
            ? [{ type: 'price', name, price: value.usd, change: Number(value.usd_24h_change) || 0 }]
            : [];
    });

    const news = Array.isArray(newsData.Data)
        ? newsData.Data
            .filter((item) => item?.url?.startsWith('https://') && String(item.title || '').length > 20)
            .slice(0, 5)
            .map((item) => ({
                type: 'news',
                text: item.title,
                url: item.url,
                source: item.source_info?.name || 'Market update',
            }))
        : [];

    const mixed = [];
    const length = Math.max(prices.length, news.length);
    for (let index = 0; index < length; index += 1) {
        if (prices[index]) mixed.push(prices[index]);
        if (news[index]) mixed.push(news[index]);
    }
    return mixed;
}

export function formatTickerPrice(value) {
    if (!Number.isFinite(value)) return '—';
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
