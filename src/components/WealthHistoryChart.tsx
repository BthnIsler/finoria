'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
    BarChart, Bar, Cell, ComposedChart, Line,
    ReferenceLine,
} from 'recharts';
import { WealthSnapshot, getHourlyHistory, HourlySnapshot, getAssetPriceHistory, AssetPricePoint } from '@/lib/storage';
import { Asset } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';

type ChartView = 'area' | 'candle';
type TimePeriod = '4h' | '1w' | '1m' | '1y' | 'all';

interface WealthHistoryChartProps {
    history: WealthSnapshot[];
    currentTotal: number;
    assets?: Asset[];
}

export default function WealthHistoryChart({ history, currentTotal, assets = [] }: WealthHistoryChartProps) {
    const [view, setView] = useState<ChartView>('area');
    const [period, setPeriod] = useState<TimePeriod>('all');
    const [selectedAssetId, setSelectedAssetId] = useState<string>('');
    const [hourly, setHourly] = useState<HourlySnapshot[]>([]);
    const [assetHistory, setAssetHistory] = useState<AssetPricePoint[]>([]);

    useEffect(() => {
        setHourly(getHourlyHistory());
    }, [currentTotal]);

    useEffect(() => {
        if (selectedAssetId) {
            setAssetHistory(getAssetPriceHistory(selectedAssetId));
        } else {
            setAssetHistory([]);
        }
    }, [selectedAssetId, currentTotal]);

    // Build data based on period
    const chartData = useMemo(() => {
        if (selectedAssetId && assetHistory.length > 0) {
            return buildAssetData(assetHistory, period);
        }
        if (period === '4h' || period === '1w') {
            return buildHourlyData(hourly, period, currentTotal);
        }
        return buildDailyData(history, currentTotal, period);
    }, [history, currentTotal, period, hourly, selectedAssetId, assetHistory]);

    if (chartData.length < 2 && !selectedAssetId) {
        return (
            <div className="glass-card" style={{ padding: 30, textAlign: 'center' }}>
                <p style={{ fontSize: 36, marginBottom: 10 }}>📈</p>
                <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Servet Geçmişi</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.6 }}>
                    Grafiğin oluşması için en az 2 veri noktası gerekiyor.
                    <br />
                    Fiyatlar güncellendikçe anlık görüntüler kaydediliyor.
                </p>
            </div>
        );
    }

    const firstVal = chartData[0]?.close ?? chartData[0]?.value ?? 0;
    const lastVal = chartData[chartData.length - 1]?.close ?? chartData[chartData.length - 1]?.value ?? 0;
    const change = lastVal - firstVal;
    const changePct = firstVal > 0 ? (change / firstVal) * 100 : 0;
    const isUp = change >= 0;

    const selectedAsset = assets.find((a) => a.id === selectedAssetId);

    return (
        <div className="glass-card" style={{ padding: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                    <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {selectedAsset ? `📊 ${selectedAsset.name}` : '📈 Servet Geçmişi'}
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {chartData.length} veri noktası
                        {selectedAsset && ` · ${selectedAsset.name}`}
                    </p>
                </div>
                <span style={{
                    fontSize: 12, fontWeight: 600, padding: '4px 10px',
                    borderRadius: 100,
                    background: isUp ? 'rgba(0, 230, 138, 0.1)' : 'rgba(255, 77, 106, 0.1)',
                    color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                    {isUp ? '▲' : '▼'} {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </span>
            </div>

            {/* Controls Row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                {/* Time period pills */}
                <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                    {(['4h', '1w', '1m', '1y', 'all'] as const).map((p) => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            style={{
                                background: period === p ? (isUp ? 'var(--accent-green)' : 'var(--accent-red)') : 'transparent',
                                color: period === p ? '#fff' : 'var(--text-muted)',
                                border: 'none', padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                                textTransform: 'uppercase', letterSpacing: 0.5,
                            }}
                        >
                            {p === '4h' ? '4S' : p === '1w' ? '1H' : p === '1m' ? '1A' : p === '1y' ? '1Y' : 'Tümü'}
                        </button>
                    ))}
                </div>

                {/* Chart type toggle */}
                <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                    <button
                        onClick={() => setView('area')}
                        style={{
                            background: view === 'area' ? 'var(--accent-purple)' : 'transparent',
                            color: view === 'area' ? '#fff' : 'var(--text-muted)',
                            border: 'none', padding: '4px 10px', fontSize: 10, fontWeight: 600,
                            borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        📈 Çizgi
                    </button>
                    <button
                        onClick={() => setView('candle')}
                        style={{
                            background: view === 'candle' ? 'var(--accent-purple)' : 'transparent',
                            color: view === 'candle' ? '#fff' : 'var(--text-muted)',
                            border: 'none', padding: '4px 10px', fontSize: 10, fontWeight: 600,
                            borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                        }}
                    >
                        🕯️ Mum
                    </button>
                </div>

                {/* Asset selector */}
                {assets.length > 0 && (
                    <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        style={{
                            background: 'var(--bg-elevated)',
                            color: selectedAssetId ? 'var(--accent-cyan)' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            borderRadius: 8, padding: '4px 8px', fontSize: 10, fontWeight: 600,
                            cursor: 'pointer', outline: 'none', marginLeft: 'auto',
                        }}
                    >
                        <option value="">Toplam Portföy</option>
                        {assets.map((a) => (
                            <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* Chart */}
            <ResponsiveContainer width="100%" height={220}>
                {view === 'candle' ? (
                    <CandlestickChart data={chartData} isUp={isUp} />
                ) : (
                    <AreaChartView data={chartData} isUp={isUp} isAsset={!!selectedAssetId} />
                )}
            </ResponsiveContainer>

            {/* Current value bar */}
            {chartData.length > 0 && (
                <div style={{
                    display: 'flex', justifyContent: 'space-between', marginTop: 12,
                    padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8,
                    fontSize: 11, color: 'var(--text-muted)',
                }}>
                    <span>En Düşük: <b style={{ color: 'var(--accent-red)' }}>{formatCurrency(Math.min(...chartData.map((d) => d.low ?? d.value ?? 0)))}</b></span>
                    <span>En Yüksek: <b style={{ color: 'var(--accent-green)' }}>{formatCurrency(Math.max(...chartData.map((d) => d.high ?? d.value ?? 0)))}</b></span>
                </div>
            )}
        </div>
    );
}

// ============ SUB COMPONENTS ============

function AreaChartView({ data, isUp, isAsset }: { data: ChartPoint[]; isUp: boolean; isAsset: boolean }) {
    const dataKey = isAsset ? 'value' : 'close';
    const gradientId = `areaGrad_${isUp ? 'up' : 'down'}`;

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 12,
                }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</p>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{formatCurrency(payload[0].value)}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <AreaChart data={data}>
            <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={isUp ? '#00e68a' : '#ff4d6a'} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={isUp ? '#00e68a' : '#ff4d6a'} stopOpacity={0} />
                </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide={true} domain={['auto', 'auto']} />
            <Tooltip content={<CustomTooltip />} />
            <Area
                type="monotone" dataKey={dataKey}
                stroke={isUp ? '#00e68a' : '#ff4d6a'} strokeWidth={2}
                fill={`url(#${gradientId})`}
                dot={false} activeDot={{ r: 4, fill: isUp ? '#00e68a' : '#ff4d6a' }}
                animationDuration={400}
            />
        </AreaChart>
    );
}

// Custom candlestick chart using ComposedChart + Bar
function CandlestickChart({ data, isUp: _isUp }: { data: ChartPoint[]; isUp: boolean }) {
    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const d = payload[0]?.payload;
            if (!d) return null;
            return (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 11,
                }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Açılış:</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(d.open)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Kapanış:</span>
                        <span style={{ fontWeight: 600 }}>{formatCurrency(d.close)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Yüksek:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{formatCurrency(d.high)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Düşük:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{formatCurrency(d.low)}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    // Prepare candlestick bars: body = open-close, wick = low-high
    const chartDataWithCandle = data.map((d) => {
        const bullish = (d.close ?? 0) >= (d.open ?? 0);
        return {
            ...d,
            bodyBottom: bullish ? d.open : d.close,
            bodyTop: bullish ? d.close : d.open,
            bodyHeight: Math.abs((d.close ?? 0) - (d.open ?? 0)),
            bullish,
        };
    });

    const allValues = data.flatMap((d) => [d.open ?? 0, d.close ?? 0, d.high ?? 0, d.low ?? 0]).filter(Boolean);
    const minVal = Math.min(...allValues) * 0.999;
    const maxVal = Math.max(...allValues) * 1.001;

    return (
        <ComposedChart data={chartDataWithCandle}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
            <YAxis hide domain={[minVal, maxVal]} />
            <Tooltip content={<CustomTooltip />} />

            {/* Wick line (high-low) - drawn as thin bars */}
            <Bar dataKey="high" fill="transparent" barSize={1} stackId="wick" />
            <Bar dataKey="low" fill="transparent" barSize={1} stackId="wick" />

            {/* Candle body - using open/close as stacked bars */}
            <Bar dataKey="bodyBottom" stackId="body" fill="transparent" barSize={14} />
            <Bar dataKey="bodyHeight" stackId="body" barSize={14}>
                {chartDataWithCandle.map((entry, i) => (
                    <Cell
                        key={`cell-${i}`}
                        fill={entry.bullish ? '#00e68a' : '#ff4d6a'}
                        stroke={entry.bullish ? '#00e68a' : '#ff4d6a'}
                    />
                ))}
            </Bar>

            {/* High-Low wicks as lines */}
            <Line type="monotone" dataKey="high" stroke="var(--text-muted)" strokeWidth={1} dot={false} strokeDasharray="2 2" />
            <Line type="monotone" dataKey="low" stroke="var(--text-muted)" strokeWidth={1} dot={false} strokeDasharray="2 2" />
        </ComposedChart>
    );
}


// ============ DATA BUILDERS ============

interface ChartPoint {
    label: string;
    date?: string;
    value?: number;
    open?: number;
    close?: number;
    high?: number;
    low?: number;
}

function buildDailyData(history: WealthSnapshot[], currentTotal: number, period: TimePeriod): ChartPoint[] {
    const data: ChartPoint[] = history.map((h) => ({
        date: h.date,
        label: formatDateShort(h.date),
        value: h.total,
        open: h.total,
        close: h.total,
        high: h.total * 1.002,
        low: h.total * 0.998,
    }));

    const today = new Date().toISOString().split('T')[0];
    const lastEntry = data[data.length - 1];
    if (lastEntry?.date === today) {
        lastEntry.value = currentTotal;
        lastEntry.close = currentTotal;
        lastEntry.high = Math.max(lastEntry.high ?? 0, currentTotal);
        lastEntry.low = Math.min(lastEntry.low ?? currentTotal, currentTotal);
    } else {
        data.push({
            date: today,
            label: formatDateShort(today),
            value: currentTotal,
            open: currentTotal,
            close: currentTotal,
            high: currentTotal,
            low: currentTotal,
        });
    }

    return filterByPeriod(data, period);
}

function buildHourlyData(hourly: HourlySnapshot[], period: TimePeriod, currentTotal: number): ChartPoint[] {
    let cutoff: Date;
    if (period === '4h') {
        cutoff = new Date(Date.now() - 4 * 60 * 60 * 1000);
    } else {
        cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const filtered = hourly.filter((h) => new Date(h.timestamp) >= cutoff);

    const data: ChartPoint[] = filtered.map((h) => ({
        label: formatTimeShort(h.timestamp),
        value: h.close,
        open: h.open,
        close: h.close,
        high: h.high,
        low: h.low,
    }));

    // Add current point
    if (data.length > 0) {
        const last = data[data.length - 1];
        if (last.close !== currentTotal) {
            data.push({
                label: formatTimeShort(new Date().toISOString()),
                value: currentTotal,
                open: currentTotal,
                close: currentTotal,
                high: currentTotal,
                low: currentTotal,
            });
        }
    }

    return data;
}

function buildAssetData(assetHistory: AssetPricePoint[], period: TimePeriod): ChartPoint[] {
    let cutoff = new Date(0);
    const now = Date.now();

    if (period === '4h') cutoff = new Date(now - 4 * 60 * 60 * 1000);
    else if (period === '1w') cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === '1m') cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    else if (period === '1y') cutoff = new Date(now - 365 * 24 * 60 * 60 * 1000);

    const filtered = assetHistory.filter((h) => new Date(h.timestamp) >= cutoff);

    return filtered.map((h) => ({
        label: period === '4h' ? formatTimeShort(h.timestamp) : formatDateShort(h.timestamp.split('T')[0]),
        value: h.value,
        open: h.price,
        close: h.price,
        high: h.price * 1.001,
        low: h.price * 0.999,
    }));
}

function filterByPeriod(data: ChartPoint[], period: TimePeriod): ChartPoint[] {
    if (period === 'all' || period === '4h' || period === '1w') return data;
    const now = new Date();
    let cutoff: Date;
    if (period === '1m') cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else cutoff = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    return data.filter((d) => {
        if (!d.date) return true;
        return new Date(d.date + 'T00:00:00') >= cutoff;
    });
}

function formatDateShort(dateStr: string): string {
    try {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    } catch {
        return dateStr;
    }
}

function formatTimeShort(isoStr: string): string {
    try {
        const d = new Date(isoStr);
        return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return isoStr;
    }
}
