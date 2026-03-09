'use client';

import React, { useState, useEffect } from 'react';

interface TickerItem {
    label: string;
    symbol: string;
    price: number | null;
    change: number | null; // pct
    currency: string;
}

const INSTRUMENTS = [
    { label: 'Gram Altın', symbol: 'GC=F', currency: 'TRY', isTRY: true },
    { label: 'Dolar', symbol: 'USDTRY=X', currency: 'TRY', isTRY: true },
    { label: 'Euro', symbol: 'EURTRY=X', currency: 'TRY', isTRY: true },
    { label: 'Bitcoin', symbol: 'BTC-USD', currency: 'USD', isTRY: false },
    { label: 'BİST100', symbol: 'XU100.IS', currency: 'TRY', isTRY: true },
];

// Market hours (UTC)
function getMarketStatus(): { label: string; open: boolean; color: string } {
    const now = new Date();
    const utcH = now.getUTCHours();
    const utcM = now.getUTCMinutes();
    const utcDay = now.getUTCDay(); // 0=Sun, 6=Sat
    const utcTime = utcH * 60 + utcM;

    if (utcDay === 0 || utcDay === 6) {
        return { label: 'Hafta Sonu', open: false, color: '#64748b' };
    }

    // BIST: 07:00-18:00 UTC (10:00-21:00 TR)
    const bistOpen = 7 * 60;
    const bistClose = 18 * 60;
    if (utcTime >= bistOpen && utcTime < bistClose) {
        return { label: 'BİST Açık', open: true, color: '#10b981' };
    }

    // NYSE: 14:30-21:00 UTC
    const nyseOpen = 14 * 60 + 30;
    const nyseClose = 21 * 60;
    if (utcTime >= nyseOpen && utcTime < nyseClose) {
        return { label: 'NYSE Açık', open: true, color: '#10b981' };
    }

    // Crypto 24/7
    return { label: 'Kripto Açık', open: true, color: '#6366f1' };
}

export default function SidebarMarketTicker({ collapsed }: { collapsed: boolean }) {
    const [items, setItems] = useState<TickerItem[]>(
        INSTRUMENTS.map(i => ({ label: i.label, symbol: i.symbol, price: null, change: null, currency: i.currency }))
    );
    const [marketStatus, setMarketStatus] = useState(getMarketStatus());
    const [tryClock, setTryClock] = useState('');

    // Update clock every minute
    useEffect(() => {
        const update = () => {
            setMarketStatus(getMarketStatus());
            const now = new Date();
            setTryClock(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }));
        };
        update();
        const t = setInterval(update, 60_000);
        return () => clearInterval(t);
    }, []);

    // Fetch prices every 5 minutes
    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const results = await Promise.allSettled(
                    INSTRUMENTS.map(async (inst) => {
                        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(inst.symbol)}?interval=1d&range=5d`;
                        const res = await fetch(`/api/sidebar-prices?symbol=${encodeURIComponent(inst.symbol)}`, { cache: 'no-store' });
                        if (!res.ok) return { label: inst.label, price: null, change: null };
                        const d = await res.json();
                        return { label: inst.label, ...d };
                    })
                );

                setItems(prev => prev.map((item, i) => {
                    const r = results[i];
                    if (r.status === 'fulfilled' && r.value && r.value.price != null) {
                        return { ...item, price: r.value.price, change: r.value.change ?? null };
                    }
                    return item;
                }));
            } catch {
                // silently fail
            }
        };

        fetchPrices();
        const t = setInterval(fetchPrices, 5 * 60 * 1000);
        return () => clearInterval(t);
    }, []);

    const fmtPrice = (price: number | null, currency: string) => {
        if (price == null) return '—';
        if (currency === 'TRY') {
            return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
        }
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(price);
    };

    if (collapsed) {
        // Only show market status dot when collapsed
        return (
            <div style={{ padding: '8px 0', display: 'flex', justifyContent: 'center' }}>
                <div title={marketStatus.label} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: marketStatus.color,
                    boxShadow: marketStatus.open ? `0 0 6px ${marketStatus.color}` : 'none',
                    animation: marketStatus.open ? 'sidebarPulse 2s ease-in-out infinite' : 'none',
                }} />
            </div>
        );
    }

    return (
        <div style={{
            borderTop: '1px solid rgba(255,255,255,0.04)',
            padding: '12px 12px 8px',
        }}>
            {/* Market Status Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: marketStatus.color,
                        boxShadow: marketStatus.open ? `0 0 6px ${marketStatus.color}` : 'none',
                        animation: marketStatus.open ? 'sidebarPulse 2s ease-in-out infinite' : 'none',
                    }} />
                    <span style={{ fontSize: 9, fontWeight: 700, color: marketStatus.color, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {marketStatus.label}
                    </span>
                </div>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
                    {tryClock}
                </span>
            </div>

            {/* Price List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.map((item) => {
                    const isUp = (item.change ?? 0) >= 0;
                    const changeColor = item.change == null ? 'rgba(255,255,255,0.25)' : isUp ? '#10b981' : '#ef4444';

                    return (
                        <div key={item.label} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '5px 8px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.03)',
                            transition: 'background 0.15s',
                        }}
                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                        >
                            <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.5)' }}>
                                {item.label}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, textAlign: 'right' }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', fontFamily: 'monospace' }}>
                                    {item.price == null ? (
                                        <span style={{ opacity: 0.3 }}>—</span>
                                    ) : fmtPrice(item.price, item.currency)}
                                </span>
                                {item.change != null && (
                                    <span style={{
                                        fontSize: 9, fontWeight: 700, color: changeColor,
                                        background: `${changeColor}15`,
                                        padding: '1px 4px', borderRadius: 4,
                                    }}>
                                        {isUp ? '+' : ''}{item.change.toFixed(1)}%
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                @keyframes sidebarPulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.6; transform: scale(1.3); }
                }
            `}</style>
        </div>
    );
}
