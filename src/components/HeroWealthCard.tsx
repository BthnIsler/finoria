'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Asset } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   Types
───────────────────────────────────────────────────────────── */
interface HistoryEntry {
    date: string;
    total: number;
}

interface HeroPL {
    pl: number;
    pct: number;
}

type PLPeriod = '1d' | '1w' | '1m' | 'all';

interface HeroWealthCardProps {
    assets: Asset[];
    totalWealth: number;
    totalCost: number;
    history: HistoryEntry[];
    heroPLPeriod: PLPeriod;
    setHeroPLPeriod: (p: PLPeriod) => void;
    activeHeroPL: HeroPL;
    onShare?: () => void;
}

import AnimatedNumber from './AnimatedNumber';

/* ─────────────────────────────────────────────────────────────
   3. Sparkline SVG (drawn as a silhouette beneath the number)
───────────────────────────────────────────────────────────── */
function SparklineSilhouette({
    history,
    totalWealth,
    isUp,
}: {
    history: HistoryEntry[];
    totalWealth: number;
    isUp: boolean;
}) {
    const points = useMemo(() => {
        const data = history.map((h) => h.total);
        if (data.length === 0) return [];
        const all = [...data, totalWealth];
        const min = Math.min(...all);
        const max = Math.max(...all);
        const range = max - min || 1;
        const n = all.length;
        return all.map((v, i) => ({
            x: (i / (n - 1)) * 100,
            y: 100 - ((v - min) / range) * 90, // 5% padding top/bottom → range 5..95
        }));
    }, [history, totalWealth]);

    if (points.length < 2) return null;

    const d =
        points
            .map((p, i) =>
                i === 0
                    ? `M ${p.x} ${p.y}`
                    : `L ${p.x} ${p.y}`
            )
            .join(' ') +
        ` L 100 100 L 0 100 Z`;

    const lineD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');

    const fillColor = isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.1)';
    const strokeColor = isUp ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.35)';

    return (
        <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
            }}
        >
            <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            {/* Fill area */}
            <path d={d} fill="url(#sparkGrad)" />
            {/* Line */}
            <path d={lineD} stroke={strokeColor} strokeWidth="0.8" fill="none" />
        </svg>
    );
}

/* ─────────────────────────────────────────────────────────────
   4. Smart Greeting + AI summary line
───────────────────────────────────────────────────────────── */
function SmartGreeting({
    assets,
    totalWealth,
    activeHeroPL,
    heroPLPeriod,
}: {
    assets: Asset[];
    totalWealth: number;
    activeHeroPL: HeroPL;
    heroPLPeriod: PLPeriod;
}) {
    const { convert, currency } = useCurrency();

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 6) return '🌙 İyi geceler';
        if (hour < 12) return '☀️ Günaydın';
        if (hour < 18) return '🌤 İyi günler';
        return '🌆 İyi akşamlar';
    }, []);

    const summary = useMemo(() => {
        if (assets.length === 0) return 'Portföyünüzü oluşturmaya başlayın 🚀';
        const plAbs = Math.abs(activeHeroPL.pl);
        const plStr = new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(convert(plAbs));

        const periodLabels: Record<PLPeriod, string> = {
            '1d': 'bugün',
            '1w': 'bu hafta',
            '1m': 'bu ay',
            'all': 'toplam',
        };
        const label = periodLabels[heroPLPeriod];

        if (activeHeroPL.pl > 0) {
            // find top gainer asset
            const topAsset = [...assets].sort((a, b) => {
                const va = a.amount * (a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice);
                const vb = b.amount * (b.currentPrice ?? b.manualCurrentPrice ?? b.purchasePrice);
                return vb - va;
            })[0];
            return `${label} portföyünüz ${plStr} kazandı 📈${topAsset ? ` · En değerlisi: ${topAsset.name}` : ''}`;
        } else if (activeHeroPL.pl < 0) {
            return `${label} portföyünüz ${plStr} geride kaldı 📉 · Piyasaları takip edin`;
        }
        return `${assets.length} varlık ile portföyünüz takip ediliyor ·  ${new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
    }, [assets, activeHeroPL, heroPLPeriod, convert, currency]);

    return (
        <div style={{ marginBottom: 8, textAlign: 'center' }}>
            <p style={{
                fontSize: 12, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.5,
                fontWeight: 500, marginBottom: 2,
            }}>
                {greeting}
            </p>
            <p style={{
                fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: 0.2,
                fontWeight: 400, maxWidth: 420, margin: '0 auto',
                lineHeight: 1.5,
            }}>
                {summary}
            </p>
        </div>
    );
}

/* ─────────────────────────────────────────────────────────────
   Main Hero Card
───────────────────────────────────────────────────────────── */
export default function HeroWealthCard({
    assets,
    totalWealth,
    totalCost,
    history,
    heroPLPeriod,
    setHeroPLPeriod,
    activeHeroPL,
    onShare,
}: HeroWealthCardProps) {
    const { convert, currency, symbol } = useCurrency();

    const isUp = activeHeroPL.pl >= 0;
    const hasData = assets.length > 0;

    const fmt = useCallback((n: number) =>
        new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(n),
        [currency]);

    const fmtShort = useCallback((n: number) =>
        new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 0, maximumFractionDigits: 0,
        }).format(n),
        [currency]);

    // ── Mesh gradient colours (shift based on P/L direction) ──
    // isUp → teal/emerald glow; isDown → rose/crimson glow; neutral → purple
    const glowColour = !hasData
        ? 'rgba(139,92,246,0.18)'
        : isUp
            ? 'rgba(16,185,129,0.20)'
            : 'rgba(239,68,68,0.18)';

    const glowColour2 = !hasData
        ? 'rgba(34,211,238,0.10)'
        : isUp
            ? 'rgba(34,211,238,0.10)'
            : 'rgba(249,115,22,0.10)';

    // P/L period config
    const periods = [
        { key: '1d' as PLPeriod, label: '1G' },
        { key: '1w' as PLPeriod, label: '1 Hafta' },
        { key: '1m' as PLPeriod, label: '1A' },
        { key: 'all' as PLPeriod, label: 'Tümü' },
    ];

    return (
        <div
            className="wealth-hero wealth-hero-hover"
            style={{
                position: 'relative',
                overflow: 'hidden',
                padding: '40px 36px 32px',
                marginBottom: 0,
                textAlign: 'center',
            }}
        >
            {/* ── Animated mesh gradient background ── */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                background: `
                    radial-gradient(ellipse 80% 80% at 50% 100%, ${glowColour}, transparent),
                    radial-gradient(ellipse 60% 50% at 20% 20%, ${glowColour2}, transparent)
                `,
                transition: 'background 1.2s ease',
            }} />

            {/* ── Shimmer overlay on top edge ── */}
            <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${isUp ? '#10b981' : '#ef4444'}, transparent)`,
                opacity: 0.6, pointerEvents: 'none', zIndex: 1,
                animation: 'shimmerLine 3.5s ease-in-out infinite',
            }} />
            <style>{`
                @keyframes shimmerLine {
                    0%, 100% { opacity: 0.2; transform: scaleX(0.3) translateX(-100%); }
                    50%       { opacity: 0.7; transform: scaleX(1) translateX(0%); }
                }
                @keyframes meshPulse {
                    0%, 100% { opacity: 1; }
                    50%      { opacity: 0.75; }
                }
            `}</style>

            {/* ── Share Button ── */}
            {hasData && onShare && (
                <button
                    onClick={onShare}
                    title="Portföyünü Paylaş"
                    style={{
                        position: 'absolute', top: 14, right: 14, zIndex: 2,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
                        fontSize: 12, color: 'rgba(255,255,255,0.5)', transition: 'all 0.15s',
                        fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4,
                    }}
                    onMouseOver={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
                    onMouseOut={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; }}
                >
                    📤 Paylaş
                </button>
            )}

            {/* ── Content layer ── */}
            <div style={{ position: 'relative', zIndex: 2 }}>

                {/* Smart Greeting + Summary */}
                <SmartGreeting
                    assets={assets}
                    totalWealth={totalWealth}
                    activeHeroPL={activeHeroPL}
                    heroPLPeriod={heroPLPeriod}
                />

                {/* "TOPLAM SERVET" label with shimmer */}
                <p style={{
                    fontSize: 10,
                    letterSpacing: 3,
                    textTransform: 'uppercase',
                    marginBottom: 10,
                    fontWeight: 700,
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.7) 40%, rgba(255,255,255,0.3) 80%)',
                    backgroundSize: '200% auto',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    animation: 'textShimmer 4s linear infinite',
                }}>
                    Toplam Servet
                </p>
                <style>{`
                    @keyframes textShimmer {
                        0%   { background-position: 200% center; }
                        100% { background-position: -200% center; }
                    }
                `}</style>

                {/* Main wealth figure — Odometer */}
                <h2
                    className="wealth-glow"
                    style={{
                        fontSize: hasData ? 48 : 32,
                        fontWeight: 900,
                        letterSpacing: -2,
                        marginBottom: 4,
                        lineHeight: 1,
                    }}
                >
                    {hasData ? (
                        <AnimatedNumber
                            value={convert(totalWealth)}
                            formatter={fmt}
                            duration={2000}
                        />
                    ) : `${symbol}0,00`}
                </h2>

                {/* Stats row */}
                {hasData && totalCost > 0 && (
                    <div style={{
                        display: 'flex', justifyContent: 'center',
                        gap: 0, marginTop: 22,
                        background: 'rgba(255,255,255,0.04)',
                        borderRadius: 14,
                        border: '1px solid rgba(255,255,255,0.07)',
                        overflow: 'hidden',
                    }}>
                        {/* Cost */}
                        <div style={{ flex: 1, textAlign: 'center', padding: '14px 12px' }}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                                Maliyet
                            </p>
                            <p style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>
                                <AnimatedNumber value={convert(totalCost)} formatter={fmtShort} duration={2000} />
                            </p>
                        </div>

                        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

                        {/* P/L */}
                        <div style={{ flex: 1, textAlign: 'center', padding: '14px 12px' }}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                                Kâr / Zarar
                            </p>
                            <p style={{
                                fontSize: 14, fontWeight: 700,
                                color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                                marginBottom: 4,
                            }}>
                                {isUp ? '▲ ' : '▼ '}
                                <AnimatedNumber value={Math.abs(convert(activeHeroPL.pl))} formatter={fmtShort} duration={2000} />
                                <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.8 }}>
                                    ({activeHeroPL.pct >= 0 ? '+' : ''}{activeHeroPL.pct.toFixed(1)}%)
                                </span>
                            </p>
                            {/* Period tabs */}
                            <div style={{ display: 'flex', gap: 0, justifyContent: 'center' }}>
                                {periods.map((p) => (
                                    <button
                                        key={p.key}
                                        onClick={() => setHeroPLPeriod(p.key)}
                                        style={{
                                            background: 'none', border: 'none', cursor: 'pointer',
                                            fontSize: 9, fontWeight: heroPLPeriod === p.key ? 800 : 500,
                                            letterSpacing: 0.3,
                                            color: heroPLPeriod === p.key
                                                ? (isUp ? 'var(--accent-green)' : 'var(--accent-red)')
                                                : 'rgba(255,255,255,0.25)',
                                            padding: '2px 6px', transition: 'all 0.2s',
                                            borderBottom: heroPLPeriod === p.key
                                                ? `2px solid ${isUp ? 'var(--accent-green)' : 'var(--accent-red)'}`
                                                : '2px solid transparent',
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div style={{ width: 1, background: 'rgba(255,255,255,0.06)', alignSelf: 'stretch' }} />

                        {/* Asset count */}
                        <div style={{ flex: 1, textAlign: 'center', padding: '14px 12px' }}>
                            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
                                Varlıklar
                            </p>
                            <p style={{ fontWeight: 700, fontSize: 22, color: 'rgba(255,255,255,0.85)', lineHeight: 1 }}>
                                {assets.length}
                            </p>
                            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
                                kalem
                            </p>
                        </div>
                    </div>
                )}

                {!hasData && (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 8 }}>
                        Portföyünüzü oluşturmaya başlayın 🚀
                    </p>
                )}
            </div>
        </div>
    );
}
