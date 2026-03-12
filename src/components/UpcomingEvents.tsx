'use client';

import React, { useState, useEffect } from 'react';

interface FinancialEvent {
    id: string;
    title: string;
    subtitle: string;
    date: string; // YYYY-MM-DD
    category: 'central_bank' | 'earnings' | 'macro' | 'bist';
    icon: string;
    importance: 'high' | 'medium';
    country?: string;
}

const EVENTS: FinancialEvent[] = [
    // TCMB
    { id: 'tcmb-mar', title: 'TCMB Faiz Kararı', subtitle: 'Türkiye Merkez Bankası', date: '2026-03-19', category: 'central_bank', icon: '🏦', importance: 'high', country: '🇹🇷' },
    { id: 'tcmb-apr', title: 'TCMB Faiz Kararı', subtitle: 'Türkiye Merkez Bankası', date: '2026-04-17', category: 'central_bank', icon: '🏦', importance: 'high', country: '🇹🇷' },
    // FED
    { id: 'fed-mar', title: 'FED Faiz Kararı (FOMC)', subtitle: 'ABD Federal Rezervi', date: '2026-03-19', category: 'central_bank', icon: '🏦', importance: 'high', country: '🇺🇸' },
    { id: 'fed-may', title: 'FED Faiz Kararı (FOMC)', subtitle: 'ABD Federal Rezervi', date: '2026-05-07', category: 'central_bank', icon: '🏦', importance: 'high', country: '🇺🇸' },
    // Earnings
    { id: 'aapl-q1', title: 'Apple Kar Açıklaması Q1', subtitle: 'AAPL — EPS & Gelir Tahmini', date: '2026-04-30', category: 'earnings', icon: '🍎', importance: 'high', country: '🇺🇸' },
    { id: 'nvda-q1', title: 'NVIDIA Kar Açıklaması Q1', subtitle: 'NVDA — AI harcama görünümü', date: '2026-05-21', category: 'earnings', icon: '🟢', importance: 'high', country: '🇺🇸' },
    { id: 'msft-q3', title: 'Microsoft Kar Açıklaması Q3', subtitle: 'MSFT — Azure büyüme verileri', date: '2026-04-29', category: 'earnings', icon: '🪟', importance: 'medium', country: '🇺🇸' },
    { id: 'googl-q1', title: 'Alphabet Kar Açıklaması Q1', subtitle: 'GOOG — Reklam geliri', date: '2026-04-28', category: 'earnings', icon: '🔍', importance: 'medium', country: '🇺🇸' },
    // Macro
    { id: 'us-cpi-mar', title: 'ABD Enflasyon (CPI)', subtitle: 'Mart 2026 tüketici fiyat endeksi', date: '2026-04-10', category: 'macro', icon: '📊', importance: 'high', country: '🇺🇸' },
    { id: 'us-nfp-apr', title: 'ABD İstihdam Raporu', subtitle: 'Tarım Dışı İstihdam (NFP)', date: '2026-04-03', category: 'macro', icon: '💼', importance: 'high', country: '🇺🇸' },
    { id: 'tuik-enf', title: 'TÜİK Enflasyon Verisi', subtitle: 'Türkiye TÜFE - Nisan', date: '2026-04-03', category: 'macro', icon: '📈', importance: 'high', country: '🇹🇷' },
    // BIST
    { id: 'bist-div', title: 'Temettü Sezonu Başlangıcı', subtitle: 'BIST100 Şirketleri Genel Kurul', date: '2026-04-15', category: 'bist', icon: '💰', importance: 'medium', country: '🇹🇷' },
];

const CATEGORY_LABELS: Record<string, string> = {
    central_bank: 'Merkez Bankası',
    earnings: 'Kar Açıklaması',
    macro: 'Makro',
    bist: 'Borsa',
};

const CATEGORY_COLORS: Record<string, string> = {
    central_bank: '#a78bfa',
    earnings: '#22d3ee',
    macro: '#f59e0b',
    bist: '#10b981',
};

function getDaysUntil(dateStr: string): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const target = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
}

function DaysBadge({ days }: { days: number }) {
    const color = days <= 3 ? '#ef4444' : days <= 7 ? '#f59e0b' : days <= 14 ? '#22d3ee' : 'rgba(255,255,255,0.3)';
    const label = days === 0 ? 'BUGÜN' : days === 1 ? 'YARIN' : `${days} GÜN`;
    return (
        <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
            color, background: `${color}18`,
            border: `1px solid ${color}44`,
            borderRadius: 6, padding: '3px 8px', whiteSpace: 'nowrap',
            ...(days <= 3 ? { animation: 'pulse 2s infinite' } : {}),
        }}>
            {label}
        </div>
    );
}

export default function UpcomingEvents() {
    const [filter, setFilter] = useState<'all' | 'central_bank' | 'earnings' | 'macro' | 'bist'>('all');
    const [, forceRender] = useState(0);

    // Refresh countdown every minute
    useEffect(() => {
        const t = setInterval(() => forceRender(n => n + 1), 60000);
        return () => clearInterval(t);
    }, []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = EVENTS
        .map(e => ({ ...e, days: getDaysUntil(e.date) }))
        .filter(e => e.days >= 0)
        .filter(e => filter === 'all' || e.category === filter)
        .sort((a, b) => a.days - b.days)
        .slice(0, 8);

    const categories = ['all', 'central_bank', 'earnings', 'macro', 'bist'] as const;

    return (
        <div style={{
            background: 'var(--bg-elevated)', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.06)',
            overflow: 'hidden',
        }}>
            {/* Header */}
            <div style={{
                padding: '16px 20px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 16 }}>📅</span> Yaklaşanlar
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            Önemli finans & ekonomi takviminiz
                        </div>
                    </div>
                </div>

                {/* Filter chips */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            style={{
                                fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
                                border: `1px solid ${filter === cat ? (cat === 'all' ? 'rgba(255,255,255,0.3)' : CATEGORY_COLORS[cat]) : 'rgba(255,255,255,0.08)'}`,
                                background: filter === cat ? (cat === 'all' ? 'rgba(255,255,255,0.1)' : `${CATEGORY_COLORS[cat]}20`) : 'transparent',
                                color: filter === cat ? (cat === 'all' ? 'var(--text-primary)' : CATEGORY_COLORS[cat]) : 'rgba(255,255,255,0.4)',
                                cursor: 'pointer', transition: 'all 0.15s', letterSpacing: 0.3,
                            }}
                        >
                            {cat === 'all' ? 'Tümü' : CATEGORY_LABELS[cat]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Event List */}
            <div style={{ padding: '8px 0' }}>
                {upcoming.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 20px', color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                        Bu kategoride yaklaşan etkinlik yok
                    </div>
                ) : upcoming.map((event, i) => {
                    const catColor = CATEGORY_COLORS[event.category];
                    const isLast = i === upcoming.length - 1;
                    return (
                        <div
                            key={event.id}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '10px 20px',
                                borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.03)',
                                transition: 'background 0.15s',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            {/* Icon */}
                            <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: `${catColor}18`, border: `1px solid ${catColor}33`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 16,
                            }}>
                                {event.icon}
                            </div>

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    display: 'flex', alignItems: 'center', gap: 6,
                                }}>
                                    {event.country} {event.title}
                                    {event.importance === 'high' && (
                                        <span style={{ fontSize: 9, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 5px', fontWeight: 800, letterSpacing: 0.3 }}>ÖNEMLİ</span>
                                    )}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                                    {event.subtitle} · {new Date(event.date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                </div>
                            </div>

                            {/* Countdown badge */}
                            <DaysBadge days={event.days} />
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `}</style>
        </div>
    );
}
