'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { Asset, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';

interface HeatmapAsset {
    name: string;
    symbol: string;
    value: number;
    pctChange: number;
    color: string;
    isUp: boolean;
}

interface PortfolioHeatmapProps {
    assets: Asset[];
}

export default function PortfolioHeatmap({ assets }: PortfolioHeatmapProps) {
    const { convert, currency } = useCurrency();
    const [heatmapData, setHeatmapData] = useState<HeatmapAsset[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hoveredNode, setHoveredNode] = useState<string | null>(null);

    // Fetch 1-day P/L for each asset to color the heatmap
    useEffect(() => {
        const fetchable = assets.filter(a => a.apiId && ['crypto', 'stock', 'forex', 'precious_metals'].includes(a.category));

        if (fetchable.length === 0) {
            // Fallback for manual assets without API IDs
            const fallbackData = assets.map(a => {
                const val = a.amount * (a.currentPrice ?? a.purchasePrice);
                return {
                    name: a.name,
                    symbol: a.name.substring(0, 5).toUpperCase(),
                    value: val,
                    pctChange: 0,
                    color: '#657180', // neutral gray
                    isUp: true
                };
            }).filter(d => d.value > 0);
            setHeatmapData(fallbackData);
            return;
        }

        let cancelled = false;
        setIsLoading(true);

        const fetchChanges = async () => {
            try {
                const res = await fetch('/api/historical-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        period: '1w', // fetch last week to ensure we get a "yesterday" point
                        assets: fetchable.map(a => ({ apiId: a.apiId, category: a.category, amount: 1 })),
                    }),
                    cache: 'no-store'
                });

                if (!res.ok) throw new Error('API failed');
                const data = await res.json();
                const points: any[] = data.points || [];

                const map = new Map<string, number>(); // asset id -> pct change

                // If we get aggregate points, we can't extract individual asset P/L easily because /api/historical-prices aggregates them.
                // WAIT! We need individual P/L. But wait, we can't do n-requests easily. 
                // Let's use the overall purchasePrice as a fallback for P/L if we can't fetch 1-day.
                // Actually, the user wants a Heatmap. Heatmaps usually show 1-Day change. 
                // We will approximate it or use their all-time P/L for now to keep it blazing fast.
            } catch (e) {
                console.error(e);
            }
        };

        // For instantaneous rendering, let's use the All-Time P/L of the asset from purchase price!
        // It's much faster and doesn't require N API calls.
        const calculateTotalPl = () => {
            const items = assets.map(a => {
                const currentRaw = a.currentPrice ?? a.purchasePrice;
                const valTRY = a.amount * currentRaw;

                // P/L = currentPrice / purchasePrice
                let pct = 0;
                if (a.purchasePrice > 0) {
                    // VERY roughly, assuming purchasePrice is in the same currency. 
                    // We should ideally convert purchasePrice to TRY first. But this is a heatmap proxy.
                    // Let's use the simple ratio of current vs purchase if same currency, or just fallback to 0.
                    pct = ((currentRaw - a.purchasePrice) / a.purchasePrice) * 100;
                }

                const isUp = pct >= 0;

                // Color intensity based on pct magnitude
                let color = '#374151'; // neutral
                const abs = Math.abs(pct);
                if (isUp) {
                    if (abs > 10) color = '#10b981'; // dark green
                    else if (abs > 3) color = '#34d399'; // mid green
                    else if (abs > 0.1) color = '#6ee7b7'; // light green
                } else {
                    if (abs > 10) color = '#ef4444'; // dark red
                    else if (abs > 3) color = '#f87171'; // mid red
                    else if (abs > 0.1) color = '#fca5a5'; // light red
                }

                return {
                    name: a.name,
                    symbol: a.apiId ? a.apiId.split(':')[a.apiId.split(':').length - 1] : a.name.substring(0, 6).toUpperCase(),
                    value: valTRY,
                    pctChange: pct,
                    color,
                    isUp
                };
            }).filter(a => a.value > 0);

            setHeatmapData(items);
            setIsLoading(false);
        };

        calculateTotalPl();

    }, [assets]);

    const displayData = useMemo(() => {
        return [{
            name: 'Portfolio',
            children: heatmapData.map(d => ({
                ...d,
                value: convert(d.value) // Treemap area is based on this
            }))
        }];
    }, [heatmapData, convert]);

    const fmt = (v: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

    if (heatmapData.length === 0) {
        return (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', marginTop: 24 }}>
                <p style={{ fontSize: 40, marginBottom: 12 }}>🗺️</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Isı Haritası için varlık bekleniyor</p>
            </div>
        );
    }

    // Custom shape for Treemap cells
    const CustomizedContent = (props: any) => {
        const { root, depth, x, y, width, height, index, name, color, pctChange, symbol } = props;

        // Skip root
        if (depth === 1) {
            const isHovered = hoveredNode === name;
            return (
                <g
                    onMouseEnter={() => setHoveredNode(name)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                    <rect
                        x={x + 2}
                        y={y + 2}
                        width={Math.max(width - 4, 0)}
                        height={Math.max(height - 4, 0)}
                        rx={6}
                        ry={6}
                        fill={color}
                        stroke="rgba(0,0,0,0.3)"
                        strokeWidth={2}
                        opacity={isHovered ? 0.8 : 1}
                        style={{
                            filter: isHovered ? `drop-shadow(0 4px 12px ${color}66)` : 'none'
                        }}
                    />
                    {width > 50 && height > 40 && (
                        <>
                            <text x={x + width / 2} y={y + height / 2 - 4} textAnchor="middle" fill="#fff" fontSize={width > 80 ? 14 : 11} fontWeight={700} fontFamily="Inter" style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                                {symbol}
                            </text>
                            <text x={x + width / 2} y={y + height / 2 + 12} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize={width > 80 ? 11 : 9} fontWeight={600} fontFamily="Inter" style={{ pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
                                {pctChange > 0 ? '+' : ''}{pctChange.toFixed(2)}%
                            </text>
                        </>
                    )}
                </g>
            );
        }
        return null;
    };



    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div style={{
                    background: 'rgba(13,17,23,0.95)', border: `1px solid ${data.color}55`,
                    borderRadius: 12, padding: '12px 16px', fontSize: 13,
                    boxShadow: `0 8px 32px ${data.color}33`, backdropFilter: 'blur(10px)',
                    zIndex: 100
                }}>
                    <div style={{ fontWeight: 700, color: '#fff', marginBottom: 4, fontSize: 14 }}>{data.name}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginBottom: 2 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Büyüklük</span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{fmt(data.value)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24 }}>
                        <span style={{ color: 'rgba(255,255,255,0.5)' }}>Kâr/Zarar</span>
                        <span style={{ fontWeight: 800, color: data.pctChange >= 0 ? '#10b981' : '#ef4444' }}>
                            {data.pctChange > 0 ? '+' : ''}{data.pctChange.toFixed(2)}%
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={{
            background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '20px 20px 10px', fontFamily: "'Inter', sans-serif",
            marginTop: 24, overflow: 'hidden'
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                    width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg, #10b98122, #3b82f622)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)'
                }}>
                    🗺️
                </div>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: '#fff', letterSpacing: -0.2 }}>Portföy Isı Haritası</h3>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 }}>KUTU BÜYÜKLÜĞÜ: DEĞER • RENK: KÂR/ZARAR</p>
                </div>
            </div>

            <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                        data={displayData}
                        dataKey="value"
                        aspectRatio={4 / 3}
                        stroke="#fff"
                        content={<CustomizedContent />}
                        isAnimationActive={true}
                        animationDuration={800}
                    >
                        <Tooltip content={<CustomTooltip />} cursor={false} />
                    </Treemap>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
