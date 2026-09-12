import React, { useEffect, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { buildTickerItems, formatTickerPrice } from '../domain/ticker';

export function MarketTicker() {
    const [tickerItems, setTickerItems] = useState([]);
    const [status, setStatus] = useState('loading');

    useEffect(() => {
        let alive = true;
        let controller = new AbortController();

        const fetchData = async () => {
            controller.abort();
            controller = new AbortController();
            try {
                const priceRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true', { signal: controller.signal });
                if (!priceRes.ok) throw new Error('Market source unavailable');
                const items = buildTickerItems(await priceRes.json());
                if (!items.length) throw new Error('No market items returned');
                if (alive) {
                    setTickerItems(items);
                    setStatus('ready');
                }
            } catch (error) {
                if (error.name !== 'AbortError' && alive) setStatus('error');
            }
        };

        fetchData();
        const interval = window.setInterval(fetchData, 300000);
        return () => {
            alive = false;
            controller.abort();
            window.clearInterval(interval);
        };
    }, []);

    return (
        <section className="market-band" aria-label="Market updates">
            <div className="shell market-band-inner">
                <div className="market-label">
                    <span className={`market-live-dot ${status}`} />
                    <span>Market desk</span>
                </div>
                {status === 'loading' && <div className="ticker-message">Connecting to market sources…</div>}
                {status === 'error' && <div className="ticker-message">Market data unavailable · Library remains fully available</div>}
                {status === 'ready' && (
                    <div className="ticker-viewport" tabIndex="0">
                        <div className="ticker-track">
                            {[0, 1].map((iteration) => (
                                <div className="ticker-set" key={iteration} aria-hidden={iteration === 1}>
                                    {tickerItems.map((item, index) => item.type === 'price' ? (
                                        <span className="ticker-item ticker-price" key={`${iteration}-${index}`}>
                                            <strong>{item.name}</strong>
                                            <span>{formatTickerPrice(item.price)}</span>
                                            <span className={item.change >= 0 ? 'positive' : 'negative'}>
                                                {item.change >= 0 ? '↗' : '↘'} {Math.abs(item.change).toFixed(1)}%
                                            </span>
                                        </span>
                                    ) : (
                                        <a className="ticker-item ticker-news" href={item.url} target="_blank" rel="noreferrer" key={`${iteration}-${index}`}>
                                            <small>{item.source}</small>
                                            <span>{item.text}</span>
                                            <ExternalLink size={12} />
                                        </a>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </section>
    );
}
