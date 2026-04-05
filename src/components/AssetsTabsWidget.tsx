'use client';

import React, { useState, useMemo } from 'react';
import { Asset, CATEGORIES, getCategoryMeta, GOLD_TYPES } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY, formatPercentage } from '@/lib/utils';
import { deleteAsset } from '@/lib/db';
import { getAssetPriceAtDate } from '@/lib/storage';

type PLPeriod = '1d' | '1w' | '1m' | 'all';
type SortKey = 'value' | 'plPct' | 'plVal' | 'name' | 'date';
type SortDir = 'asc' | 'desc';

interface AssetsTabsWidgetProps {
    widgetId: string;
    assets: Asset[];
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
    isMobile?: boolean;
}

function getCutoffDate(period: PLPeriod): Date | null {
    const now = new Date();
    switch (period) {
        case '1d': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
        case '1w': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '1m': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        default: return null;
    }
}

// (Removed hacky gold conversion functions because the database logic in page.tsx already normalizes everything to Adet + Per-Piece prices)

interface SmartTag { label: string; icon: string; color: string; bg: string; title: string; }

function getSmartTags(asset: Asset, exchangeRates: Record<string, number>): SmartTag[] {
    const tags: SmartTag[] = [];
    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? 0;
    const ageMs = Date.now() - new Date(asset.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 365) tags.push({ label: 'Elmas', icon: '💎', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', title: '1 yıldan uzun süredir portföyde' });
    if (currentPriceTRY > 0 && asset.purchasePrice > 0) {
        const unitCostTRY = getAssetCostInTRY(1, asset.purchasePrice, asset.purchaseCurrency, exchangeRates, currentPriceTRY);
        if (unitCostTRY > 0) {
            const pctChange = ((currentPriceTRY - unitCostTRY) / unitCostTRY) * 100;
            if (pctChange > 100) tags.push({ label: 'Rekor', icon: '🔥', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', title: 'Alış fiyatından %100+ yukarıda' });
            if (pctChange < -30) tags.push({ label: 'Dip', icon: '📉', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', title: 'Alış fiyatından %30+ aşağıda' });
        }
    }
    return tags;
}

function computePL(asset: Asset, plPeriod: PLPeriod, exchangeRates: Record<string, number>, convert: (v: number) => number): { pct: number; valDisplay: number; isPositive: boolean } | null {
    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentValueTRY = asset.amount * currentPriceTRY;
    if (plPeriod === 'all') {
        const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates, currentPriceTRY);
        if (costTRY > 0) {
            const plTRY = currentValueTRY - costTRY;
            const pct = (plTRY / costTRY) * 100;
            return { pct, valDisplay: convert(plTRY), isPositive: plTRY >= 0 };
        }
    } else {
        const cutoff = getCutoffDate(plPeriod);
        if (cutoff) {
            const pastPrice = getAssetPriceAtDate(asset.id, cutoff);
            if (pastPrice !== null && pastPrice > 0) {
                const change = currentPriceTRY - pastPrice;
                const pct = (change / pastPrice) * 100;
                return { pct, valDisplay: convert(change * asset.amount), isPositive: change >= 0 };
            } else {
                return null;
            }
        }
    }
    return null;
}

const PL_PERIODS: { key: PLPeriod; label: string }[] = [
    { key: '1d', label: 'Günlük' },
    { key: '1w', label: 'Haftalık' },
    { key: '1m', label: 'Aylık' },
    { key: 'all', label: 'Tümü' },
];

export default function AssetsTabsWidget({ widgetId, assets, onDelete, onEdit, onSell, onAnalyze, isMobile = false }: AssetsTabsWidgetProps) {
    const [activeTab, setActiveTab] = useState<string>('all');
    const [plPeriod, setPLPeriod] = useState<PLPeriod>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<SortKey>('value');
    const [sortDir, setSortDir] = useState<SortDir>('desc');
    const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
    const { convert, exchangeRates, currency } = useCurrency();

    const categoriesWithAssets = useMemo(() => {
        const counts = new Map<string, number>();
        assets.forEach(a => counts.set(a.category, (counts.get(a.category) || 0) + 1));
        return CATEGORIES.filter(c => counts.has(c.key)).map(c => ({ ...c, count: counts.get(c.key) || 0 }));
    }, [assets]);

    const filteredAndSortedAssets = useMemo(() => {
        let list = assets;
        if (activeTab !== 'all') list = list.filter(a => a.category === activeTab);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(a => a.name.toLowerCase().includes(q) || getCategoryMeta(a.category).labelTR.toLowerCase().includes(q));
        }
        const sorted = [...list].sort((a, b) => {
            let cmp = 0;
            const priceA = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            const priceB = b.currentPrice ?? b.manualCurrentPrice ?? b.purchasePrice;
            const valA = a.amount * priceA;
            const valB = b.amount * priceB;
            switch (sortKey) {
                case 'value': cmp = valB - valA; break;
                case 'plPct': {
                    const plA = computePL(a, plPeriod, exchangeRates, convert);
                    const plB = computePL(b, plPeriod, exchangeRates, convert);
                    cmp = (plB?.pct ?? -Infinity) - (plA?.pct ?? -Infinity);
                    break;
                }
                case 'plVal': {
                    const plA = computePL(a, plPeriod, exchangeRates, convert);
                    const plB = computePL(b, plPeriod, exchangeRates, convert);
                    cmp = (plB?.valDisplay ?? -Infinity) - (plA?.valDisplay ?? -Infinity);
                    break;
                }
                case 'name': cmp = a.name.localeCompare(b.name, 'tr'); break;
                case 'date': cmp = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(); break;
            }
            return sortDir === 'desc' ? cmp : -cmp;
        });
        return sorted;
    }, [assets, activeTab, searchQuery, sortKey, sortDir, plPeriod, exchangeRates, convert]);

    const handleSortClick = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        else { setSortKey(key); setSortDir('desc'); }
    };

    const fmt = (n: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    // Portfolio stats for selected tab
    const tabTotalVal = filteredAndSortedAssets.reduce((s, a) => {
        const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
        return s + convert(a.amount * p);
    }, 0);
    const tabTotalCost = filteredAndSortedAssets.reduce((s, a) => {
        if (a.purchasePrice <= 0) return s;
        const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
        return s + convert(getAssetCostInTRY(a.amount, a.purchasePrice, a.purchaseCurrency, exchangeRates, p));
    }, 0);
    const tabPL = tabTotalVal - tabTotalCost;
    const tabPLPct = tabTotalCost > 0 ? ((tabPL) / tabTotalCost) * 100 : 0;
    const tabIsUp = tabPL >= 0;

    const activeCatMeta = categoriesWithAssets.find(c => c.key === activeTab);

    return (
        <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>

            {/* ── HEADER STRIP ── */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr auto',
                gap: 16, marginBottom: 20, alignItems: 'flex-start',
            }}>
                <div>
                    <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 4px', letterSpacing: -0.7 }}>
                        Varlıklarım
                    </h1>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', margin: 0, fontWeight: 500 }}>
                        {assets.length} yatırım · {categoriesWithAssets.length} kategori
                    </p>
                </div>

                {/* Search bar */}
                <div style={{ position: 'relative', width: 220 }}>
                    <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
                    }}>🔍</span>
                    <input
                        type="text" placeholder="Ara..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '9px 14px 9px 34px',
                            borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)',
                            background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
                            fontSize: 12, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => (e.target.style.borderColor = 'rgba(167,139,250,0.4)')}
                        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.08)')}
                    />
                </div>
            </div>

            {/* ── CATEGORY TABS ── */}
            {categoriesWithAssets.length > 0 && (
                <div style={{
                    display: 'flex', gap: 0, marginBottom: 20, overflowX: 'auto',
                    borderBottom: '1px solid rgba(255,255,255,0.07)',
                }} className="hide-scrollbar">
                    {[{ key: 'all', icon: '◈', labelTR: 'Tümü', count: assets.length, color: '#a78bfa' }, ...categoriesWithAssets].map(cat => {
                        const active = activeTab === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setActiveTab(cat.key)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '10px 18px', border: 'none', cursor: 'pointer',
                                    background: 'transparent', whiteSpace: 'nowrap', flexShrink: 0,
                                    borderBottom: active ? `2px solid ${cat.color}` : '2px solid transparent',
                                    color: active ? 'var(--text-primary)' : 'rgba(255,255,255,0.35)',
                                    fontSize: 13, fontWeight: active ? 700 : 500,
                                    transition: 'all 0.15s', marginBottom: -1,
                                }}
                            >
                                <span style={{ fontSize: 14 }}>{cat.icon}</span>
                                {cat.labelTR}
                                <span style={{
                                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 6,
                                    background: active ? `${cat.color}22` : 'rgba(255,255,255,0.05)',
                                    color: active ? cat.color : 'rgba(255,255,255,0.3)',
                                }}>{cat.count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── PORTFOLIO SUMMARY BAND ── */}
            {filteredAndSortedAssets.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: 12, marginBottom: 20,
                }}>
                    {[
                        { label: 'Toplam Değer', value: fmt(tabTotalVal), color: '#a78bfa', icon: '💰' },
                        { label: 'Toplam Maliyet', value: fmt(tabTotalCost), color: 'rgba(255,255,255,0.5)', icon: '📦' },
                        {
                            label: 'Kar / Zarar', icon: tabIsUp ? '📈' : '📉',
                            value: `${tabIsUp ? '+' : ''}${fmt(tabPL)}`,
                            sub: `${tabIsUp ? '+' : ''}${tabPLPct.toFixed(2)}%`,
                            color: tabIsUp ? '#10b981' : '#ef4444',
                        },
                        { label: 'Varlık Sayısı', value: String(filteredAndSortedAssets.length), color: '#60a5fa', icon: '🗂️' },
                    ].map(item => (
                        <div key={item.label} style={{
                            padding: '14px 16px', borderRadius: 12,
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                                {item.icon} {item.label}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: item.color, fontVariantNumeric: 'tabular-nums' }}>
                                {item.value}
                            </div>
                            {'sub' in item && item.sub && (
                                <div style={{ fontSize: 11, color: item.color, opacity: 0.7, marginTop: 2, fontWeight: 600 }}>{item.sub}</div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── CONTROLS ROW — simplified on mobile ── */}
            {isMobile ? (
                <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }} className="hide-scrollbar">
                    {PL_PERIODS.map(p => (
                        <button key={p.key} onClick={() => setPLPeriod(p.key)} style={{
                            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                            background: plPeriod === p.key ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)',
                            color: plPeriod === p.key ? 'var(--text-primary)' : 'rgba(255,255,255,0.45)',
                            fontSize: 12, fontWeight: 700, flexShrink: 0,
                            boxShadow: plPeriod === p.key ? '0 4px 12px rgba(99,102,241,0.3)' : 'none',
                            transition: 'all 0.2s',
                        }}>{p.label}</button>
                    ))}
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                    {/* P/L Period */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.3 }}>KAR/ZARAR DÖNEMİ:</span>
                        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 2, border: '1px solid rgba(255,255,255,0.07)' }}>
                            {PL_PERIODS.map(p => (
                                <button key={p.key} onClick={() => setPLPeriod(p.key)} style={{
                                    padding: '5px 12px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                                    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                    background: plPeriod === p.key ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                                    color: plPeriod === p.key ? 'var(--text-primary)' : 'rgba(255,255,255,0.35)',
                                    boxShadow: plPeriod === p.key ? '0 2px 8px rgba(99,102,241,0.4)' : 'none',
                                }}>{p.label}</button>
                            ))}
                        </div>
                    </div>

                    {/* Sort — compact */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.3 }}>SIRALA:</span>
                        {([
                            { k: 'value', l: 'Değer' },
                            { k: 'plPct', l: 'K/Z%' },
                            { k: 'name', l: 'İsim' },
                            { k: 'date', l: 'Tarih' },
                        ] as { k: SortKey; l: string }[]).map(s => (
                            <button key={s.k} onClick={() => handleSortClick(s.k)} style={{
                                padding: '4px 10px', fontSize: 11, fontWeight: 600, borderRadius: 6,
                                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                                background: sortKey === s.k ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: sortKey === s.k ? 'var(--text-primary)' : 'rgba(255,255,255,0.3)',
                            }}>
                                {s.l}{sortKey === s.k ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── TABLE HEADER — hidden on mobile ── */}
            {!isMobile && filteredAndSortedAssets.length > 0 && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                    padding: '8px 16px',
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.8,
                    color: 'rgba(255,255,255,0.25)',
                    textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    marginBottom: 4,
                }}>
                    <span>Varlık</span>
                    <span style={{ textAlign: 'right' }}>Birim Fiyat</span>
                    <span style={{ textAlign: 'right' }}>Değer</span>
                    <span style={{ textAlign: 'right' }}>{PL_PERIODS.find(p => p.key === plPeriod)?.label} K/Z</span>
                    <span style={{ textAlign: 'center' }}>İşlem</span>
                </div>
            )}

            {/* ── ASSET ROWS ── */}
            <div>
                {filteredAndSortedAssets.length === 0 ? (
                    <div style={{ padding: '48px 0', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                        {searchQuery ? `"${searchQuery}" ile eşleşen varlık yok` : 'Bu kategoride varlık yok'}
                    </div>
                ) : (
                    filteredAndSortedAssets.map((asset, idx) => (
                        <AssetTableRow
                            key={asset.id}
                            asset={asset}
                            plPeriod={plPeriod}
                            onDelete={onDelete}
                            onEdit={onEdit}
                            onSell={onSell}
                            onAnalyze={onAnalyze}
                            expanded={expandedAssetId === asset.id}
                            onToggle={() => setExpandedAssetId(prev => prev === asset.id ? null : asset.id)}
                            isLast={idx === filteredAndSortedAssets.length - 1}
                            isMobile={isMobile}
                        />
                    ))
                )}
            </div>

            {/* ── FOOTER ── */}
            {filteredAndSortedAssets.length > 0 && (
                <div style={{
                    marginTop: 16, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
                    display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.2)',
                }}>
                    <span>{filteredAndSortedAssets.length} varlık gösteriliyor</span>
                    <span>P/L dönemi: {PL_PERIODS.find(p => p.key === plPeriod)?.label}</span>
                </div>
            )}

            <style>{`
                @keyframes rowFadeIn {
                    from { opacity: 0; transform: translateY(8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes detailExpand {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
// Asset Table Row
// ─────────────────────────────────────────────────────────────────────────────
function AssetTableRow({
    asset, plPeriod, onDelete, onEdit, onSell, onAnalyze, expanded, onToggle, isLast, isMobile = false,
}: {
    asset: Asset;
    plPeriod: PLPeriod;
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
    expanded: boolean;
    onToggle: () => void;
    isLast: boolean;
    isMobile?: boolean;
}) {
    const cat = getCategoryMeta(asset.category);
    const { currency, convert, exchangeRates } = useCurrency();
    const [hovered, setHovered] = useState(false);
    const [actionsHovered, setActionsHovered] = useState(false);

    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentValueTRY = asset.amount * currentPriceTRY;
    const currentValueDisplay = convert(currentValueTRY);
    const pl = computePL(asset, plPeriod, exchangeRates, convert);
    const tags = getSmartTags(asset, exchangeRates);
    const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates, currentPriceTRY);

    const fmt = (n: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

    const handleDelete = async () => {
        if (window.confirm(`"${asset.name}" varlığını silmek istediğinize emin misiniz?`)) {
            await deleteAsset(asset.id);
            onDelete(asset.id);
        }
    };

    const plColor = pl ? (pl.isPositive ? '#10b981' : '#ef4444') : 'rgba(255,255,255,0.3)';

    return (
        <>
                {/* Mobile layout: premium card with left accent bar */}
                {isMobile ? (
                    <div
                        onClick={onToggle}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 14,
                            padding: '14px 14px 14px 0',
                            borderRadius: 16,
                            cursor: 'pointer',
                            background: expanded ? `${cat.color}0d` : 'rgba(255,255,255,0.025)',
                            border: `1px solid ${expanded ? cat.color + '30' : 'rgba(255,255,255,0.07)'}`,
                            marginBottom: 1,
                            transition: 'all 0.2s',
                            position: 'relative',
                            overflow: 'hidden',
                        }}
                    >
                        {/* Left accent bar */}
                        <div style={{
                            width: 3, alignSelf: 'stretch', flexShrink: 0,
                            background: `linear-gradient(180deg, ${cat.color}, ${cat.color}55)`,
                            borderRadius: '0 2px 2px 0',
                            minHeight: 48,
                        }} />
                        {/* Icon */}
                        <div style={{
                            width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                            background: `${cat.color}18`, border: `1px solid ${cat.color}28`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                            position: 'relative',
                        }}>
                            {cat.icon}
                            {asset.currentPrice && (
                                <span style={{
                                    position: 'absolute', top: -3, right: -3,
                                    width: 9, height: 9, borderRadius: '50%',
                                    background: '#10b981', border: '2px solid #09101f',
                                }} />
                            )}
                        </div>
                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3 }}>
                                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {asset.name}
                                </span>
                            </div>
                            <div style={{ fontSize: 11, color: cat.color, opacity: 0.8, fontWeight: 600 }}>
                                {cat.labelTR} · {asset.amount.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} adet
                            </div>
                        </div>
                        {/* Value + P/L */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 3, fontVariantNumeric: 'tabular-nums' }}>
                                {fmt(currentValueDisplay)}
                            </div>
                            {pl ? (
                                <div style={{
                                    fontSize: 12, fontWeight: 700, color: plColor,
                                    fontVariantNumeric: 'tabular-nums',
                                }}>{pl.isPositive ? '+' : ''}{pl.pct.toFixed(2)}%</div>
                            ) : (
                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>—</span>
                            )}
                        </div>
                        {/* Expand chevron */}
                        <span style={{
                            fontSize: 12, color: 'rgba(255,255,255,0.25)',
                            transform: expanded ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s', flexShrink: 0, paddingRight: 6,
                        }}>▾</span>
                    </div>
                ) : (
                /* Desktop layout: 5-col grid */
                <div
                    onClick={onToggle}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: expanded
                            ? `${cat.color}0a`
                            : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                        borderBottom: isLast && !expanded ? 'none' : '1px solid rgba(255,255,255,0.04)',
                        transition: 'background 0.15s',
                        gap: 8,
                    }}
                >
                    {/* Col 1: Asset identity */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                        <div style={{
                            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                            background: `linear-gradient(135deg, ${cat.color}30, ${cat.color}15)`,
                            border: `1px solid ${cat.color}30`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 18, position: 'relative',
                        }}>
                            {cat.icon}
                            {asset.currentPrice && (
                                <span style={{
                                    position: 'absolute', top: -4, right: -4,
                                    width: 10, height: 10, borderRadius: '50%',
                                    background: '#10b981', border: '2px solid #0a1021',
                                    boxShadow: '0 0 6px rgba(16,185,129,0.8)',
                                }} />
                            )}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</span>
                                {tags.map((tag, i) => (
                                    <span key={i} title={tag.title} style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: tag.bg, color: tag.color, letterSpacing: 0.3, flexShrink: 0 }}>{tag.icon}</span>
                                ))}
                                <span style={{ fontSize: 10, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : '', color: 'rgba(255,255,255,0.2)', lineHeight: 1 }}>▾</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 10, fontWeight: 600, color: cat.color, opacity: 0.75 }}>{cat.labelTR}</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>·</span>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>{asset.amount.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} adet</span>
                            </div>
                        </div>
                    </div>
                    {/* Col 2: Unit price */}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)', fontVariantNumeric: 'tabular-nums' }}>{fmt(convert(currentPriceTRY))}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>birim</div>
                    </div>
                    {/* Col 3: Total value */}
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmt(currentValueDisplay)}</div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 1 }}>toplam</div>
                    </div>
                    {/* Col 4: P/L */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {pl ? (
                            <>
                                <div style={{ fontSize: 12, fontWeight: 800, color: plColor, fontVariantNumeric: 'tabular-nums' }}>{pl.isPositive ? '+' : ''}{pl.pct.toFixed(2)}%</div>
                                <div style={{ fontSize: 10, color: plColor, opacity: 0.7, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{pl.isPositive ? '+' : ''}{fmt(pl.valDisplay)}</div>
                            </>
                        ) : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>—</span>}
                    </div>
                    {/* Col 5: Actions */}
                    <div style={{ display: 'flex', gap: 3 }} onClick={e => e.stopPropagation()}
                        onMouseEnter={() => setActionsHovered(true)}
                        onMouseLeave={() => setActionsHovered(false)}>
                        {[
                            onAnalyze && { icon: '🤖', title: 'AI Analiz', onClick: () => onAnalyze!(asset), col: '#a78bfa' },
                            { icon: '✏️', title: 'Düzenle', onClick: () => onEdit(asset), col: 'rgba(255,255,255,0.4)' },
                            { icon: '💸', title: 'Sat', onClick: () => onSell(asset), col: '#f59e0b' },
                            { icon: '🗑', title: 'Sil', onClick: handleDelete, col: '#ef4444' },
                        ].filter(Boolean).map((btn: any) => (
                            <button key={btn.title} onClick={btn.onClick} title={btn.title} style={{
                                width: 28, height: 28, borderRadius: 7, fontSize: 13,
                                cursor: 'pointer', border: 'none',
                                background: hovered || actionsHovered ? `${btn.col}15` : 'transparent',
                                color: hovered || actionsHovered ? btn.col : 'rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}>{btn.icon}</button>
                        ))}
                    </div>
                </div>
                )}

            {/* Expanded detail panel */}
            {expanded && (
                <div style={{
                    margin: '0 8px 4px 64px', padding: '16px 20px',
                    background: `linear-gradient(135deg, ${cat.color}08, rgba(255,255,255,0.015))`,
                    borderRadius: '0 0 12px 12px',
                    border: `1px solid ${cat.color}18`, borderTop: 'none',
                    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: '14px 24px', animation: 'detailExpand 0.18s ease',
                    marginBottom: 8,
                }}>
                    {[
                        { label: 'Alış Fiyatı', value: fmt(convert(asset.purchasePrice)) },
                        { label: 'Güncel Fiyat', value: fmt(convert(currentPriceTRY)), accent: true },
                        { label: 'Birim K/Z', value: asset.purchasePrice > 0 ? fmt(convert(currentPriceTRY - asset.purchasePrice)) : '—', isPositive: currentPriceTRY >= asset.purchasePrice },
                        { label: 'Toplam Maliyet', value: fmt(convert(costTRY)) },
                        { label: 'Güncel Toplam', value: fmt(currentValueDisplay), accent: true },
                        { label: 'Toplam K/Z', value: pl ? `${pl.isPositive ? '+' : ''}${fmt(pl.valDisplay)}` : '—', isPositive: pl?.isPositive ?? true },
                        { label: 'Alış Tarihi', value: new Date(asset.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' }) },
                        { label: 'Para Birimi', value: asset.purchaseCurrency || 'TRY' },
                        { label: 'Kategori', value: `${cat.icon} ${cat.labelTR}` },
                    ].map(item => {
                        let color = 'rgba(255,255,255,0.8)';
                        if (item.accent) color = cat.color;
                        if (item.isPositive === true) color = '#10b981';
                        if (item.isPositive === false) color = '#ef4444';
                        return (
                            <div key={item.label}>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, letterSpacing: 0.4, marginBottom: 4, textTransform: 'uppercase' }}>{item.label}</div>
                                <div style={{ fontSize: 13, fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{item.value}</div>
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}
