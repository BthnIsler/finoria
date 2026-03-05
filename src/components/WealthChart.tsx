'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Asset, CATEGORIES, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface WealthChartProps {
    assets: Asset[];
}

export default function WealthChart({ assets }: WealthChartProps) {
    const [filter, setFilter] = useState<'all' | AssetCategory>('all');
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

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
            return { name: cat.labelTR, value: total, color: cat.color, icon: cat.icon };
        }).filter((d) => d.value > 0)
        : // Single category — group by individual asset
        filteredAssets.map((a, i) => {
            const p = a.currentPrice ?? a.manualCurrentPrice ?? a.purchasePrice;
            const colors = ['#a78bfa', '#22d3ee', '#00e68a', '#f472b6', '#60a5fa', '#ffb347', '#ff4d6a', '#06b6d4'];
            return {
                name: a.name,
                value: a.amount * p,
                color: colors[i % colors.length],
                icon: '',
            };
        }).filter((d) => d.value > 0);

    // Categories that have assets (for filter chips)
    const activeCats = CATEGORIES.filter((c) => assets.some((a) => a.category === c.key));

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0].payload;
            const total = data.reduce((s, x) => s + x.value, 0);
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
            return (
                <div style={{
                    background: 'rgba(13,17,23,0.95)', border: `1px solid ${d.color}44`,
                    borderRadius: 12, padding: '14px 18px', fontSize: 13,
                    boxShadow: `0 8px 32px ${d.color}33`, backdropFilter: 'blur(10px)',
                    minWidth: 160
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, boxShadow: `0 0 10px ${d.color}` }} />
                        <span style={{ fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>{d.icon} {d.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Değer</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{formatCurrency(d.value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Oran</span>
                        <span style={{ fontWeight: 800, color: d.color, fontSize: 16 }}>%{pct}</span>
                    </div>
                </div>
            );
        }
        return null;
    };


    if (data.length === 0) {
        return (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 48, marginBottom: 12 }}>📊</p>
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Varlık ekledikçe grafikler burada görünecek</p>
            </div>
        );
    }

    return (
        <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {filter === 'all' ? 'Portföy Dağılımı' : `${CATEGORIES.find((c) => c.key === filter)?.icon} ${CATEGORIES.find((c) => c.key === filter)?.labelTR}`}
                </h3>
            </div>

            {/* Category filter chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
                <button
                    className={`chip ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                    style={{ fontSize: 11, padding: '5px 12px' }}
                >
                    Tümü
                </button>
                {activeCats.map((cat) => (
                    <button
                        key={cat.key}
                        className={`chip ${filter === cat.key ? 'active' : ''}`}
                        onClick={() => setFilter(filter === cat.key ? 'all' : cat.key)}
                        style={{ fontSize: 11, padding: '5px 12px' }}
                    >
                        {cat.icon} {cat.labelTR}
                    </button>
                ))}
            </div>

            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie
                        data={data} cx="50%" cy="50%"
                        innerRadius={65} outerRadius={100}
                        paddingAngle={4} dataKey="value" stroke="none"
                        animationBegin={0} animationDuration={600}
                        onMouseEnter={(_, index) => setActiveIndex(index)}
                        onMouseLeave={() => setActiveIndex(null)}
                    >
                        {data.map((entry, i) => {
                            const isHovered = activeIndex === i;
                            const isDimmed = activeIndex !== null && activeIndex !== i;
                            return (
                                <Cell
                                    key={`cell-${i}`}
                                    fill={entry.color}
                                    opacity={isDimmed ? 0.25 : 1}
                                    style={{
                                        filter: isHovered ? `drop-shadow(0px 0px 10px ${entry.color}aa)` : 'none',
                                        transition: 'all 0.3s ease',
                                        cursor: 'pointer',
                                        outline: 'none',
                                        transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                                        transformOrigin: 'center'
                                    }}
                                />
                            );
                        })}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                </PieChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', marginTop: 8 }}>
                {data.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{d.icon} {d.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
