'use client';

import React, { useState, useEffect } from 'react';
import { Asset, CATEGORIES, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';

interface MoverResult {
    asset: Asset;
    pct: number;
    pricePast: number;
    priceNow: number;
}

interface PeriodData {
    gainers: MoverResult[];
    losers: MoverResult[];
    loading: boolean;
    fetched: boolean;
}

type Period = '1d' | '1w' | '1m' | '1y';

const PERIOD_CONFIG: { key: Period; label: string; apiPeriod: string; slice: number }[] = [
    { key: '1d', label: 'Bugün', apiPeriod: '5d', slice: 2 },
    { key: '1w', label: 'Bu Hafta', apiPeriod: '1mo', slice: 7 },
    { key: '1m', label: 'Bu Ay', apiPeriod: '3m', slice: 30 },
    { key: '1y', label: 'Bu Yıl', apiPeriod: '1y', slice: 365 },
];

const FETCHABLE_CATEGORIES = new Set(['crypto', 'stock', 'forex', 'precious_metals', 'gold']);

export default function MarketMovers({ assets }: { assets: Asset[] }) {
    const { convert, symbol } = useCurrency();
    const [activePeriod, setActivePeriod] = useState<Period>('1d');
    const [periodData, setPeriodData] = useState<Record<Period, PeriodData>>({
        '1d': { gainers: [], losers: [], loading: false, fetched: false },
        '1w': { gainers: [], losers: [], loading: false, fetched: false },
        '1m': { gainers: [], losers: [], loading: false, fetched: false },
        '1y': { gainers: [], losers: [], loading: false, fetched: false },
    });

    const fetchable = assets.filter(a => a.apiId && FETCHABLE_CATEGORIES.has(a.category));

    useEffect(() => {
        if (fetchable.length === 0) return;
        const cfg = PERIOD_CONFIG.find(p => p.key === activePeriod)!;

        // Already fetched? Skip
        if (periodData[activePeriod].fetched) return;

        setPeriodData(prev => ({
            ...prev,
            [activePeriod]: { ...prev[activePeriod], loading: true },
        }));

        const controller = new AbortController();

        const doFetch = async () => {
            try {
                // For each asset, fetch its price history individually so we can compare past vs now
                const results = await Promise.allSettled(
                    fetchable.map(async (asset) => {
                        const res = await fetch('/api/historical-prices', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                period: cfg.apiPeriod,
                                assets: [{ apiId: asset.apiId, category: asset.category, amount: 1 }],
                            }),
                            signal: controller.signal,
                            cache: 'no-store',
                        });
                        if (!res.ok) return null;
                        const data = await res.json();
                        const points: { date: string; close?: number; value?: number }[] = data.points ?? [];
                        if (points.length < 2) return null;

                        const sliced = points.slice(-Math.max(cfg.slice, 2));
                        const oldest = sliced[0];
                        const latest = sliced[sliced.length - 1];

                        const pricePastRaw = oldest.close ?? oldest.value ?? 0;
                        const priceNowRaw = latest.close ?? latest.value ?? 0;

                        if (!pricePastRaw || !priceNowRaw) return null;

                        // P/L calculation based purely on the asset's price change over that period (independent of currency, since it's a ratio)
                        const pct = ((priceNowRaw - pricePastRaw) / pricePastRaw) * 100;
                        return { asset, pct, pricePast: pricePastRaw, priceNow: priceNowRaw } as MoverResult;
                    })
                );

                const movers: MoverResult[] = results
                    .filter((r): r is PromiseFulfilledResult<MoverResult | null> => r.status === 'fulfilled' && r.value !== null)
                    .map(r => r.value as MoverResult);

                movers.sort((a, b) => b.pct - a.pct);

                const gainers = movers.filter(m => m.pct > 0).slice(0, 3);
                const losers = movers.filter(m => m.pct < 0).reverse().slice(0, 3);

                setPeriodData(prev => ({
                    ...prev,
                    [activePeriod]: { gainers, losers, loading: false, fetched: true },
                }));
            } catch (err: any) {
                if (err?.name !== 'AbortError') {
                    setPeriodData(prev => ({
                        ...prev,
                        [activePeriod]: { ...prev[activePeriod], loading: false, fetched: true },
                    }));
                }
            }
        };

        doFetch();
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePeriod, assets.length]);

    const current = periodData[activePeriod];

    if (fetchable.length === 0) return null;

    return (
        <div style={{
            background: '#0d1117',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16,
            overflow: 'hidden',
            fontFamily: "'Inter', sans-serif",
            marginTop: 0,
        }}>
            {/* ── Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'linear-gradient(135deg, #26a69a22, #26a69a44)',
                        border: '1px solid #26a69a44',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                    }}>⚡</div>
                    <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
                            Portföy Nabzı
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.5 }}>
                            EN ÇOK KAZANDIRANLAR & KAYBETTİRENLER
                        </div>
                    </div>
                </div>

                {/* Period tabs */}
                <div style={{
                    display: 'flex', gap: 2,
                    background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 3,
                }}>
                    {PERIOD_CONFIG.map(p => (
                        <button key={p.key} onClick={() => setActivePeriod(p.key)} style={{
                            padding: '5px 12px', border: 'none', borderRadius: 6,
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                            background: activePeriod === p.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: activePeriod === p.key ? '#fff' : 'rgba(255,255,255,0.35)',
                            transition: 'all 0.15s', letterSpacing: 0.3,
                        }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            {current.loading ? (
                <LoadingState />
            ) : (current.gainers.length === 0 && current.losers.length === 0) ? (
                <EmptyState />
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: current.losers.length > 0 ? '1fr 1fr' : '1fr',
                    gap: 0,
                }}>
                    {/* Gainers */}
                    {current.gainers.length > 0 && (
                        <div style={{ padding: '16px 20px', borderRight: current.losers.length > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                            <SectionHeader label="Kazandıranlar" color="#26a69a" icon="▲" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {current.gainers.map((m, i) => (
                                    <MoverCard key={m.asset.id} mover={m} rank={i + 1} isGain />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Losers */}
                    {current.losers.length > 0 && (
                        <div style={{ padding: '16px 20px' }}>
                            <SectionHeader label="Kaybettirenler" color="#ef5350" icon="▼" />
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                {current.losers.map((m, i) => (
                                    <MoverCard key={m.asset.id} mover={m} rank={i + 1} isGain={false} />
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, color, icon }: { label: string; color: string; icon: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
                fontSize: 10, fontWeight: 800, color,
                background: `${color}18`,
                border: `1px solid ${color}33`,
                borderRadius: 5, padding: '2px 7px', letterSpacing: 0.5,
            }}>
                {icon} {label}
            </span>
        </div>
    );
}

function MoverCard({ mover, rank, isGain }: { mover: MoverResult; rank: number; isGain: boolean }) {
    const [hovered, setHovered] = useState(false);
    const { pct, asset } = mover;
    const meta = getCategoryMeta(asset.category);
    const color = isGain ? '#26a69a' : '#ef5350';
    const sign = isGain ? '+' : '';

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 14px',
                background: hovered ? `${color}0c` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${hovered ? `${color}33` : 'rgba(255,255,255,0.05)'}`,
                borderRadius: 10,
                transition: 'all 0.2s ease',
                cursor: 'default',
                transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
                boxShadow: hovered ? `0 4px 24px ${color}18` : 'none',
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Rank + icon */}
                <div style={{ position: 'relative' }}>
                    <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: `${meta.color}18`,
                        border: `1px solid ${meta.color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15,
                    }}>
                        {meta.icon}
                    </div>
                    <div style={{
                        position: 'absolute', top: -4, right: -4,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#0d1117', border: `1px solid rgba(255,255,255,0.12)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, fontWeight: 800, color: 'rgba(255,255,255,0.4)',
                    }}>
                        {rank}
                    </div>
                </div>

                {/* Name + category */}
                <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
                        {asset.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.3 }}>
                        {meta.labelTR}
                    </div>
                </div>
            </div>

            {/* P/L Badge */}
            <div style={{ textAlign: 'right' }}>
                <div style={{
                    fontSize: 15, fontWeight: 800,
                    color,
                    letterSpacing: -0.3,
                }}>
                    {sign}{pct.toFixed(2)}%
                </div>
                {/* Sparkle bar */}
                <div style={{
                    marginTop: 4, height: 3, borderRadius: 100,
                    background: `rgba(255,255,255,0.06)`,
                    width: 60, overflow: 'hidden',
                }}>
                    <div style={{
                        height: '100%',
                        width: `${Math.min(Math.abs(pct) / 10 * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${color}88, ${color})`,
                        borderRadius: 100,
                        transition: 'width 0.6s ease',
                    }} />
                </div>
            </div>
        </div>
    );
}

function LoadingState() {
    return (
        <div style={{ padding: '32px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[1, 2, 3].map(i => (
                <div key={i} style={{
                    height: 58, borderRadius: 10,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 100%)',
                    backgroundSize: '200% 100%',
                    animation: 'shimmer 1.5s infinite',
                }} />
            ))}
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
            `}</style>
        </div>
    );
}

function EmptyState() {
    return (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6 }}>
                Bu dönem için yeterli geçmiş fiyat verisi bulunamadı.<br />
                Varlıklar birikmaya devam ettikçe göründükçe burada listelenecek.
            </div>
        </div>
    );
}
