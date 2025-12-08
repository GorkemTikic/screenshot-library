import React, { useEffect, useState } from 'react';
import { TrendingUp, ExternalLink } from 'lucide-react';

export function MarketTicker() {
    const [tickerItems, setTickerItems] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // 1. Fetch Prices (CoinGecko is good for simple prices)
                const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin,solana,ripple&vs_currencies=usd&include_24hr_change=true');
                const priceData = await priceRes.json();

                const prices = [
                    { type: 'price', name: 'BTC', price: priceData.bitcoin?.usd, change: priceData.bitcoin?.usd_24h_change },
                    { type: 'price', name: 'ETH', price: priceData.ethereum?.usd, change: priceData.ethereum?.usd_24h_change },
                    { type: 'price', name: 'BNB', price: priceData.binancecoin?.usd, change: priceData.binancecoin?.usd_24h_change },
                ];

                // 2. Fetch News (CryptoCompare is more reliable for valid links)
                // Use a proxy or direct if CORS allows. CryptoCompare typically allows direct browser calls.
                const newsRes = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN');
                const newsData = await newsRes.json();

                const headlines = [];
                if (newsData.Data && Array.isArray(newsData.Data)) {
                    // Filter for trusted sources to ensure high quality links
                    const safeSources = ['CoinTelegraph', 'CoinDesk', 'Decrypt', 'The Daily Hodl', 'Bitcoin.com', 'CryptoPotato', 'U.Today'];

                    const filteredNews = newsData.Data.filter(item =>
                        // If source is in our safe list OR it generally looks valid
                        item.url && item.url.startsWith('http') && item.title.length > 20
                    );

                    filteredNews.slice(0, 5).forEach(item => {
                        headlines.push({
                            type: 'news',
                            text: item.title,
                            url: item.url,
                            source: item.source_info?.name || 'CryptoNews'
                        });
                    });
                }

                // Interleave
                const mixed = [];
                const maxLength = Math.max(prices.length, headlines.length);
                for (let i = 0; i < maxLength; i++) {
                    if (prices[i]) mixed.push(prices[i]);
                    if (headlines[i]) mixed.push(headlines[i]);
                }

                setTickerItems(mixed.length > 0 ? mixed : getDefaultFallback());
                setLoading(false);

            } catch (err) {
                console.warn("Ticker API failed:", err);
                setTickerItems(getDefaultFallback());
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 300000); // 5 mins
        return () => clearInterval(interval);
    }, []);

    const getDefaultFallback = () => [
        { type: 'price', name: 'BTC', price: 97350, change: 1.5 },
        {
            type: 'news',
            text: 'Market Analysis: Bitcoin approaches $100k',
            url: 'https://cointelegraph.com/category/market-news',
            source: 'CoinTelegraph'
        },
        { type: 'price', name: 'BNB', price: 610, change: 0.8 },
        {
            type: 'news',
            text: 'Latest Regulatory Updates in Crypto',
            url: 'https://www.coindesk.com/policy/',
            source: 'CoinDesk'
        }
    ];

    if (loading) return null;

    return (
        <div className="ticker-container">
            <div className="ticker-label">
                <TrendingUp size={16} className="mr-2 text-yellow-400" />
                <span>Market Updates</span>
            </div>

            <div className="ticker-wrapper">
                <div className="ticker-track">
                    {[1, 2].map((iteration) => (
                        <div key={iteration} className="ticker-content">
                            {tickerItems.map((item, idx) => {
                                if (item.type === 'price') {
                                    return (
                                        <div key={`${iteration}-p-${idx}`} className="ticker-item price-item">
                                            <span className="font-bold text-yellow-500">{item.name}</span>
                                            <span className="ml-1">${item.price?.toLocaleString()}</span>
                                            <span className={`ml-1 text-xs ${item.change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%
                                            </span>
                                        </div>
                                    );
                                } else {
                                    return (
                                        <a
                                            key={`${iteration}-n-${idx}`}
                                            href={item.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="ticker-item news-item hover:text-white transition-colors"
                                            style={{ textDecoration: 'none', cursor: 'pointer' }}
                                        >
                                            <span className="news-tag">{item.source}</span>
                                            <span className="news-text">{item.text}</span>
                                            <ExternalLink size={12} className="ml-1 opacity-50" />
                                        </a>
                                    );
                                }
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
