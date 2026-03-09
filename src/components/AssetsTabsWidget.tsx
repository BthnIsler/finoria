'use client';

import React, { useState, useMemo } from 'react';
import { Asset, CATEGORIES, getCategoryMeta } from '@/lib/types';
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

interface SmartTag {
    label: string;
    icon: string;
    color: string;
    bg: string;
    title: string;
}

function getSmartTags(asset: Asset, exchangeRates: Record<string, number>): SmartTag[] {
    const tags: SmartTag[] = [];
    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? 0;

    const ageMs = Date.now() - new Date(asset.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 365) {
        tags.push({ label: 'Elmas', icon: '💎', color: '#22d3ee', bg: 'rgba(34,211,238,0.1)', title: '1 yıldan uzun süredir portföyde' });
    }

    if (currentPriceTRY > 0 && asset.purchasePrice > 0) {
        const unitCostTRY = getAssetCostInTRY(1, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
        if (unitCostTRY > 0) {
            const pctChange = ((currentPriceTRY - unitCostTRY) / unitCostTRY) * 100;
            if (pctChange > 100) tags.push({ label: 'Rekor', icon: '🔥', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', title: 'Alış fiyatından %100+ yukarıda' });
            if (pctChange < -30) tags.push({ label: 'Dip', icon: '📉', color: '#ef4444', bg: 'rgba(239,68,68,0.1)', title: 'Alış fiyatından %30+ aşağıda' });
        }
    }
    return tags;
}

function computePL(
    asset: Asset,
    plPeriod: PLPeriod,
    exchangeRates: Record<string, number>,
    convert: (v: number) => number
): { pct: number; valDisplay: number; isPositive: boolean; label: string } | null {
    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentValueTRY = asset.amount * currentPriceTRY;

    if (plPeriod === 'all') {
        if (asset.purchasePrice > 0) {
            const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
            if (costTRY > 0) {
                const plTRY = currentValueTRY - costTRY;
                const pct = (plTRY / costTRY) * 100;
                return { pct, valDisplay: convert(plTRY), isPositive: plTRY >= 0, label: '' };
            }
        }
    } else {
        const cutoff = getCutoffDate(plPeriod);
        if (cutoff) {
            const pastPrice = getAssetPriceAtDate(asset.id, cutoff);
            if (pastPrice !== null && pastPrice > 0) {
                const change = currentPriceTRY - pastPrice;
                const pct = (change / pastPrice) * 100;
                const plTRY = change * asset.amount;
                return { pct, valDisplay: convert(plTRY), isPositive: change >= 0, label: '' };
            } else if (asset.purchasePrice > 0) {
                const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
                if (costTRY > 0) {
                    const plTRY = currentValueTRY - costTRY;
                    const pct = (plTRY / costTRY) * 100;
                    return { pct, valDisplay: convert(plTRY), isPositive: plTRY >= 0, label: '∞' };
                }
            }
        }
    }
    return null;
}

// ── Asset Row ──
function AssetRow({ asset, plPeriod, onDelete, onEdit, onSell, onAnalyze, expanded, onToggle }: {
    asset: Asset;
    plPeriod: PLPeriod;
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
    expanded: boolean;
    onToggle: () => void;
}) {
    const cat = getCategoryMeta(asset.category);
    const { currency, convert, exchangeRates } = useCurrency();
    const [hovered, setHovered] = useState(false);

    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentValueTRY = asset.amount * currentPriceTRY;
    const currentValueDisplay = convert(currentValueTRY);

    const pl = computePL(asset, plPeriod, exchangeRates, convert);
    const tags = getSmartTags(asset, exchangeRates);

    const fmt = (n: number) =>
        new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(n);

    const handleDelete = async () => {
        if (window.confirm(`"${asset.name}" varlığını silmek istediğinize emin misiniz?`)) {
            await deleteAsset(asset.id);
            onDelete(asset.id);
        }
    };

    const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);

    const PERIOD_LABELS: Record<PLPeriod, string> = {
        '1d': 'Günlük KZ',
        '1w': 'Haftalık KZ',
        '1m': 'Aylık KZ',
        'all': 'Toplam KZ',
    };

    const plPercentFormatted = pl ? `${pl.isPositive ? '+' : ''}${pl.pct.toFixed(2)}%` : null;
    const plValFormatted = pl ? `${pl.isPositive ? '+' : ''}${fmt(pl.valDisplay)}` : null;

    return (
        <div style={{ position: 'relative', marginBottom: 8 }}>
            <div
                onClick={onToggle}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    borderRadius: 16,
                    background: hovered
                        ? `linear-gradient(135deg, ${cat.color}0a 0%, rgba(255,255,255,0.03) 100%)`
                        : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${hovered ? cat.color + '35' : 'rgba(255,255,255,0.06)'}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.4,0,0.2,1)',
                    overflow: 'hidden',
                    boxShadow: hovered ? `0 4px 24px ${cat.color}18` : 'none',
                }}
            >
                {/* Top section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 10px' }}>
                    {/* Category vertical accent */}
                    <div style={{
                        position: 'absolute', left: 0, top: 12, bottom: 12, width: 3,
                        borderRadius: '0 3px 3px 0',
                        background: cat.color,
                        opacity: hovered ? 1 : 0.6,
                        transition: 'opacity 0.2s',
                    }} />

                    {/* Icon */}
                    <div style={{
                        width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                        background: `linear-gradient(135deg, ${cat.color}25, ${cat.color}10)`,
                        border: `1px solid ${cat.color}30`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 20,
                        boxShadow: `0 2px 12px ${cat.color}20`,
                    }}>
                        {cat.icon}
                    </div>

                    {/* Name + amount */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{
                                fontSize: 14, fontWeight: 800, color: '#fff',
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                letterSpacing: -0.3,
                            }}>
                                {asset.name}
                            </span>
                            {tags.map((tag, i) => (
                                <span key={i} title={tag.title} style={{
                                    fontSize: 9, fontWeight: 700, padding: '2px 6px',
                                    borderRadius: 5, background: tag.bg, color: tag.color,
                                    letterSpacing: 0.3, flexShrink: 0,
                                }}>
                                    {tag.icon} {tag.label}
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                                {asset.amount.toLocaleString('tr-TR', { maximumFractionDigits: 6 })} adet
                            </span>
                            {asset.currentPrice && (
                                <span style={{
                                    fontSize: 9, color: '#22d3ee', fontWeight: 700,
                                    background: 'rgba(34,211,238,0.08)', padding: '1px 6px', borderRadius: 5,
                                    letterSpacing: 0.3,
                                }}>⚡ CANLI</span>
                            )}
                            <span style={{ fontSize: 11, color: `${cat.color}90`, fontWeight: 600 }}>
                                {cat.icon} {cat.labelTR}
                            </span>
                        </div>
                    </div>

                    {/* Right: Value */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>
                            {fmt(currentValueDisplay)}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                            birim: {fmt(convert(currentPriceTRY))}
                        </div>
                    </div>

                    {/* Chevron */}
                    <span style={{
                        fontSize: 11, color: 'rgba(255,255,255,0.25)',
                        transition: 'transform 0.2s',
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        flexShrink: 0,
                    }}>▼</span>
                </div>

                {/* Bottom section: P/L bar */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 16px 12px',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                }}>
                    {/* P/L badge */}
                    {pl !== null ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                                fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                                color: 'rgba(255,255,255,0.3)',
                            }}>
                                {PERIOD_LABELS[plPeriod]}
                            </span>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 10px', borderRadius: 8,
                                background: pl.isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                                border: `1px solid ${pl.isPositive ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                                fontSize: 12, fontWeight: 800,
                                color: pl.isPositive ? '#10b981' : '#ef4444',
                            }}>
                                {pl.isPositive ? '▲' : '▼'} {plPercentFormatted}
                            </span>
                            <span style={{
                                fontSize: 11, color: pl.isPositive ? 'rgba(16,185,129,0.7)' : 'rgba(239,68,68,0.7)',
                                fontWeight: 600,
                            }}>
                                {plValFormatted}
                            </span>
                        </div>
                    ) : (
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Geçmiş veri yok</div>
                    )}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        {onAnalyze && (
                            <button onClick={() => onAnalyze(asset)} title="AI Analiz" style={{
                                width: 30, height: 30, borderRadius: 8, fontSize: 13, cursor: 'pointer',
                                background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
                                color: '#a78bfa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}>🤖</button>
                        )}
                        <button onClick={() => onEdit(asset)} title="Düzenle" style={{
                            width: 30, height: 30, borderRadius: 8, fontSize: 13, cursor: 'pointer',
                            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                            color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}>✏️</button>
                        <button onClick={() => onSell(asset)} title="Sat/Çıkar" style={{
                            width: 30, height: 30, borderRadius: 8, fontSize: 13, cursor: 'pointer',
                            background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
                            color: '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.15s',
                        }}>💸</button>
                        <button
                            onClick={handleDelete} title="Sil"
                            style={{
                                width: 30, height: 30, borderRadius: 8, fontSize: 13, cursor: 'pointer',
                                background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)',
                                color: 'rgba(239,68,68,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.15s',
                            }}
                            onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.15)'; (e.currentTarget as HTMLElement).style.color = '#ef4444'; }}
                            onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(239,68,68,0.05)'; (e.currentTarget as HTMLElement).style.color = 'rgba(239,68,68,0.6)'; }}
                        >🗑</button>
                    </div>
                </div>
            </div>

            {/* Expandable Detail */}
            {expanded && (
                <div style={{
                    margin: '4px 2px 0', padding: '16px 20px',
                    background: `linear-gradient(135deg, ${cat.color}07, rgba(255,255,255,0.02))`,
                    borderRadius: '0 0 16px 16px',
                    border: `1px solid ${cat.color}20`,
                    borderTop: 'none',
                    display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '12px 20px', animation: 'fadeSlideIn 0.2s ease',
                }}>
                    <DetailItem label="Alış Fiyatı" value={fmt(convert(asset.purchasePrice))} />
                    <DetailItem label="Güncel Fiyat" value={fmt(convert(currentPriceTRY))} accent />
                    <DetailItem label="Birim K/Z" value={asset.purchasePrice > 0 ? fmt(convert(currentPriceTRY - asset.purchasePrice)) : '—'} isPositive={currentPriceTRY >= asset.purchasePrice} />
                    <DetailItem label="Toplam Maliyet" value={fmt(convert(costTRY))} />
                    <DetailItem label="Güncel Toplam" value={fmt(currentValueDisplay)} accent />
                    <DetailItem label="Toplam K/Z" value={pl ? `${pl.isPositive ? '+' : ''}${fmt(pl.valDisplay)}` : '—'} isPositive={pl?.isPositive ?? true} />
                    <DetailItem label="Alış Tarihi" value={new Date(asset.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' })} />
                    <DetailItem label="Para Birimi" value={asset.purchaseCurrency || 'TRY'} />
                    <DetailItem label="Kategori" value={`${cat.icon} ${cat.labelTR}`} />
                </div>
            )}

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-8px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}

function DetailItem({ label, value, accent, isPositive }: { label: string; value: string; accent?: boolean; isPositive?: boolean }) {
    let color = 'var(--text-primary)';
    if (isPositive === true) color = 'var(--accent-green)';
    if (isPositive === false) color = 'var(--accent-red)';
    if (accent) color = 'var(--accent-cyan)';
    return (
        <div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.3, marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>{value}</div>
        </div>
    );
}

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
    { key: 'value', label: 'Değer', icon: '💰' },
    { key: 'plPct', label: 'K/Z %', icon: '📊' },
    { key: 'plVal', label: 'K/Z ₺', icon: '💵' },
    { key: 'name', label: 'İsim', icon: '🔤' },
    { key: 'date', label: 'Tarih', icon: '📅' },
];

const PL_PERIODS: { key: PLPeriod; label: string }[] = [
    { key: '1d', label: 'Günlük' },
    { key: '1w', label: 'Haftalık' },
    { key: '1m', label: 'Aylık' },
    { key: 'all', label: 'Tümü' },
];

export default function AssetsTabsWidget({ widgetId, assets, onDelete, onEdit, onSell, onAnalyze }: AssetsTabsWidgetProps) {
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

    const fmtCurrency = (n: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

    return (
        <div>
            {/* ── Page Header ── */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 20, flexWrap: 'wrap', gap: 12,
            }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginBottom: 3, letterSpacing: -0.5 }}>
                        💼 Varlıklarım
                    </h2>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {assets.length} varlık · {categoriesWithAssets.length} kategori
                    </p>
                </div>

                {/* Search */}
                <div style={{ position: 'relative', minWidth: 220 }}>
                    <span style={{
                        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                        fontSize: 13, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
                    }}>🔍</span>
                    <input
                        type="text" placeholder="Varlık ara..."
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        style={{
                            width: '100%', padding: '9px 14px 9px 34px',
                            borderRadius: 10, border: '1px solid var(--border)',
                            background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                            fontSize: 12, outline: 'none', transition: 'border-color 0.2s', boxSizing: 'border-box',
                        }}
                        onFocus={e => e.target.style.borderColor = 'var(--accent-purple)'}
                        onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                </div>
            </div>

            {/* ── Category Tabs ── */}
            {categoriesWithAssets.length > 1 && (
                <div className="hide-scrollbar" style={{
                    display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 16,
                    background: 'var(--bg-elevated)', borderRadius: 12, padding: '5px',
                    border: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <button onClick={() => setActiveTab('all')} style={{
                        padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                        whiteSpace: 'nowrap', border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                        background: activeTab === 'all' ? 'rgba(255,255,255,0.12)' : 'transparent',
                        color: activeTab === 'all' ? '#fff' : 'rgba(255,255,255,0.4)',
                    }}>
                        Tümü <span style={{ opacity: 0.6, fontSize: 11 }}>({assets.length})</span>
                    </button>
                    {categoriesWithAssets.map(cat => (
                        <button key={cat.key} onClick={() => setActiveTab(cat.key)} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                            whiteSpace: 'nowrap', cursor: 'pointer', transition: 'all 0.15s',
                            background: activeTab === cat.key ? `${cat.color}22` : 'transparent',
                            color: activeTab === cat.key ? cat.color : 'rgba(255,255,255,0.4)',
                            border: activeTab === cat.key ? `1px solid ${cat.color}55` : '1px solid transparent',
                        }}>
                            {cat.icon} {cat.labelTR} <span style={{ opacity: 0.6, fontSize: 11 }}>({cat.count})</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ── Controls Row ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>K/Z Dönemi:</span>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                        {PL_PERIODS.map(p => (
                            <button key={p.key} onClick={() => setPLPeriod(p.key)} style={{
                                background: plPeriod === p.key ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' : 'transparent',
                                color: plPeriod === p.key ? '#fff' : 'var(--text-muted)',
                                border: 'none', padding: '4px 10px', fontSize: 10,
                                fontWeight: 700, borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                            }}>{p.label}</button>
                        ))}
                    </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Sırala:</span>
                    <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                        {SORT_OPTIONS.map(s => (
                            <button key={s.key} onClick={() => handleSortClick(s.key)} title={s.label} style={{
                                background: sortKey === s.key ? 'rgba(255,255,255,0.12)' : 'transparent',
                                color: sortKey === s.key ? '#fff' : 'var(--text-muted)',
                                border: 'none', padding: '4px 8px', fontSize: 10,
                                fontWeight: 700, borderRadius: 6, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}>
                                {s.icon} {s.label}{sortKey === s.key && <span style={{ marginLeft: 2, fontSize: 8 }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Category Summary Bar ── */}
            {filteredAndSortedAssets.length > 0 && (() => {
                const totalVal = filteredAndSortedAssets.reduce((s, a) => {
                    const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
                    return s + convert(a.amount * p);
                }, 0);
                const totalCostVal = filteredAndSortedAssets.reduce((s, a) => {
                    if (a.purchasePrice <= 0) return s;
                    return s + convert(getAssetCostInTRY(a.amount, a.purchasePrice, a.purchaseCurrency, exchangeRates));
                }, 0);
                const plVal = totalVal - totalCostVal;
                const plPctVal = totalCostVal > 0 ? ((totalVal - totalCostVal) / totalCostVal) * 100 : 0;
                const isUp = plVal >= 0;
                const catLabel = activeTab === 'all' ? 'Toplam Portföy' : categoriesWithAssets.find(c => c.key === activeTab)?.labelTR || '';
                return (
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '12px 16px', marginBottom: 12,
                        background: isUp ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
                        borderRadius: 12, border: `1px solid ${isUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                    }}>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
                            {catLabel}
                            <span style={{ color: 'var(--text-primary)', marginLeft: 8, fontWeight: 700 }}>{fmtCurrency(totalVal)}</span>
                        </div>
                        {totalCostVal > 0 && (
                            <span style={{
                                fontSize: 12, fontWeight: 800,
                                color: isUp ? '#10b981' : '#ef4444',
                                background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                padding: '3px 10px', borderRadius: 6,
                            }}>
                                {isUp ? '▲' : '▼'} {plPctVal >= 0 ? '+' : ''}{plPctVal.toFixed(1)}%
                                <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 6 }}>
                                    ({isUp ? '+' : ''}{fmtCurrency(plVal)})
                                </span>
                            </span>
                        )}
                    </div>
                );
            })()}

            {/* ── Asset Rows ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {filteredAndSortedAssets.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                        {searchQuery ? `"${searchQuery}" ile eşleşen varlık bulunamadı.` : 'Bu kategoride varlık yok.'}
                    </div>
                ) : (
                    filteredAndSortedAssets.map((asset) => (
                        <AssetRow
                            key={asset.id} asset={asset} plPeriod={plPeriod}
                            onDelete={onDelete} onEdit={onEdit} onSell={onSell} onAnalyze={onAnalyze}
                            expanded={expandedAssetId === asset.id}
                            onToggle={() => setExpandedAssetId(prev => prev === asset.id ? null : asset.id)}
                        />
                    ))
                )}
            </div>

            {filteredAndSortedAssets.length > 0 && (
                <div style={{
                    marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
                    display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)',
                }}>
                    <span>{filteredAndSortedAssets.length} varlık</span>
                    <span style={{ fontWeight: 600 }}>{SORT_OPTIONS.find(s => s.key === sortKey)?.label} {sortDir === 'desc' ? '↓' : '↑'}</span>
                </div>
            )}
        </div>
    );
}
