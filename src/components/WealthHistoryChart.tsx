'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
    ComposedChart, Bar, Cell, Line, ReferenceLine,
} from 'recharts';
import { WealthSnapshot, getHourlyHistory, HourlySnapshot } from '@/lib/storage';
import { Asset } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';

type TimePeriod = '1d' | '1m' | 'all';

interface WealthHistoryChartProps {
    history: WealthSnapshot[];
    currentTotal: number;
    assets?: Asset[];
    totalPLPct?: number;
    totalCost?: number;
}

interface ChartPoint {
    label: string;
    date?: string;
    value?: number;
    open?: number;
    close?: number;
    high?: number;
    low?: number;
    pastValue?: number;
    currentValue?: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
    try {
        return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
}
function fmtTime(isoStr: string) {
    try {
        return new Date(isoStr).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch { return isoStr; }
}
function fmtY(v: number) {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 10_000) return `${(v / 1_000).toFixed(0)}K`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
}

function filterByPeriod(data: ChartPoint[], period: TimePeriod): ChartPoint[] {
    // We handle grouping inside the build functions now.
    // If we wanted to cut off old data based on period, we can still do that.
    return data;
}

function buildDailyData(history: WealthSnapshot[], currentTotal: number, period: TimePeriod): ChartPoint[] {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Ensure today's current total is in history
    const historyPlusToday = [...history];
    const last = historyPlusToday[historyPlusToday.length - 1];
    if (last?.date === todayStr) {
        last.total = currentTotal;
    } else {
        historyPlusToday.push({ date: todayStr, total: currentTotal, breakdown: {} });
    }

    if (period === '1m') {
        // Group by Month (1A) - one point per month
        const grouped = new Map<string, WealthSnapshot[]>();
        for (const h of historyPlusToday) {
            const monthKey = h.date.substring(0, 7); // YYYY-MM
            if (!grouped.has(monthKey)) grouped.set(monthKey, []);
            grouped.get(monthKey)!.push(h);
        }
        
        const data: ChartPoint[] = [];
        Array.from(grouped.entries()).sort((a,b)=>a[0].localeCompare(b[0])).forEach(([key, items]) => {
            const dateObj = new Date(key + '-01T00:00:00');
            const label = dateObj.toLocaleDateString('tr-TR', { month: 'short', year: 'numeric' });
            const lastItem = items[items.length - 1];
            const vals = items.map(i => i.total);
            data.push({
                date: key, label, 
                value: lastItem.total, close: lastItem.total, open: items[0].total,
                high: Math.max(...vals), low: Math.min(...vals)
            });
        });
        if (data.length < 2) return [{ label: '1A (Kayıt Yok)', value: currentTotal, close: currentTotal }, { label: 'Şimdi', value: currentTotal, close: currentTotal }];
        return data;
    } 

    if (period === '1d' || period === 'all') {
        // Group by Day (1G) - one point per day
        const grouped = new Map<string, WealthSnapshot>();
        for (const h of historyPlusToday) {
            grouped.set(h.date, h); // keeps the latest one for each day
        }
        
        const data: ChartPoint[] = Array.from(grouped.values()).map(h => ({
            date: h.date, label: fmtDate(h.date),
            value: h.total, open: h.total, close: h.total, high: h.total, low: h.total,
        }));
        if (data.length < 2) return [{ label: period === '1d' ? '1G (Kayıt Yok)' : 'Başlangıç', value: currentTotal, close: currentTotal }, { label: 'Şimdi', value: currentTotal, close: currentTotal }];
        return data;
    }
    
    return [];
}

function buildHourlyData(hourly: HourlySnapshot[], period: TimePeriod, currentTotal: number): ChartPoint[] {
    const nowTs = Date.now();
    const hourlyPlusNow = [...hourly];
    
    if (hourlyPlusNow.length > 0) {
        const last = hourlyPlusNow[hourlyPlusNow.length - 1];
        if (last.close !== currentTotal) {
            hourlyPlusNow.push({ timestamp: new Date().toISOString(), open: currentTotal, close: currentTotal, high: currentTotal, low: currentTotal, total: currentTotal });
        }
    } else {
        hourlyPlusNow.push({ timestamp: new Date().toISOString(), open: currentTotal, close: currentTotal, high: currentTotal, low: currentTotal, total: currentTotal });
    }

    return [];
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function WealthHistoryChart({
    history, currentTotal, assets = [], totalPLPct = 0, totalCost = 0,
}: WealthHistoryChartProps) {
    const { currency, convert } = useCurrency();
    const [period, setPeriod] = useState<TimePeriod>('1d');
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [hourly, setHourly] = useState<HourlySnapshot[]>([]);
    const [showAssetPicker, setShowAssetPicker] = useState(false);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const [chartWidth, setChartWidth] = useState(0);

    useLayoutEffect(() => {
        const measure = () => {
            if (chartContainerRef.current) {
                const w = chartContainerRef.current.offsetWidth;
                if (w > 0) setChartWidth(w);
            }
        };
        measure();
        const t1 = setTimeout(measure, 100);
        const t2 = setTimeout(measure, 400);
        const t3 = setTimeout(measure, 900);
        let ro: ResizeObserver | null = null;
        try {
            ro = new ResizeObserver(measure);
            if (chartContainerRef.current) ro.observe(chartContainerRef.current);
        } catch {}
        return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); ro?.disconnect(); };
    }, []);

    // API fetch states
    const [apiAssetHistory, setApiAssetHistory] = useState<ChartPoint[]>([]);
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [lastFetchKey, setLastFetchKey] = useState('');

    useEffect(() => { setHourly(getHourlyHistory()); }, [currentTotal]);

    // Fetch individual asset history
    useEffect(() => {
        if (!selectedAssetId) { setApiAssetHistory([]); setLastFetchKey(''); return; }
        const asset = assets.find(a => a.id === selectedAssetId);
        if (!asset?.apiId) { setApiAssetHistory([]); return; }
        const apiPeriod = period === '1m' ? '3m' : period === 'all' ? '3y' : '3m';
        const key = `${asset.apiId}_${apiPeriod}`;
        if (key === lastFetchKey && apiAssetHistory.length > 0) return;
        let cancelled = false;
        setIsApiLoading(true);
        fetch('/api/historical-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: apiPeriod, assets: [{ apiId: asset.apiId, category: asset.category, amount: 1 }] }),
            cache: 'no-store',
        }).then(r => r.json()).then(data => {
            if (cancelled) return;
            let pts: ChartPoint[] = (data.points || []).map((p: any) => ({
                label: fmtDate(p.date), date: p.date,
                value: p.close ?? p.value, open: p.open ?? p.value,
                close: p.close ?? p.value, high: p.high ?? p.value * 1.001,
                low: p.low ?? p.value * 0.999,
            }));
            setApiAssetHistory(pts);
            setLastFetchKey(key);
        }).catch(e => console.error(e)).finally(() => { if (!cancelled) setIsApiLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAssetId, period]);

    // Build chart data
    const chartData = useMemo(() => {
        return buildDailyData(history, currentTotal, period);
    }, [history, currentTotal, period, hourly, selectedAssetId, apiAssetHistory]);

    const activeData = chartData;

    // Currency conversion
    const displayData = useMemo(() => activeData.map(d => ({
        ...d,
        value: d.value !== undefined ? convert(d.value) : undefined,
        open: d.open !== undefined ? convert(d.open) : undefined,
        close: d.close !== undefined ? convert(d.close) : undefined,
        high: d.high !== undefined ? convert(d.high) : undefined,
        low: d.low !== undefined ? convert(d.low) : undefined,
        pastValue: d.pastValue !== undefined ? convert(d.pastValue) : undefined,
        currentValue: d.currentValue !== undefined ? convert(d.currentValue) : undefined,
    })), [activeData, convert]);

    const fmt = useCallback((v: number) =>
        new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v)
        , [currency]);

    const firstVal = displayData[0]?.close ?? displayData[0]?.value ?? 0;
    const lastVal = displayData[displayData.length - 1]?.close ?? displayData[displayData.length - 1]?.value ?? 0;
    const totalChange = lastVal - firstVal;
    const displayChangePct = selectedAssetId
        ? (firstVal > 0 ? (totalChange / firstVal) * 100 : 0)
        : totalPLPct;
    const isUp = displayChangePct >= 0;
    const mainColor = isUp ? '#26a69a' : '#ef5350';  // TradingView green/red
    const selectedAsset = assets.find(a => a.id === selectedAssetId);

    const periodLabels: Record<TimePeriod, string> = { '1d': '1G', '1m': '1A', 'all': 'TÜM' };

    return (
        <div style={{
            background: 'var(--bg-card)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, overflow: 'hidden', fontFamily: "'Inter', sans-serif",
        }}>
            {/* ── Body (wealth view only, what-if removed) ── */}
            <div style={{ padding: '16px 0 0' }}>
                    {/* Value + P/L Header */}
                    <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                                {selectedAsset ? selectedAsset.name : 'Toplam Portföy'}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.5 }}>
                                {fmt(lastVal)}
                            </div>
                            <div style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4,
                                fontSize: 12, fontWeight: 600,
                                color: isUp ? '#26a69a' : '#ef5350',
                            }}>
                                <span>{isUp ? '▲' : '▼'}</span>
                                <span>{isUp ? '+' : ''}{displayChangePct.toFixed(2)}%</span>
                                {totalChange !== 0 && (
                                    <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>
                                        ({isUp ? '+' : ''}{fmt(totalChange)})
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Custom Asset Picker - fixes white-on-white option text bug */}
                        {assets.length > 0 && (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowAssetPicker(v => !v)}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)', color: selectedAssetId ? 'var(--text-primary)' : 'rgba(255,255,255,0.4)',
                                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                                        padding: '6px 12px', fontSize: 11, fontWeight: 600,
                                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                        minWidth: 130,
                                    }}
                                >
                                    <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {selectedAssetId ? assets.find(a => a.id === selectedAssetId)?.name ?? 'Varlık' : 'Toplam Portföy'}
                                    </span>
                                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                                        <path d="M1 1L5 5L9 1" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                </button>
                                {showAssetPicker && (
                                    <div style={{
                                        position: 'absolute', top: '100%', right: 0, zIndex: 50,
                                        background: 'var(--bg-elevated)', border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: 10, overflow: 'hidden', marginTop: 4,
                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                        minWidth: 180, maxHeight: 260, overflowY: 'auto',
                                    }}>
                                        {[{ id: '', name: 'Toplam Portföy' }, ...assets].map(a => (
                                            <button
                                                key={a.id}
                                                onClick={() => {
                                                    setSelectedAssetId(a.id);
                                                    setShowAssetPicker(false);
                                                }}
                                                style={{
                                                    display: 'block', width: '100%', textAlign: 'left',
                                                    padding: '8px 12px', border: 'none', cursor: 'pointer',
                                                    background: selectedAssetId === a.id ? 'rgba(99,102,241,0.2)' : 'transparent',
                                                    color: selectedAssetId === a.id ? '#a78bfa' : 'rgba(255,255,255,0.8)',
                                                    fontSize: 12, fontWeight: 500,
                                                    borderLeft: selectedAssetId === a.id ? '2px solid #6366f1' : '2px solid transparent',
                                                    transition: 'all 0.15s',
                                                }}
                                                onMouseOver={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                                                onMouseOut={e => { (e.currentTarget as HTMLElement).style.background = selectedAssetId === a.id ? 'rgba(99,102,241,0.2)' : 'transparent'; }}
                                            >
                                                {a.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Period + Chart Type Toolbar */}
                    <div style={{
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 2,
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                        {/* Period buttons */}
                        {(['1d', '1m', 'all'] as const).map(p => {
                            return (
                                <button key={p} onClick={() => setPeriod(p)} style={{
                                    padding: '5px 10px', border: 'none', borderRadius: 6,
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    background: period === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: period === p ? 'var(--text-primary)' : 'rgba(255,255,255,0.35)',
                                    transition: 'all 0.15s', letterSpacing: 0.5,
                                }}>
                                    {periodLabels[p]}
                                </button>
                            );
                        })}

                        <div style={{ flex: 1 }} />
                    </div>

                    {/* Loading overlay */}
                    {isApiLoading && (
                        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            Yükleniyor...
                        </div>
                    )}

                    {/* Chart */}
                    {!isApiLoading && (
                        <div ref={chartContainerRef} style={{ width: '100%', height: 340 }}>
                            {chartWidth > 0 && (
                                <TvAreaChart
                                    data={displayData} isUp={isUp} mainColor={mainColor} fmt={fmt}
                                    costLine={!selectedAssetId && totalCost > 0 ? convert(totalCost) : undefined}
                                    width={chartWidth} height={340}
                                />
                            )}
                        </div>
                    )}

                    {/* Bottom stats bar */}
                    {displayData.length > 0 && !isApiLoading && (
                        <div style={{
                            display: 'flex', justifyContent: 'space-around',
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            padding: '10px 16px', gap: 8,
                        }}>
                            {[
                                { label: 'En Düşük', value: Math.min(...displayData.map(d => d.low ?? d.value ?? Infinity)), color: '#ef5350' },
                                { label: 'En Yüksek', value: Math.max(...displayData.map(d => d.high ?? d.value ?? 0)), color: '#26a69a' },
                                { label: 'Başlangıç', value: firstVal, color: 'rgba(255,255,255,0.5)' },
                            ].map(stat => (
                                <div key={stat.label} style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 }}>{stat.label}</div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: stat.color }}>{fmt(stat.value)}</div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
        </div>
    );
}

// ─── TradingView Area Chart ───────────────────────────────────────────────────

function TvAreaChart({ data, isUp, mainColor, fmt, costLine, width = 400, height = 340 }: {
    data: ChartPoint[]; isUp: boolean; mainColor: string; fmt: (v: number) => string; costLine?: number;
    width?: number; height?: number;
}) {
    const dataKey = 'close';
    const gradId = isUp ? 'tvUp' : 'tvDown';

    const Tip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const val: number = payload[0].value;
        const firstVal = data[0]?.[dataKey as keyof ChartPoint] as number ?? 0;
        const pct = firstVal > 0 ? ((val - firstVal) / firstVal) * 100 : 0;
        const up = pct >= 0;
        return (
            <div style={{
                background: 'rgba(13,17,23,0.96)', border: `1px solid ${up ? '#26a69a33' : '#ef535033'}`,
                borderRadius: 8, padding: '10px 14px', minWidth: 140,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${mainColor}10`,
                backdropFilter: 'blur(12px)',
            }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6, letterSpacing: 0.5 }}>{label}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{fmt(val)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: up ? '#26a69a' : '#ef5350' }}>
                    {up ? '▲' : '▼'} {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
            </div>
        );
    };

    return (
        <AreaChart width={width} height={height} data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={mainColor} stopOpacity={0.25} />
                    <stop offset="50%" stopColor={mainColor} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={mainColor} stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid
                stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} vertical={false}
            />
            <XAxis
                dataKey="label"
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd" minTickGap={40}
                padding={{ left: 8, right: 8 }}
            />
            <YAxis
                orientation="right"
                tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9, fontFamily: 'Inter' }}
                axisLine={false} tickLine={false}
                tickFormatter={fmtY} width={52}
                domain={['auto', 'auto']}
            />
            <Tooltip
                content={<Tip />}
                cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1 }}
                isAnimationActive={false}
            />
            {costLine !== undefined && (
                <ReferenceLine
                    y={costLine} stroke="#a78bfa88" strokeDasharray="5 3" strokeWidth={1}
                    label={{ value: 'Maliyet', position: 'insideBottomRight', fill: '#a78bfa', fontSize: 9, fontWeight: 600 }}
                />
            )}
            <Area
                type="monotone" dataKey={dataKey}
                stroke={mainColor} strokeWidth={1.5}
                fill={`url(#${gradId})`}
                dot={false}
                activeDot={{ r: 4, fill: mainColor, stroke: 'var(--bg-card)', strokeWidth: 2 }}
                isAnimationActive={true} animationDuration={400} animationEasing="ease-out"
            />
        </AreaChart>
    );
}

// ─── What-If View ─────────────────────────────────────────────────────────────

function WhatIfView({ data, currentTotal, assets, fmt, period, setPeriod, isLoading }: {
    data: ChartPoint[]; currentTotal: number; assets: Asset[];
    fmt: (v: number) => string; period: TimePeriod; setPeriod: (p: TimePeriod) => void; isLoading: boolean;
}) {
    const wiRef = useRef<HTMLDivElement>(null);
    const [wiWidth, setWiWidth] = useState(0);
    useLayoutEffect(() => {
        const m = () => { if (wiRef.current) { const w = wiRef.current.offsetWidth; if (w > 0) setWiWidth(w); } };
        m(); const t1 = setTimeout(m, 150); const t2 = setTimeout(m, 500);
        let ro: ResizeObserver | null = null;
        try { ro = new ResizeObserver(m); if (wiRef.current) ro.observe(wiRef.current); } catch {}
        return () => { clearTimeout(t1); clearTimeout(t2); ro?.disconnect(); };
    }, []);
    const periodLabels = [
        { key: '1m' as const, label: '1 Ay' },
        { key: 'all' as const, label: 'Maksimum' },
    ];

    const earliest = data[0]?.pastValue ?? 0;
    const change = earliest > 0 ? ((currentTotal - earliest) / earliest) * 100 : 0;
    const isGrowth = change >= 0;

    const Tip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        return (
            <div style={{
                background: 'rgba(13,17,23,0.96)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '10px 14px', minWidth: 150,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>{label}</div>
                {payload.map((p: any, i: number) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: p.stroke ?? p.color }}>{p.name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(p.value)}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                        Zaman Makinesi
                    </div>
                    <div style={{ fontSize: 12, color: isGrowth ? '#26a69a' : '#ef5350', fontWeight: 600 }}>
                        {isGrowth ? '▲' : '▼'} {change >= 0 ? '+' : ''}{change.toFixed(2)}% dönem değişimi
                    </div>
                </div>
                {/* Period selector */}
                <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 3 }}>
                    {periodLabels.map(p => (
                        <button key={p.key} onClick={() => setPeriod(p.key)} style={{
                            padding: '4px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
                            fontSize: 10, fontWeight: 600, background: period === p.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: period === p.key ? 'var(--text-primary)' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
                        }}>
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>Hesaplanıyor...</div>
            ) : data.length < 2 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6 }}>
                        Geçmiş fiyat verisi birikmesi bekleniyor.<br />Gelecekte otomatik görünecek.
                    </p>
                </div>
            ) : (
                <>
                <div ref={wiRef} style={{ width: '100%', height: 240 }}>
                    {wiWidth > 0 && (
                        <AreaChart width={wiWidth} height={240} data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="wiPast" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="wiNow" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.2} />
                                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} vertical={false} />
                            <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} axisLine={false} tickLine={false} minTickGap={40} />
                            <YAxis orientation="right" tick={{ fill: 'rgba(255,255,255,0.25)', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={fmtY} width={52} domain={['auto', 'auto']} />
                            <Tooltip content={<Tip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} isAnimationActive={false} />
                            <Area type="monotone" dataKey="pastValue" name="Geçmiş Değer" stroke="#f59e0b" strokeWidth={1.5} fill="url(#wiPast)" dot={false} isAnimationActive={false} />
                            <Area type="monotone" dataKey="currentValue" name="Güncel Değer" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="6 3" fill="url(#wiNow)" dot={false} isAnimationActive={false} />
                        </AreaChart>
                    )}
                </div>

                    {/* Legend */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12 }}>
                        {[{ color: '#f59e0b', label: 'Geçmiş Değer' }, { color: '#a78bfa', label: 'Güncel Değer' }].map(l => (
                            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
                                <div style={{ width: 16, height: 2, background: l.color, borderRadius: 1 }} />
                                {l.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
