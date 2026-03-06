'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Asset, CATEGORIES, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY, formatPercentage } from '@/lib/utils';
import { deleteAsset } from '@/lib/db';
import { getAssetPriceAtDate } from '@/lib/storage';
import WidgetWrapper from '@/components/WidgetWrapper';

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

// ── Smart Tag Logic ──
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

    // Diamond Hands: held for > 1 year
    const ageMs = Date.now() - new Date(asset.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    if (ageDays > 365) {
        tags.push({
            label: 'Elmas', icon: '💎', color: '#22d3ee',
            bg: 'rgba(34,211,238,0.1)', title: '1 yıldan uzun süredir portföyde',
        });
    }

    // Use normalized TRY cost to compare properly (handles USD/EUR purchase currencies)
    if (currentPriceTRY > 0 && asset.purchasePrice > 0) {
        const unitCostTRY = getAssetCostInTRY(1, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
        if (unitCostTRY > 0) {
            const pctChange = ((currentPriceTRY - unitCostTRY) / unitCostTRY) * 100;
            if (pctChange > 100) {
                tags.push({
                    label: 'Rekor', icon: '🔥', color: '#f59e0b',
                    bg: 'rgba(245,158,11,0.1)', title: 'Alış fiyatından %100+ yukarıda',
                });
            }
            if (pctChange < -30) {
                tags.push({
                    label: 'Dip', icon: '📉', color: '#ef4444',
                    bg: 'rgba(239,68,68,0.1)', title: 'Alış fiyatından %30+ aşağıda',
                });
            }
        }
    }

    return tags;
}

// ── Compute P/L for an asset ──
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
    const { currency, convert, exchangeRates, symbol } = useCurrency();
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

    return (
        <div style={{ position: 'relative' }}>
            <div
                onClick={onToggle}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px 10px 0',
                    borderRadius: 12,
                    transition: 'background 0.15s',
                    background: hovered ? 'var(--bg-elevated)' : 'transparent',
                    cursor: 'pointer',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Category color stripe */}
                <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, borderRadius: '3px 0 0 3px',
                    background: cat.color,
                    opacity: hovered ? 1 : 0.4,
                    transition: 'opacity 0.2s',
                }} />

                {/* Icon */}
                <div style={{
                    width: 34, height: 34, borderRadius: 9,
                    background: `${cat.color}18`,
                    border: `1px solid ${cat.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, flexShrink: 0, marginLeft: 10,
                }}>
                    {cat.icon}
                </div>

                {/* Name + amount + smart tags */}
                <div style={{ minWidth: 0, flex: '1 1 120px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>
                            {asset.name}
                        </p>
                        {/* Smart Tags */}
                        {tags.map((tag, i) => (
                            <span key={i} title={tag.title} style={{
                                fontSize: 9, fontWeight: 700, padding: '1px 5px',
                                borderRadius: 4, background: tag.bg, color: tag.color,
                                letterSpacing: 0.3, flexShrink: 0,
                            }}>
                                {tag.icon} {tag.label}
                            </span>
                        ))}
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1, margin: 0 }}>
                        {asset.amount} adet
                        {asset.currentPrice && (
                            <span style={{
                                marginLeft: 6, fontSize: 10, color: 'var(--accent-cyan)',
                                background: 'rgba(34,211,238,0.08)',
                                padding: '1px 6px', borderRadius: 6,
                            }}>● canlı</span>
                        )}
                    </p>
                </div>

                {/* Value + P/L (both % and ₺) */}
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>{fmt(currentValueDisplay)}</p>
                    {pl !== null && (
                        <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                            <span style={{
                                fontSize: 11, fontWeight: 700,
                                color: pl.isPositive ? 'var(--accent-green)' : 'var(--accent-red)',
                            }}>
                                {pl.isPositive ? '▲' : '▼'} {formatPercentage(pl.pct)}
                            </span>
                            <span style={{
                                fontSize: 10, fontWeight: 600,
                                color: pl.isPositive ? 'var(--accent-green)' : 'var(--accent-red)',
                                opacity: 0.7,
                            }}>
                                ({pl.isPositive ? '+' : ''}{fmt(pl.valDisplay)})
                            </span>
                            {pl.label && (
                                <span title="Bu dönem için yeterli veri yok" style={{ fontSize: 9, opacity: 0.5 }}>
                                    ({pl.label})
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    {onAnalyze && (
                        <button onClick={() => onAnalyze(asset)} className="btn-icon" title="AI Analiz" style={{ width: 28, height: 28, fontSize: 12 }}>🤖</button>
                    )}
                    <button onClick={() => onEdit(asset)} className="btn-icon" title="Düzenle" style={{ width: 28, height: 28, fontSize: 12 }}>✏️</button>
                    <button onClick={() => onSell(asset)} className="btn-icon" title="Sat/Çıkar" style={{ width: 28, height: 28, fontSize: 12 }}>💸</button>
                    <button
                        onClick={handleDelete} className="btn-icon" title="Sil"
                        style={{ width: 28, height: 28, fontSize: 12 }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                    >🗑</button>
                </div>

                {/* Expand chevron */}
                <span style={{
                    fontSize: 12, color: 'var(--text-muted)', transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0,
                }}>▼</span>
            </div>

            {/* ── Expandable Detail ── */}
            {expanded && (
                <div style={{
                    margin: '0 14px 8px 47px',
                    padding: '12px 16px',
                    background: 'var(--bg-elevated)',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    fontSize: 12,
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr',
                    gap: '10px 20px',
                    animation: 'fadeSlideIn 0.2s ease',
                }}>
                    <DetailItem label="Alış Fiyatı" value={fmt(convert(asset.purchasePrice))} />
                    <DetailItem label="Güncel Fiyat" value={fmt(convert(currentPriceTRY))} accent />
                    <DetailItem label="Birim Kâr/Zarar" value={
                        asset.purchasePrice > 0
                            ? fmt(convert(currentPriceTRY - asset.purchasePrice))
                            : '—'
                    } isPositive={currentPriceTRY >= asset.purchasePrice} />
                    <DetailItem label="Toplam Maliyet" value={fmt(convert(costTRY))} />
                    <DetailItem label="Güncel Toplam" value={fmt(currentValueDisplay)} accent />
                    <DetailItem label="Toplam Kâr/Zarar" value={
                        pl ? `${pl.isPositive ? '+' : ''}${fmt(pl.valDisplay)}` : '—'
                    } isPositive={pl?.isPositive ?? true} />
                    <DetailItem label="Alış Tarihi" value={new Date(asset.createdAt).toLocaleDateString('tr-TR', { year: 'numeric', month: 'short', day: 'numeric' })} />
                    <DetailItem label="Para Birimi" value={asset.purchaseCurrency || 'TRY'} />
                    <DetailItem label="Kategori" value={`${cat.icon} ${cat.labelTR}`} />
                </div>
            )}

            <style>{`
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(-6px); }
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
            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.3, marginBottom: 2 }}>
                {label}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color }}>
                {value}
            </div>
        </div>
    );
}

// ── Sort Configs ──
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

// ── Main Widget ──
export default function AssetsTabsWidget({
    widgetId,
    assets,
    onDelete,
    onEdit,
    onSell,
    onAnalyze
}: AssetsTabsWidgetProps) {
    const [isOpen, setIsOpen] = useState(false);
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
        return CATEGORIES.filter(c => counts.has(c.key)).map(c => ({
            ...c,
            count: counts.get(c.key) || 0,
        }));
    }, [assets]);

    const filteredAndSortedAssets = useMemo(() => {
        let list = assets;

        // Filter by category
        if (activeTab !== 'all') {
            list = list.filter(a => a.category === activeTab);
        }

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter(a =>
                a.name.toLowerCase().includes(q) ||
                getCategoryMeta(a.category).labelTR.toLowerCase().includes(q)
            );
        }

        // Sort
        const sorted = [...list].sort((a, b) => {
            let cmp = 0;
            const priceA = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            const priceB = b.currentPrice ?? b.manualCurrentPrice ?? b.purchasePrice;
            const valA = a.amount * priceA;
            const valB = b.amount * priceB;

            switch (sortKey) {
                case 'value':
                    cmp = valA - valB;
                    break;
                case 'plPct': {
                    const plA = computePL(a, plPeriod, exchangeRates, convert);
                    const plB = computePL(b, plPeriod, exchangeRates, convert);
                    cmp = (plA?.pct ?? 0) - (plB?.pct ?? 0);
                    break;
                }
                case 'plVal': {
                    const plA = computePL(a, plPeriod, exchangeRates, convert);
                    const plB = computePL(b, plPeriod, exchangeRates, convert);
                    cmp = (plA?.valDisplay ?? 0) - (plB?.valDisplay ?? 0);
                    break;
                }
                case 'name':
                    cmp = a.name.localeCompare(b.name, 'tr');
                    break;
                case 'date':
                    cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    break;
            }
            return sortDir === 'desc' ? -cmp : cmp;
        });

        return sorted;
    }, [assets, activeTab, searchQuery, sortKey, sortDir, plPeriod, exchangeRates, convert]);

    const handleSortClick = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(d => d === 'desc' ? 'asc' : 'desc');
        } else {
            setSortKey(key);
            setSortDir('desc');
        }
    };

    return (
        <WidgetWrapper widgetId={widgetId}>
            <div>
                {/* ──── Clickable header (always visible) ──── */}
                <button
                    onClick={() => setIsOpen(o => !o)}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(34,211,238,0.1))',
                            border: '1px solid rgba(167,139,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16,
                        }}>
                            💼
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                                Varlıklarım
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {assets.length} varlık
                            </span>
                        </div>
                    </div>

                    <span style={{
                        fontSize: 18,
                        color: 'var(--text-muted)',
                        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        ⌄
                    </span>
                </button>

                {/* ──── Collapsible body ──── */}
                <div style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? '4000px' : '0px',
                    transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
                    opacity: isOpen ? 1 : 0,
                    transitionProperty: 'max-height, opacity',
                }}>
                    <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 10px' }} />

                    {/* ── Search Bar ── */}
                    <div style={{ marginBottom: 10 }}>
                        <input
                            type="text"
                            placeholder="🔍 Varlık ara..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            style={{
                                width: '100%', padding: '8px 14px',
                                borderRadius: 10, border: '1px solid var(--border)',
                                background: 'var(--bg-elevated)', color: 'var(--text-primary)',
                                fontSize: 12, outline: 'none',
                                transition: 'border-color 0.2s',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent-purple)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    {/* ── Controls Row: P/L Period + Sort ── */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        gap: 8, marginBottom: 10, flexWrap: 'wrap',
                    }}>
                        {/* P/L Period */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                📊 K/Z:
                            </span>
                            <div style={{
                                display: 'flex', gap: 2,
                                background: 'var(--bg-elevated)', borderRadius: 8, padding: 2,
                            }}>
                                {PL_PERIODS.map(p => (
                                    <button
                                        key={p.key}
                                        onClick={() => setPLPeriod(p.key)}
                                        style={{
                                            background: plPeriod === p.key
                                                ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))'
                                                : 'transparent',
                                            color: plPeriod === p.key ? '#fff' : 'var(--text-muted)',
                                            border: 'none', padding: '4px 10px', fontSize: 10,
                                            fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                                            transition: 'all 0.2s', whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Sort */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                Sırala:
                            </span>
                            <div style={{
                                display: 'flex', gap: 2,
                                background: 'var(--bg-elevated)', borderRadius: 8, padding: 2,
                            }}>
                                {SORT_OPTIONS.map(s => (
                                    <button
                                        key={s.key}
                                        onClick={() => handleSortClick(s.key)}
                                        title={s.label}
                                        style={{
                                            background: sortKey === s.key
                                                ? 'rgba(255,255,255,0.12)'
                                                : 'transparent',
                                            color: sortKey === s.key ? '#fff' : 'var(--text-muted)',
                                            border: 'none', padding: '4px 8px', fontSize: 10,
                                            fontWeight: 700, borderRadius: 6, cursor: 'pointer',
                                            transition: 'all 0.15s', whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {s.icon} {s.label}
                                        {sortKey === s.key && (
                                            <span style={{ marginLeft: 2, fontSize: 8 }}>
                                                {sortDir === 'desc' ? '↓' : '↑'}
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Category tabs */}
                    {categoriesWithAssets.length > 1 && (
                        <div
                            className="hide-scrollbar"
                            style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}
                        >
                            <button
                                onClick={() => setActiveTab('all')}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    background: activeTab === 'all' ? 'var(--text-primary)' : 'var(--bg-elevated)',
                                    color: activeTab === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    border: '1px solid', borderColor: activeTab === 'all' ? 'transparent' : 'var(--border)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                Tümü ({assets.length})
                            </button>
                            {categoriesWithAssets.map(cat => (
                                <button
                                    key={cat.key}
                                    onClick={() => setActiveTab(cat.key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        background: activeTab === cat.key ? `${cat.color}18` : 'var(--bg-elevated)',
                                        color: activeTab === cat.key ? cat.color : 'var(--text-secondary)',
                                        border: '1px solid', borderColor: activeTab === cat.key ? cat.color : 'var(--border)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {cat.icon} {cat.labelTR} ({cat.count})
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Category Summary Strip ── */}
                    {filteredAndSortedAssets.length > 0 && (() => {
                        const catAssets = filteredAndSortedAssets;
                        const totalVal = catAssets.reduce((s, a) => {
                            const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
                            return s + convert(a.amount * p);
                        }, 0);
                        const totalCostVal = catAssets.reduce((s, a) => {
                            if (a.purchasePrice <= 0) return s;
                            const costTRY = getAssetCostInTRY(a.amount, a.purchasePrice, a.purchaseCurrency, exchangeRates);
                            return s + convert(costTRY);
                        }, 0);
                        const plVal = totalVal - totalCostVal;
                        const plPctVal = totalCostVal > 0 ? ((totalVal - totalCostVal) / totalCostVal) * 100 : 0;
                        const isUp = plVal >= 0;
                        const catLabel = activeTab === 'all' ? 'Toplam Portföy' : getCategoryMeta(activeTab as any)?.labelTR || '';

                        return (
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 14px', marginBottom: 8,
                                background: 'var(--bg-elevated)',
                                borderRadius: 10, border: '1px solid var(--border)',
                            }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                                    {catLabel} Değeri
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                                        {new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(totalVal)}
                                    </span>
                                    {totalCostVal > 0 && (
                                        <span style={{
                                            fontSize: 11, fontWeight: 700,
                                            color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                                            background: isUp ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                                            padding: '2px 8px', borderRadius: 6,
                                        }}>
                                            {isUp ? '▲' : '▼'} {plPctVal >= 0 ? '+' : ''}{plPctVal.toFixed(1)}%
                                            ({isUp ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(plVal)})
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })()}

                    {/* Asset rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredAndSortedAssets.length === 0 ? (
                            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                                {searchQuery ? `"${searchQuery}" ile eşleşen varlık bulunamadı.` : 'Henüz varlık yok.'}
                            </div>
                        ) : (
                            filteredAndSortedAssets.map((asset) => (
                                <AssetRow
                                    key={asset.id}
                                    asset={asset}
                                    plPeriod={plPeriod}
                                    onDelete={onDelete}
                                    onEdit={onEdit}
                                    onSell={onSell}
                                    onAnalyze={onAnalyze}
                                    expanded={expandedAssetId === asset.id}
                                    onToggle={() => setExpandedAssetId(prev => prev === asset.id ? null : asset.id)}
                                />
                            ))
                        )}
                    </div>

                    {/* Summary footer */}
                    {filteredAndSortedAssets.length > 0 && (
                        <div style={{
                            marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)',
                            display: 'flex', justifyContent: 'space-between', fontSize: 11,
                            color: 'var(--text-muted)',
                        }}>
                            <span>{filteredAndSortedAssets.length} varlık gösteriliyor</span>
                            <span style={{ fontWeight: 600 }}>
                                Sıralama: {SORT_OPTIONS.find(s => s.key === sortKey)?.label} {sortDir === 'desc' ? '↓' : '↑'}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </WidgetWrapper>
    );
}
