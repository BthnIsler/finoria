'use client';

import React, { useState } from 'react';
import { Asset, CATEGORIES, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

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
    const [expandedCat, setExpandedCat] = useState<string | null>(null);

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
    totals.forEach((t) => {
        t.percentage = grandTotal > 0 ? (t.total / grandTotal) * 100 : 0;
    });
    totals.sort((a, b) => b.total - a.total);

    if (totals.length === 0) return null;

    const getAssetPrice = (a: Asset) => a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;

    return (
        <div>
            <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>
                Kategori Dağılımı
            </h2>
            <div style={{ display: 'grid', gap: 8 }}>
                {totals.map((cat) => (
                    <div key={cat.key}>
                        {/* Category header — clickable */}
                        <div
                            className="glass-card"
                            style={{ padding: '14px 16px', cursor: 'pointer' }}
                            onClick={() => setExpandedCat(expandedCat === cat.key ? null : cat.key)}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                    <span style={{ fontSize: 20 }}>{cat.icon}</span>
                                    <div>
                                        <p style={{ fontSize: 13, fontWeight: 600 }}>{cat.label}</p>
                                        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{cat.count} varlık</p>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <p style={{ fontSize: 15, fontWeight: 700 }}>{formatCurrency(cat.total)}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>%{cat.percentage.toFixed(1)}</p>
                                </div>
                            </div>
                            {/* Progress bar */}
                            <div style={{ height: 3, background: 'var(--bg-primary)', borderRadius: 2, overflow: 'hidden', marginTop: 10 }}>
                                <div style={{ height: '100%', width: `${cat.percentage}%`, background: cat.color, borderRadius: 2, transition: 'width 0.5s ease' }} />
                            </div>
                            <div style={{ textAlign: 'right', marginTop: 4 }}>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    {expandedCat === cat.key ? '▲ Gizle' : '▼ Detay'}
                                </span>
                            </div>
                        </div>

                        {/* Expanded detail */}
                        {expandedCat === cat.key && (
                            <div style={{ marginTop: 4, marginLeft: 8, borderLeft: `2px solid ${cat.color}30`, paddingLeft: 12, paddingTop: 4, paddingBottom: 4 }}>
                                {cat.assets.map((asset) => {
                                    const price = getAssetPrice(asset);
                                    const value = asset.amount * price;
                                    const pl = asset.purchasePrice > 0
                                        ? ((price - asset.purchasePrice) / asset.purchasePrice) * 100
                                        : 0;
                                    return (
                                        <div
                                            key={asset.id}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                padding: '10px 12px', borderRadius: 10,
                                                background: 'var(--bg-card)', marginBottom: 4,
                                                fontSize: 13, transition: 'background 0.2s',
                                            }}
                                        >
                                            <div style={{ minWidth: 0 }}>
                                                <p style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</p>
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                    {asset.amount.toLocaleString('tr-TR')} adet · ₺{price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <p style={{ fontWeight: 600, fontSize: 13 }}>{formatCurrency(value)}</p>
                                                    {asset.purchasePrice > 0 && (
                                                        <span style={{
                                                            fontSize: 10, fontWeight: 600,
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
                                                            padding: '4px 10px', fontSize: 11, fontWeight: 600,
                                                            cursor: 'pointer', transition: 'all 0.2s',
                                                        }}
                                                        title="Çıkar / Sat"
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
                ))}
            </div>
        </div>
    );
}
