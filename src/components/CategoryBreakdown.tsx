'use client';

import React, { useState } from 'react';
import { Asset, CATEGORIES, AssetCategory } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY } from '@/lib/utils';

interface CategoryBreakdownProps {
    assets: Asset[];
    onSell?: (asset: Asset) => void;
}

interface CategoryTotal {
    key: AssetCategory;
    label: string;
    icon: string;
    color: string;
    total: number;
    count: number;
    percentage: number;
    assets: Asset[];
}

export default function CategoryBreakdown({ assets, onSell }: CategoryBreakdownProps) {
    const [selectedCat, setSelectedCat] = useState<string | null>(null);
    const { currency, convert, symbol, exchangeRates } = useCurrency();

    const totals: CategoryTotal[] = CATEGORIES.map((cat) => {
        const categoryAssets = assets.filter((a) => a.category === cat.key);
        const total = categoryAssets.reduce((sum, a) => {
            const price = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            return sum + a.amount * price;
        }, 0);
        return {
            key: cat.key,
            label: cat.labelTR,
            icon: cat.icon,
            color: cat.color,
            total,
            count: categoryAssets.length,
            percentage: 0,
            assets: categoryAssets,
        };
    }).filter((t) => t.count > 0);

    const grandTotal = totals.reduce((sum, t) => sum + t.total, 0);
    totals.forEach((t) => { t.percentage = grandTotal > 0 ? (t.total / grandTotal) * 100 : 0; });
    totals.sort((a, b) => b.total - a.total);

    if (totals.length === 0) return null;

    const getAssetPrice = (a: Asset) => a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;

    const fmt = (n: number) =>
        new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(convert(n));

    const selectedCatData = totals.find(t => t.key === selectedCat) || null;

    return (
        <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
                Kategori Dağılımı
            </h2>

            {/* Split panel container */}
            <div style={{
                display: 'flex',
                gap: 0,
                borderRadius: 14,
                overflow: 'hidden',
                border: '1px solid var(--border)',
                minHeight: 120,
            }}>
                {/* Left: category list */}
                <div style={{
                    width: selectedCat ? '42%' : '100%',
                    transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1)',
                    borderRight: selectedCat ? '1px solid var(--border)' : 'none',
                    flexShrink: 0,
                }}>
                    {totals.map((cat) => {
                        const isSelected = selectedCat === cat.key;
                        return (
                            <button
                                key={cat.key}
                                onClick={() => setSelectedCat(isSelected ? null : cat.key)}
                                style={{
                                    width: '100%',
                                    display: 'flex', alignItems: 'center', gap: 10,
                                    padding: '12px 14px',
                                    background: isSelected ? `${cat.color}10` : 'transparent',
                                    border: 'none',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'background 0.15s',
                                    textAlign: 'left',
                                }}
                                onMouseOver={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-elevated)'; }}
                                onMouseOut={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                            >
                                {/* Icon */}
                                <div style={{
                                    width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                                    background: `${cat.color}15`, border: `1px solid ${cat.color}25`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                                }}>
                                    {cat.icon}
                                </div>

                                {/* Label + count */}
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <p style={{
                                        fontSize: 13, fontWeight: 600,
                                        color: isSelected ? cat.color : 'var(--text-primary)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {cat.label}
                                    </p>
                                    {!selectedCat && (
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.count} varlık</p>
                                    )}
                                </div>

                                {/* Value + percentage (hidden when panel is open to save space) */}
                                {!selectedCat && (
                                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                        <p style={{ fontSize: 13, fontWeight: 700 }}>{fmt(cat.total)}</p>
                                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>%{cat.percentage.toFixed(1)}</p>
                                    </div>
                                )}

                                {/* Progress bar — only show when full width */}
                                {!selectedCat && (
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0, left: 0,
                                        height: 2,
                                        width: `${cat.percentage}%`,
                                        background: cat.color,
                                        borderRadius: 2,
                                    }} />
                                )}

                                {/* Arrow */}
                                <span style={{
                                    fontSize: 12, flexShrink: 0,
                                    color: isSelected ? cat.color : 'var(--text-muted)',
                                    opacity: isSelected ? 1 : 0.4,
                                    transition: 'opacity 0.2s, transform 0.2s',
                                    transform: isSelected ? 'translateX(0)' : 'translateX(-4px)',
                                }}>›</span>
                            </button>
                        );
                    })}
                </div>

                {/* Right: detail panel — slides in */}
                <div style={{
                    flex: 1,
                    overflow: 'hidden',
                    opacity: selectedCat ? 1 : 0,
                    transform: selectedCat ? 'translateX(0)' : 'translateX(16px)',
                    transition: 'opacity 0.3s ease, transform 0.35s cubic-bezier(0.4,0,0.2,1)',
                    pointerEvents: selectedCat ? 'auto' : 'none',
                }}>
                    {selectedCatData && (
                        <div style={{ padding: '10px 12px', overflowY: 'auto', height: '100%' }}>
                            {/* Panel header */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                <span style={{ fontSize: 18 }}>{selectedCatData.icon}</span>
                                <div>
                                    <p style={{ fontSize: 13, fontWeight: 700, color: selectedCatData.color }}>{selectedCatData.label}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                        {fmt(selectedCatData.total)} · %{selectedCatData.percentage.toFixed(1)}
                                    </p>
                                </div>
                            </div>
                            <div style={{ height: 1, background: 'var(--border)', marginBottom: 8 }} />

                            {/* Asset rows */}
                            {selectedCatData.assets.map((asset) => {
                                const price = getAssetPrice(asset);
                                const valueTRY = asset.amount * price;
                                const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
                                const pl = costTRY > 0 ? ((valueTRY - costTRY) / costTRY) * 100 : 0;
                                return (
                                    <div
                                        key={asset.id}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '8px 10px', borderRadius: 10, marginBottom: 4,
                                            background: 'var(--bg-elevated)', fontSize: 12,
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <p style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {asset.name}
                                            </p>
                                            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                                                {asset.amount.toLocaleString('tr-TR')} adet
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            <div style={{ textAlign: 'right' }}>
                                                <p style={{ fontWeight: 700 }}>{fmt(valueTRY)}</p>
                                                {asset.purchasePrice > 0 && (
                                                    <span style={{
                                                        fontSize: 10, fontWeight: 600, display: 'block', marginTop: 1,
                                                        color: pl >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                                    }}>
                                                        {pl >= 0 ? '+' : ''}{pl.toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                            {onSell && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onSell(asset); }}
                                                    style={{
                                                        background: 'rgba(255,77,106,0.1)', color: 'var(--accent-red)',
                                                        border: '1px solid rgba(255,77,106,0.2)', borderRadius: 8,
                                                        padding: '3px 8px', fontSize: 10, fontWeight: 600,
                                                        cursor: 'pointer',
                                                    }}
                                                >
                                                    Çıkar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
