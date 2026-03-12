'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Asset, CATEGORIES, AssetCategory } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

interface WealthChartProps {
    assets: Asset[];
    isMobile?: boolean;
}

export default function WealthChart({ assets, isMobile = false }: WealthChartProps) {
    const [filter, setFilter] = useState<'all' | AssetCategory>('all');
    const [activeIndex, setActiveIndex] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(0);

    useLayoutEffect(() => {
        const measure = () => {
            if (containerRef.current) {
                const w = containerRef.current.offsetWidth;
                if (w > 0) setChartWidth(w);
            }
        };
        measure();
        // Fallback poll for Capacitor WebView
        const t1 = setTimeout(measure, 100);
        const t2 = setTimeout(measure, 400);
        const t3 = setTimeout(measure, 800);
        let ro: ResizeObserver | null = null;
        try {
            ro = new ResizeObserver(measure);
            if (containerRef.current) ro.observe(containerRef.current);
        } catch {}
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); ro?.disconnect(); };
    }, []);

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
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>{d.icon} {d.name}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>Değer</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatCurrency(d.value)}</span>
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

    const total = data.reduce((s, d) => s + d.value, 0);

    // Custom label renderer - external labels matching reference image 3
    const renderLabel = ({ cx, cy, midAngle, outerRadius, percent, name, color }: any) => {
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 28;
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);
        if (percent < 0.04) return null; // skip tiny slices
        return (
            <text
                x={x} y={y}
                fill={color}
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={10} fontWeight={700}
            >
                {name.split(' ')[0]} {(percent * 100).toFixed(0)}%
            </text>
        );
    };

    return (
        <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', height: '100%' }}>
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

            <div ref={containerRef} style={{ width: '100%', height: isMobile ? 220 : 260 }}>
                {chartWidth > 0 && (
                    <PieChart width={chartWidth} height={isMobile ? 220 : 260}>
                        <Pie
                            data={data} cx="50%" cy="50%"
                            innerRadius={isMobile ? 55 : 70} outerRadius={isMobile ? 85 : 110}
                            paddingAngle={4} dataKey="value" stroke="none"
                            animationBegin={0} animationDuration={600}
                            onMouseEnter={(_, index) => setActiveIndex(index)}
                            onMouseLeave={() => setActiveIndex(null)}
                            {...(!isMobile && {
                                label: renderLabel,
                                labelLine: { stroke: 'rgba(255,255,255,0.12)', strokeWidth: 1 },
                            })}
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
                )}
            </div>

            {/* Category rows table - matching reference image 3 */}
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {data.map(d => {
                    const pct = total > 0 ? (d.value / total) * 100 : 0;
                    return (
                        <div key={d.name} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.025)',
                            border: '1px solid rgba(255,255,255,0.05)',
                        }}>
                            <div style={{
                                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                                background: `${d.color}22`, border: `1px solid ${d.color}44`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 14,
                            }}>{d.icon || '●'}</div>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>{d.name}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: d.color }}>{pct.toFixed(1)}%</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
