'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
    ComposedChart, Bar, Cell, Line, ReferenceLine,
} from 'recharts';
import { WealthSnapshot, getHourlyHistory, HourlySnapshot } from '@/lib/storage';
import { Asset } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';

type ChartView = 'area' | 'candle';
type TimePeriod = '4h' | '1w' | '1m' | '1y' | 'all';
type ChartMode = 'wealth' | 'whatif';

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
    if (period === 'all' || period === '4h' || period === '1w') return data;
    const now = new Date();
    const cutoff = period === '1m'
        ? new Date(now.getTime() - 30 * 86400_000)
        : new Date(now.getTime() - 365 * 86400_000);
    return data.filter(d => !d.date || new Date(d.date + 'T00:00:00') >= cutoff);
}

function buildDailyData(history: WealthSnapshot[], currentTotal: number, period: TimePeriod): ChartPoint[] {
    const data: ChartPoint[] = history.map(h => ({
        date: h.date, label: fmtDate(h.date),
        value: h.total, open: h.total, close: h.total,
        high: h.total, low: h.total,
    }));
    const today = new Date().toISOString().split('T')[0];
    const last = data[data.length - 1];
    if (last?.date === today) {
        last.value = currentTotal; last.close = currentTotal;
        last.high = Math.max(last.high ?? 0, currentTotal);
        last.low = Math.min(last.low ?? currentTotal, currentTotal);
    } else {
        data.push({ date: today, label: fmtDate(today), value: currentTotal, open: currentTotal, close: currentTotal, high: currentTotal, low: currentTotal });
    }
    const filtered = filterByPeriod(data, period);
    // Ensure minimum 2 data points
    if (filtered.length === 0) return [
        { label: 'Başlangıç', value: currentTotal, close: currentTotal, open: currentTotal, high: currentTotal, low: currentTotal },
        { label: 'Şimdi', value: currentTotal, close: currentTotal, open: currentTotal, high: currentTotal, low: currentTotal },
    ];
    if (filtered.length === 1) return [filtered[0], { ...filtered[0], label: 'Şimdi' }];
    return filtered;
}

function buildHourlyData(hourly: HourlySnapshot[], period: TimePeriod, currentTotal: number): ChartPoint[] {
    const cutoff = period === '4h'
        ? new Date(Date.now() - 4 * 3600_000)
        : new Date(Date.now() - 7 * 86400_000);
    const filtered = hourly.filter(h => new Date(h.timestamp) >= cutoff);
    const data: ChartPoint[] = filtered.map(h => ({
        label: fmtTime(h.timestamp),
        value: h.close, open: h.open, close: h.close, high: h.high, low: h.low,
    }));
    if (data.length > 0) {
        const last = data[data.length - 1];
        if (last.close !== currentTotal) {
            data.push({ label: fmtTime(new Date().toISOString()), value: currentTotal, open: currentTotal, close: currentTotal, high: currentTotal, low: currentTotal });
        }
    }
    // Fallback: no hourly data → flat line showing NOW
    if (data.length < 2) return [
        { label: period === '4h' ? '4 saat önce' : '1 hafta önce', value: currentTotal, close: currentTotal, open: currentTotal, high: currentTotal, low: currentTotal },
        { label: 'Şimdi', value: currentTotal, close: currentTotal, open: currentTotal, high: currentTotal, low: currentTotal },
    ];
    return data;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export default function WealthHistoryChart({
    history, currentTotal, assets = [], totalPLPct = 0, totalCost = 0,
}: WealthHistoryChartProps) {
    const { currency, convert } = useCurrency();
    const [chartMode, setChartMode] = useState<ChartMode>('wealth');
    const [view, setView] = useState<ChartView>('area');
    const [period, setPeriod] = useState<TimePeriod>('all');
    const [selectedAssetId, setSelectedAssetId] = useState('');
    const [hourly, setHourly] = useState<HourlySnapshot[]>([]);

    // API fetch states
    const [apiAssetHistory, setApiAssetHistory] = useState<ChartPoint[]>([]);
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [lastFetchKey, setLastFetchKey] = useState('');
    const [whatIfApiData, setWhatIfApiData] = useState<ChartPoint[]>([]);
    const [isWhatIfLoading, setIsWhatIfLoading] = useState(false);
    const [lastWhatIfKey, setLastWhatIfKey] = useState('');

    useEffect(() => { setHourly(getHourlyHistory()); }, [currentTotal]);

    // Fetch individual asset history
    useEffect(() => {
        if (!selectedAssetId) { setApiAssetHistory([]); setLastFetchKey(''); return; }
        const asset = assets.find(a => a.id === selectedAssetId);
        if (!asset?.apiId) { setApiAssetHistory([]); return; }
        const apiPeriod = period === '1m' ? '3m' : period === 'all' ? '3y' : period === '4h' || period === '1w' ? '3m' : '1y';
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
            if (period === '1w') pts = pts.slice(-7);
            else if (period === '1m') pts = pts.slice(-30);
            else if (period === '1y') pts = pts.slice(-365);
            setApiAssetHistory(pts);
            setLastFetchKey(key);
        }).catch(e => console.error(e)).finally(() => { if (!cancelled) setIsApiLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAssetId, period]);

    // Fetch What-If data
    useEffect(() => {
        if (chartMode !== 'whatif' || assets.length === 0) return;
        const apiPeriod = (period === '4h' || period === '1w' || period === '1m') ? '3m' : period === 'all' ? '3y' : '1y';
        const fetchable = assets.filter(a => a.apiId && ['crypto', 'stock', 'forex', 'precious_metals'].includes(a.category));
        const key = `${fetchable.map(a => a.apiId).join(',')}_${apiPeriod}`;
        if (key === lastWhatIfKey && whatIfApiData.length > 0) return;
        let cancelled = false;
        setIsWhatIfLoading(true);
        fetch('/api/historical-prices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ period: apiPeriod, assets: fetchable.map(a => ({ apiId: a.apiId, category: a.category, amount: a.amount })) }),
            cache: 'no-store',
        }).then(r => r.json()).then(data => {
            if (cancelled) return;
            let pts: ChartPoint[] = (data.points || []).map((p: any) => ({
                label: fmtDate(p.date), date: p.date, pastValue: p.value, currentValue: currentTotal,
            }));
            if (period === '1w') pts = pts.slice(-7);
            else if (period === '1m') pts = pts.slice(-30);
            else if (period === '1y') pts = pts.slice(-365);
            setWhatIfApiData(pts);
            setLastWhatIfKey(key);
        }).catch(e => console.error(e)).finally(() => { if (!cancelled) setIsWhatIfLoading(false); });
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartMode, period]);

    // Build chart data
    const chartData = useMemo(() => {
        if (selectedAssetId) return apiAssetHistory;
        if (period === '4h' || period === '1w') return buildHourlyData(hourly, period, currentTotal);
        return buildDailyData(history, currentTotal, period);
    }, [history, currentTotal, period, hourly, selectedAssetId, apiAssetHistory]);

    const activeData = chartMode === 'whatif' ? whatIfApiData : chartData;

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
        : chartMode === 'wealth' ? totalPLPct
            : (firstVal > 0 ? (totalChange / firstVal) * 100 : 0);
    const isUp = displayChangePct >= 0;
    const mainColor = isUp ? '#26a69a' : '#ef5350';  // TradingView green/red
    const selectedAsset = assets.find(a => a.id === selectedAssetId);

    const periodLabels: Record<TimePeriod, string> = { '4h': '4S', '1w': '1H', '1m': '1A', '1y': '1Y', 'all': 'TÜM' };

    return (
        <div style={{
            background: '#0d1117', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, overflow: 'hidden', fontFamily: "'Inter', sans-serif",
        }}>
            {/* ── Top header bar (mode toggle) ── */}
            <div style={{
                display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)',
                padding: '0 16px',
            }}>
                {(['wealth', 'whatif'] as const).map(m => (
                    <button key={m} onClick={() => setChartMode(m)} style={{
                        padding: '12px 16px', border: 'none', background: 'transparent',
                        cursor: 'pointer', fontSize: 12, fontWeight: 600, letterSpacing: 0.3,
                        color: chartMode === m ? '#fff' : 'rgba(255,255,255,0.35)',
                        borderBottom: chartMode === m ? `2px solid ${mainColor}` : '2px solid transparent',
                        marginBottom: -1, transition: 'color 0.2s',
                    }}>
                        {m === 'wealth' ? 'Servet Geçmişi' : 'Geçmişte Olsaydı?'}
                    </button>
                ))}
            </div>

            {/* ── Body ── */}
            {chartMode === 'whatif' ? (
                <WhatIfView
                    data={displayData} currentTotal={convert(currentTotal)}
                    assets={assets} fmt={fmt}
                    period={period} setPeriod={setPeriod}
                    isLoading={isWhatIfLoading}
                />
            ) : (
                <div style={{ padding: '16px 0 0' }}>
                    {/* Value + P/L Header */}
                    <div style={{ padding: '0 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                                {selectedAsset ? selectedAsset.name : 'Toplam Portföy'}
                            </div>
                            <div style={{ fontSize: 28, fontWeight: 700, color: '#fff', letterSpacing: -0.5 }}>
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

                        {/* Asset Selector */}
                        {assets.length > 0 && (
                            <select
                                value={selectedAssetId}
                                onChange={e => {
                                    setSelectedAssetId(e.target.value);
                                    if (e.target.value && (period === '4h' || period === '1w')) setPeriod('1m');
                                }}
                                style={{
                                    background: 'rgba(255,255,255,0.05)', color: selectedAssetId ? '#fff' : 'rgba(255,255,255,0.4)',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
                                    padding: '6px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', outline: 'none',
                                }}
                            >
                                <option value="">Toplam Portföy</option>
                                {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        )}
                    </div>

                    {/* Period + Chart Type Toolbar */}
                    <div style={{
                        padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 2,
                        borderTop: '1px solid rgba(255,255,255,0.04)',
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                    }}>
                        {/* Period buttons */}
                        {(['4h', '1w', '1m', '1y', 'all'] as const).map(p => {
                            const isHourly = p === '4h' || p === '1w';
                            const disabled = isHourly && !!selectedAssetId;
                            return (
                                <button key={p} onClick={() => !disabled && setPeriod(p)} disabled={disabled} style={{
                                    padding: '5px 10px', border: 'none', borderRadius: 6,
                                    fontSize: 11, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
                                    background: period === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                                    color: period === p ? '#fff' : 'rgba(255,255,255,0.35)',
                                    opacity: disabled ? 0.3 : 1, transition: 'all 0.15s', letterSpacing: 0.5,
                                }}>
                                    {periodLabels[p]}
                                </button>
                            );
                        })}

                        <div style={{ flex: 1 }} />

                        {/* Chart Type Toggle */}
                        <div style={{ display: 'flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 7, padding: 3 }}>
                            <button onClick={() => setView('area')} style={{
                                padding: '4px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
                                fontSize: 10, fontWeight: 600, background: view === 'area' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: view === 'area' ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
                            }}>
                                Alan
                            </button>
                            <button onClick={() => setView('candle')} style={{
                                padding: '4px 10px', border: 'none', borderRadius: 5, cursor: 'pointer',
                                fontSize: 10, fontWeight: 600, background: view === 'candle' ? 'rgba(255,255,255,0.1)' : 'transparent',
                                color: view === 'candle' ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
                            }}>
                                Mum
                            </button>
                        </div>
                    </div>

                    {/* Loading overlay */}
                    {isApiLoading && (
                        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
                            Yükleniyor...
                        </div>
                    )}

                    {/* Chart */}
                    {!isApiLoading && (
                        <div style={{ position: 'relative' }}>
                            <ResponsiveContainer width="100%" height={280}>
                                {view === 'candle'
                                    ? <TvCandlestickChart data={displayData} fmt={fmt} />
                                    : <TvAreaChart data={displayData} isUp={isUp} mainColor={mainColor} fmt={fmt} costLine={!selectedAssetId && totalCost > 0 ? convert(totalCost) : undefined} />
                                }
                            </ResponsiveContainer>
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
            )}
        </div>
    );
}

// ─── TradingView Area Chart ───────────────────────────────────────────────────

function TvAreaChart({ data, isUp, mainColor, fmt, costLine }: {
    data: ChartPoint[]; isUp: boolean; mainColor: string; fmt: (v: number) => string; costLine?: number;
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
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{fmt(val)}</div>
                <div style={{ fontSize: 11, fontWeight: 600, color: up ? '#26a69a' : '#ef5350' }}>
                    {up ? '▲' : '▼'} {pct >= 0 ? '+' : ''}{pct.toFixed(2)}%
                </div>
            </div>
        );
    };

    return (
        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
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
                activeDot={{ r: 4, fill: mainColor, stroke: '#0d1117', strokeWidth: 2, zIndex: 10 }}
                isAnimationActive={true} animationDuration={400} animationEasing="ease-out"
            />
        </AreaChart>
    );
}

// ─── TradingView Candlestick Chart ────────────────────────────────────────────

function TvCandlestickChart({ data, fmt }: { data: ChartPoint[]; fmt: (v: number) => string }) {
    const processed = data.map(d => {
        const o = d.open ?? d.close ?? 0;
        const c = d.close ?? 0;
        const h = d.high ?? Math.max(o, c);
        const l = d.low ?? Math.min(o, c);
        const bull = c >= o;
        const bodyH = Math.max(Math.abs(c - o), 0.0001);
        return { ...d, open: o, close: c, high: h, low: l, bull, bodyBottom: bull ? o : c, bodyHeight: bodyH };
    });

    const allVals = data.flatMap(d => [d.open ?? 0, d.close ?? 0, d.high ?? 0, d.low ?? 0]).filter(Boolean);
    const minV = allVals.length > 0 ? Math.min(...allVals) * 0.985 : 0;
    const maxV = allVals.length > 0 ? Math.max(...allVals) * 1.015 : 100;

    // Check if the data is completely flat (no volatility)
    const isFlatline = allVals.length > 0 && Math.max(...allVals) === Math.min(...allVals);

    if (isFlatline || data.length < 2) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255,255,255,0.3)', padding: 20, textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>🕯️</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>Mum Grafiği İçin Yetersiz Veri</div>
                <div style={{ fontSize: 11, lineHeight: 1.5, maxWidth: 280 }}>Anlamlı bir mum grafiği (Açılış/Kapanış/Dalgalanma) çizebilmek için geçmiş veri noktalarının birikmesi bekleniyor.</div>
            </div>
        );
    }

    const Tip = ({ active, payload, label }: any) => {
        if (!active || !payload?.length) return null;
        const d = payload[0]?.payload;
        if (!d) return null;
        const bull = d.bull;
        return (
            <div style={{
                background: 'rgba(13,17,23,0.96)', border: `1px solid ${bull ? '#26a69a33' : '#ef535033'}`,
                borderRadius: 8, padding: '10px 14px', minWidth: 155,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)', backdropFilter: 'blur(12px)',
            }}>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: 0.5 }}>{label}</div>
                {[
                    { k: 'Aç', v: d.open, c: '#fff' },
                    { k: 'Kap', v: d.close, c: bull ? '#26a69a' : '#ef5350' },
                    { k: 'Yük', v: d.high, c: '#26a69a' },
                    { k: 'Düş', v: d.low, c: '#ef5350' },
                ].map(row => (
                    <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 2 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>{row.k}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: row.c }}>{fmt(row.v)}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <ComposedChart data={processed} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeWidth={0.5} vertical={false} />
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
                domain={[minV, maxV]}
            />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} isAnimationActive={false} />

            {/* Invisible transparent bar to anchor Y position at bodyBottom */}
            <Bar dataKey="bodyBottom" stackId="candle" fill="transparent" barSize={8} isAnimationActive={false} />
            {/* Visible candle body */}
            <Bar dataKey="bodyHeight" stackId="candle" barSize={8} isAnimationActive={false}>
                {processed.map((entry, i) => (
                    <Cell key={i} fill={entry.bull ? '#26a69a' : '#ef5350'} stroke={entry.bull ? '#26a69a' : '#ef5350'} />
                ))}
            </Bar>

            {/* Wicks via monotone lines (dashed to visually look like wicks) */}
            <Line type="monotone" dataKey="high" stroke="rgba(255,255,255,0.2)" strokeWidth={1} dot={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="low" stroke="rgba(255,255,255,0.2)" strokeWidth={1} dot={false} isAnimationActive={false} />
        </ComposedChart>
    );
}

// ─── What-If View ─────────────────────────────────────────────────────────────

function WhatIfView({ data, currentTotal, assets, fmt, period, setPeriod, isLoading }: {
    data: ChartPoint[]; currentTotal: number; assets: Asset[];
    fmt: (v: number) => string; period: TimePeriod; setPeriod: (p: TimePeriod) => void; isLoading: boolean;
}) {
    const periodLabels = [
        { key: '1m' as const, label: '1 Ay' },
        { key: '1y' as const, label: '1 Yıl' },
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
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{fmt(p.value)}</span>
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
                            color: period === p.key ? '#fff' : 'rgba(255,255,255,0.35)', transition: 'all 0.15s',
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
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={data} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
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
                    </ResponsiveContainer>

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
