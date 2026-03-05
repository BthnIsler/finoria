'use client';

import React, { useState } from 'react';
import { Asset, CATEGORIES, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/contexts';

interface WealthChartProps {
    assets: Asset[];
}

export default function WealthChart({ assets }: WealthChartProps) {
    const { convert, currency, symbol } = useCurrency();
    const [filter, setFilter] = useState<'all' | AssetCategory>('all');
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    const fmt = (v: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

    // Build chart data
    const filteredAssets = filter === 'all' ? assets : assets.filter((a) => a.category === filter);

    const data = filter === 'all'
        ? // All categories — group by category
        CATEGORIES.map((cat) => {
            const catAssets = assets.filter((a) => a.category === cat.key);
            const total = catAssets.reduce((sum, a) => {
                const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
                return sum + a.amount * p;
            }, 0);
            return { id: cat.key, name: cat.labelTR, value: convert(total), color: cat.color, icon: cat.icon };
        }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value)
        : // Single category — group by individual asset
        filteredAssets.map((a, i) => {
            const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            const colors = ['#a78bfa', '#22d3ee', '#00e68a', '#f472b6', '#60a5fa', '#ffb347', '#ff4d6a', '#06b6d4'];
            return {
                id: a.id,
                name: a.name,
                value: convert(a.amount * p),
                color: colors[i % colors.length],
                icon: '',
            };
        }).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);

    // Categories that have assets (for filter chips)
    const activeCats = CATEGORIES.filter((c) => assets.some((a) => a.category === c.key));
    const totalValue = data.reduce((sum, d) => sum + d.value, 0);

    if (data.length === 0) {
        return (
            <div style={{ background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>📊</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Varlık ekledikçe dağılım burada görünecek</p>
            </div>
        );
    }

    return (
        <div style={{
            background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: 20, fontFamily: "'Inter', sans-serif"
        }}>
            {/* Header & Chips */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>
                    {filter === 'all' ? 'Portföy Dağılımı' : `${CATEGORIES.find((c) => c.key === filter)?.icon} ${CATEGORIES.find((c) => c.key === filter)?.labelTR}`}
                </h3>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24 }}>
                <button
                    onClick={() => setFilter('all')}
                    style={{
                        padding: '6px 12px', border: filter === 'all' ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,255,255,0.05)',
                        borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: filter === 'all' ? 'rgba(255,255,255,0.1)' : 'transparent',
                        color: filter === 'all' ? '#fff' : 'rgba(255,255,255,0.4)', transition: 'all 0.2s',
                    }}
                >
                    Tümü
                </button>
                {activeCats.map((cat) => (
                    <button
                        key={cat.key}
                        onClick={() => setFilter(filter === cat.key ? 'all' : cat.key)}
                        style={{
                            padding: '6px 12px', border: filter === cat.key ? `1px solid ${cat.color}55` : '1px solid rgba(255,255,255,0.05)',
                            borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            background: filter === cat.key ? `${cat.color}15` : 'transparent',
                            color: filter === cat.key ? cat.color : 'rgba(255,255,255,0.4)', transition: 'all 0.2s',
                        }}
                    >
                        {cat.icon} {cat.labelTR}
                    </button>
                ))}
            </div>

            {/* Linear Progress Bar */}
            <div style={{
                height: 24, width: '100%', display: 'flex', borderRadius: 6, overflow: 'hidden', gap: 2,
                background: 'rgba(255,255,255,0.02)', marginBottom: 24,
            }}>
                {data.map((d, i) => {
                    const pct = (d.value / totalValue) * 100;
                    return (
                        <div
                            key={d.id}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{
                                width: `${pct}%`, height: '100%', background: d.color,
                                opacity: hoveredIndex === null || hoveredIndex === i ? 1 : 0.3,
                                transition: 'opacity 0.2s, width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                                cursor: 'pointer', position: 'relative',
                            }}
                        />
                    );
                })}
            </div>

            {/* Legend / Details List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {data.map((d, i) => {
                    const pct = (d.value / totalValue) * 100;
                    const isHovered = hoveredIndex === i;
                    return (
                        <div
                            key={d.id}
                            onMouseEnter={() => setHoveredIndex(i)}
                            onMouseLeave={() => setHoveredIndex(null)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '8px 12px', borderRadius: 8,
                                background: isHovered ? 'rgba(255,255,255,0.03)' : 'transparent',
                                transition: 'background 0.2s', cursor: 'default',
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 10, height: 10, borderRadius: 3, background: d.color }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: isHovered ? '#fff' : 'rgba(255,255,255,0.7)', transition: 'color 0.2s' }}>
                                    {d.icon} {d.name}
                                </span>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                                    {fmt(d.value)}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                                    %{pct.toFixed(1)}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

