'use client';

import React, { useMemo, useState, useEffect } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid,
    BarChart, Bar, Cell, ComposedChart, Line,
    ReferenceLine, Legend,
} from 'recharts';
import { WealthSnapshot, getHourlyHistory, HourlySnapshot } from '@/lib/storage';
import { Asset } from '@/lib/types';
import { formatCurrency } from '@/lib/utils';
import { useCurrency } from '@/lib/contexts';

type ChartView = 'area' | 'candle';
type TimePeriod = '4h' | '1w' | '1m' | '1y' | 'all';
type ChartMode = 'wealth' | 'whatif';

interface WealthHistoryChartProps {
    history: WealthSnapshot[];
    currentTotal: number;
    assets?: Asset[];
    totalPLPct?: number; // Total portfolio profit/loss percentage
    totalCost?: number;  // Total cost basis for reference line
}

export default function WealthHistoryChart({ history, currentTotal, assets = [], totalPLPct = 0, totalCost = 0 }: WealthHistoryChartProps) {
    const { currency, convert } = useCurrency();
    const [chartMode, setChartMode] = useState<ChartMode>('wealth');
    const [view, setView] = useState<ChartView>('area');
    const [period, setPeriod] = useState<TimePeriod>('all');
    const [selectedAssetId, setSelectedAssetId] = useState<string>('');
    const [hourly, setHourly] = useState<HourlySnapshot[]>([]);

    useEffect(() => {
        setHourly(getHourlyHistory());
    }, [currentTotal]);

    // ==== Fetch real historical data for individual asset from API ====
    const [apiAssetHistory, setApiAssetHistory] = useState<ChartPoint[]>([]);
    const [isApiLoading, setIsApiLoading] = useState(false);
    const [lastFetchedAssetKey, setLastFetchedAssetKey] = useState('');

    useEffect(() => {
        if (!selectedAssetId) {
            setApiAssetHistory([]);
            setLastFetchedAssetKey('');
            return;
        }
        const asset = assets.find((a) => a.id === selectedAssetId);
        if (!asset || !asset.apiId) {
            setApiAssetHistory([]);
            return;
        }

        // Determine API period (no hourly data from API, min is 3m)
        let apiPeriod = '1y';
        if (period === '1m') apiPeriod = '3m';
        else if (period === 'all') apiPeriod = '3y';
        // 4h and 1w also use 3m (API min)
        else if (period === '4h' || period === '1w') apiPeriod = '3m';

        // De-duplicate: don't re-fetch if same asset + same API period
        const fetchKey = `${asset.apiId}_${apiPeriod}`;
        if (fetchKey === lastFetchedAssetKey && apiAssetHistory.length > 0) return;

        let cancelled = false;

        const fetchAssetHistory = async () => {
            setIsApiLoading(true);
            try {
                const res = await fetch('/api/historical-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        period: apiPeriod,
                        assets: [{ apiId: asset.apiId, category: asset.category, amount: 1 }]
                    }),
                    cache: 'no-store',
                });
                if (cancelled) return;
                const data = await res.json();
                if (cancelled) return;

                if (!data.points || data.points.length === 0) {
                    console.warn(`No data returned for ${asset.apiId}`);
                    setApiAssetHistory([]);
                    return;
                }

                let pts: ChartPoint[] = data.points.map((p: any) => ({
                    label: formatDateShort(p.date),
                    date: p.date,
                    value: p.value, // UNIT PRICE in TRY
                    open: p.value,
                    close: p.value,
                    high: p.value * 1.001,
                    low: p.value * 0.999,
                }));

                // Slice for shorter periods
                if (period === '1w') pts = pts.slice(-7);
                else if (period === '1m') pts = pts.slice(-30);
                else if (period === '1y') pts = pts.slice(-365);

                setApiAssetHistory(pts);
                setLastFetchedAssetKey(fetchKey);
            } catch (err) {
                console.error(`Error fetching history for ${asset.apiId}:`, err);
            } finally {
                if (!cancelled) setIsApiLoading(false);
            }
        };
        fetchAssetHistory();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedAssetId, period]);

    // ==== Fetch real What-If data from API ====
    const [whatIfApiData, setWhatIfApiData] = useState<ChartPoint[]>([]);
    const [isWhatIfLoading, setIsWhatIfLoading] = useState(false);
    const [lastWhatIfKey, setLastWhatIfKey] = useState('');

    useEffect(() => {
        if (chartMode !== 'whatif' || assets.length === 0) return;

        let apiPeriod = '1y';
        if (period === '4h' || period === '1w' || period === '1m') apiPeriod = '3m';
        else if (period === 'all') apiPeriod = '3y';

        const fetchable = assets.filter(a => a.apiId && ['crypto', 'stock', 'forex', 'precious_metals'].includes(a.category));
        const whatIfKey = `${fetchable.map(a => a.apiId).join(',')}_${apiPeriod}`;
        if (whatIfKey === lastWhatIfKey && whatIfApiData.length > 0) return;

        let cancelled = false;

        const fetchWhatIf = async () => {
            setIsWhatIfLoading(true);
            try {
                const res = await fetch('/api/historical-prices', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        period: apiPeriod,
                        assets: fetchable.map(a => ({ apiId: a.apiId, category: a.category, amount: a.amount }))
                    }),
                    cache: 'no-store',
                });
                if (cancelled) return;
                const data = await res.json();
                if (cancelled) return;

                let pts: ChartPoint[] = (data.points || []).map((p: any) => ({
                    label: formatDateShort(p.date),
                    date: p.date,
                    pastValue: p.value,
                    currentValue: currentTotal,
                }));

                if (period === '1w') pts = pts.slice(-7);
                else if (period === '1m') pts = pts.slice(-30);
                else if (period === '1y') pts = pts.slice(-365);

                setWhatIfApiData(pts);
                setLastWhatIfKey(whatIfKey);
            } catch (err) {
                console.error('What-if fetch error:', err);
            } finally {
                if (!cancelled) setIsWhatIfLoading(false);
            }
        };
        fetchWhatIf();

        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chartMode, period]);

    // Build data based on period (NORMAL mode)
    const chartData = useMemo(() => {
        if (selectedAssetId) {
            return apiAssetHistory;
        }
        if (period === '4h' || period === '1w') {
            return buildHourlyData(hourly, period, currentTotal);
        }
        return buildDailyData(history, currentTotal, period);
    }, [history, currentTotal, period, hourly, selectedAssetId, apiAssetHistory]);

    // What If data is now directly from the API state
    const activeData = chartMode === 'whatif' ? whatIfApiData : chartData;

    // Apply currency conversion to display data
    const displayData = useMemo(() => {
        return activeData.map(d => ({
            ...d,
            value: d.value !== undefined ? convert(d.value) : undefined,
            open: d.open !== undefined ? convert(d.open) : undefined,
            close: d.close !== undefined ? convert(d.close) : undefined,
            high: d.high !== undefined ? convert(d.high) : undefined,
            low: d.low !== undefined ? convert(d.low) : undefined,
            pastValue: d.pastValue !== undefined ? convert(d.pastValue) : undefined,
            currentValue: d.currentValue !== undefined ? convert(d.currentValue) : undefined,
        }));
    }, [activeData, convert]);

    // Display formatter
    const fmt = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

    if (chartMode === 'wealth' && chartData.length < 2 && !selectedAssetId) {
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

    const firstVal = displayData[0]?.close ?? displayData[0]?.value ?? 0;
    const lastVal = displayData[displayData.length - 1]?.close ?? displayData[displayData.length - 1]?.value ?? 0;
    const change = lastVal - firstVal;

    // Calculate percentage badge
    let displayChangePct: number;
    if (selectedAssetId) {
        // Per-asset: change from first to last data point in the chart
        displayChangePct = firstVal > 0 ? (change / firstVal) * 100 : 0;
    } else if (chartMode === 'wealth') {
        // Total portfolio: ALWAYS use cost-basis P/L from the dashboard
        // This ensures the chart badge matches the hero P/L display
        displayChangePct = totalPLPct;
    } else {
        // What-if mode: just compute from data
        displayChangePct = firstVal > 0 ? (change / firstVal) * 100 : 0;
    }

    const isUp = displayChangePct >= 0;

    const selectedAsset = assets.find((a) => a.id === selectedAssetId);

    return (
        <div className="glass-card" style={{ padding: 20 }}>
            {/* ── Mode Toggle (top level) ── */}
            <div style={{
                display: 'flex', gap: 3,
                background: 'var(--bg-elevated)', borderRadius: 12, padding: 3,
                marginBottom: 14,
            }}>
                <button
                    onClick={() => setChartMode('wealth')}
                    style={{
                        flex: 1, padding: '8px 0', borderRadius: 10,
                        border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.25s',
                        background: chartMode === 'wealth'
                            ? 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))'
                            : 'transparent',
                        color: chartMode === 'wealth' ? '#fff' : 'var(--text-muted)',
                        boxShadow: chartMode === 'wealth' ? '0 2px 12px rgba(139, 92, 246, 0.3)' : 'none',
                    }}
                >
                    📈 Servet Grafiği
                </button>
                <button
                    onClick={() => setChartMode('whatif')}
                    style={{
                        flex: 1, padding: '8px 0', borderRadius: 10,
                        border: 'none', fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', transition: 'all 0.25s',
                        background: chartMode === 'whatif'
                            ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                            : 'transparent',
                        color: chartMode === 'whatif' ? '#fff' : 'var(--text-muted)',
                        boxShadow: chartMode === 'whatif' ? '0 2px 12px rgba(245, 158, 11, 0.3)' : 'none',
                    }}
                >
                    🕰️ Geçmişte Olsaydı?
                </button>
            </div>

            {/* ── WHAT-IF MODE ── */}
            {chartMode === 'whatif' ? (
                <div style={{ position: 'relative' }}>
                    {isWhatIfLoading && (
                        <div style={{ position: 'absolute', top: 100, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                            <span style={{ background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 20, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>Hesaplanıyor...</span>
                        </div>
                    )}

                    {/* Time period pills specifically for What-If to allow switching periods quickly */}
                    <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
                        {(['1m', '1y', 'all'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                style={{
                                    background: period === p ? 'var(--accent-purple)' : 'var(--bg-elevated)',
                                    color: period === p ? '#fff' : 'var(--text-muted)',
                                    border: 'none', padding: '4px 12px', fontSize: 11, fontWeight: 600,
                                    borderRadius: 8, cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                {p === '1m' ? '1 Ay' : p === '1y' ? '1 Yıl' : 'Maksimum (3 Yıl)'}
                            </button>
                        ))}
                    </div>

                    <WhatIfView data={displayData} currentTotal={convert(currentTotal)} history={history} assets={assets} fmt={fmt} />
                </div>
            ) : (
                /* ── NORMAL WEALTH MODE ── */
                <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                                {selectedAsset ? `📊 ${selectedAsset.name}` : '📈 Servet Geçmişi'}
                            </h3>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {displayData.length} veri noktası
                                {selectedAsset && ` · ${selectedAsset.name}`}
                            </p>
                        </div>
                        <span style={{
                            fontSize: 12, fontWeight: 600, padding: '4px 10px',
                            borderRadius: 100,
                            background: isUp ? 'rgba(0, 230, 138, 0.1)' : 'rgba(255, 77, 106, 0.1)',
                            color: isUp ? 'var(--accent-green)' : 'var(--accent-red)',
                        }}>
                            {isUp ? '▲' : '▼'} {displayChangePct >= 0 ? '+' : ''}{displayChangePct.toFixed(2)}%
                        </span>
                    </div>

                    {isApiLoading && selectedAssetId && (
                        <div style={{ position: 'absolute', top: 120, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                            <span style={{ background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 20, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>Yükleniyor...</span>
                        </div>
                    )}

                    {/* Controls Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14, alignItems: 'center' }}>
                        {/* Time period pills */}
                        <div style={{ display: 'flex', gap: 2, background: 'var(--bg-elevated)', borderRadius: 8, padding: 2 }}>
                            {(['4h', '1w', '1m', '1y', 'all'] as const).map((p) => {
                                const isHourlyPeriod = p === '4h' || p === '1w';
                                const disabled = isHourlyPeriod && !!selectedAssetId;
                                return (
                                    <button
                                        key={p}
                                        onClick={() => !disabled && setPeriod(p)}
                                        disabled={disabled}
                                        title={disabled ? 'Bireysel varlık için yalnızca günlük veri mevcuttur' : undefined}
                                        style={{
                                            background: period === p ? (isUp ? 'var(--accent-green)' : 'var(--accent-red)') : 'transparent',
                                            color: period === p ? '#fff' : 'var(--text-muted)',
                                            border: 'none', padding: '4px 10px', fontSize: 10, fontWeight: 600,
                                            borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                                            textTransform: 'uppercase', letterSpacing: 0.5,
                                            opacity: disabled ? 0.35 : 1,
                                        }}
                                    >
                                        {p === '4h' ? '4S' : p === '1w' ? '1H' : p === '1m' ? '1A' : p === '1y' ? '1Y' : 'Tümü'}
                                    </button>
                                );
                            })}
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
                                onChange={(e) => {
                                    const newVal = e.target.value;
                                    setSelectedAssetId(newVal);
                                    // Auto-switch away from hourly periods when selecting an asset
                                    if (newVal && (period === '4h' || period === '1w')) {
                                        setPeriod('1m');
                                    }
                                }}
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
                            <CandlestickChart data={displayData} isUp={isUp} fmt={fmt} />
                        ) : (
                            <AreaChartView data={displayData} isUp={isUp} isAsset={!!selectedAssetId} fmt={fmt} costLine={!selectedAssetId && totalCost > 0 ? convert(totalCost) : undefined} />
                        )}
                    </ResponsiveContainer>

                    {/* Current value bar */}
                    {displayData.length > 0 && (
                        <div style={{
                            display: 'flex', justifyContent: 'space-between', marginTop: 12,
                            padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8,
                            fontSize: 11, color: 'var(--text-muted)',
                        }}>
                            <span>En Düşük: <b style={{ color: 'var(--accent-red)' }}>{fmt(Math.min(...displayData.map((d) => d.low ?? d.value ?? 0)))}</b></span>
                            <span>En Yüksek: <b style={{ color: 'var(--accent-green)' }}>{fmt(Math.max(...displayData.map((d) => d.high ?? d.value ?? 0)))}</b></span>
                        </div>
                    )}
                </>
            )
            }
        </div >
    );
}

// ============ WHAT-IF VIEW ============

function WhatIfView({ data, currentTotal, history, assets, fmt }: {
    data: ChartPoint[];
    currentTotal: number;
    history: WealthSnapshot[];
    assets: Asset[];
    fmt: (v: number) => string;
}) {
    if (data.length < 2) {
        return (
            <div style={{ padding: 24, textAlign: 'center' }}>
                <p style={{ fontSize: 36, marginBottom: 8 }}>🕰️</p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                    "Geçmişte Olsaydı?" grafiği için en az 2 geçmiş veri noktası gerekiyor.
                    <br />
                    Portföy verileri biriktikçe bu grafik otomatik oluşacak.
                </p>
            </div>
        );
    }

    // Find earliest value vs current
    const earliestVal = data[0]?.pastValue ?? 0;
    const changeFromPast = currentTotal - earliestVal;
    const changePctFromPast = earliestVal > 0 ? (changeFromPast / earliestVal) * 100 : 0;
    const isGrowth = changeFromPast >= 0;

    // Fun stats
    const pastValues = data.map(d => d.pastValue ?? 0).filter(v => v > 0);
    const minPast = pastValues.length > 0 ? Math.min(...pastValues) : 0;
    const maxPast = pastValues.length > 0 ? Math.max(...pastValues) : 0;
    const minDate = data.find(d => (d.pastValue ?? 0) === minPast)?.label ?? '';
    const maxDate = data.find(d => (d.pastValue ?? 0) === maxPast)?.label ?? '';

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: 10, padding: '10px 14px', fontSize: 12,
                }}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
                    {payload.map((p: any, i: number) => (
                        <p key={i} style={{ color: p.color, fontWeight: 600, fontSize: 13 }}>
                            {p.name}: {fmt(p.value)}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div>
            {/* Fun Header */}
            <div style={{ marginBottom: 14 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    🕰️ Portföyün Zaman Makinesi
                </h3>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Bugünkü portföyün geçmişteki fiyatlarla ne ederdi?
                </p>
            </div>

            {/* Change Badge */}
            <div style={{
                display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap',
            }}>
                <span style={{
                    fontSize: 11, fontWeight: 700, padding: '5px 12px',
                    borderRadius: 100,
                    background: isGrowth ? 'rgba(0, 230, 138, 0.1)' : 'rgba(255, 77, 106, 0.1)',
                    color: isGrowth ? 'var(--accent-green)' : 'var(--accent-red)',
                }}>
                    {isGrowth ? '📈' : '📉'} {changePctFromPast >= 0 ? '+' : ''}{changePctFromPast.toFixed(1)}% değişim
                </span>
                <span style={{
                    fontSize: 11, fontWeight: 600, padding: '5px 12px',
                    borderRadius: 100, background: 'rgba(245, 158, 11, 0.1)',
                    color: '#f59e0b',
                }}>
                    🕰️ {data.length} gün geriye bakış
                </span>
            </div>

            {/* Chart — dual area: current (flat line) vs past value */}
            <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="whatifGradPast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="whatifGradNow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: 'var(--text-muted)', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                        type="monotone" dataKey="pastValue" name="Geçmiş Değer"
                        stroke="#f59e0b" strokeWidth={2}
                        fill="url(#whatifGradPast)"
                        dot={false} activeDot={{ r: 4, fill: '#f59e0b' }}
                        animationDuration={600}
                    />
                    <Area
                        type="monotone" dataKey="currentValue" name="Güncel Değer"
                        stroke="#a78bfa" strokeWidth={2} strokeDasharray="6 3"
                        fill="url(#whatifGradNow)"
                        dot={false} activeDot={{ r: 4, fill: '#a78bfa' }}
                        animationDuration={600}
                    />
                    <Legend
                        verticalAlign="top" height={28}
                        formatter={(value: string) => <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{value}</span>}
                    />
                </AreaChart>
            </ResponsiveContainer>

            {/* Fun stats bar */}
            <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14,
            }}>
                <div style={{
                    padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10,
                    border: '1px solid rgba(245, 158, 11, 0.15)',
                }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>📉 En Düşük Olduğu Gün</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-red)' }}>{fmt(minPast)}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{minDate}</p>
                </div>
                <div style={{
                    padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10,
                    border: '1px solid rgba(0, 230, 138, 0.15)',
                }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 2 }}>📈 En Yüksek Olduğu Gün</p>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-green)' }}>{fmt(maxPast)}</p>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>{maxDate}</p>
                </div>
            </div>

            {/* Fun insight */}
            <div style={{
                marginTop: 12, padding: '10px 14px', background: 'var(--bg-elevated)', borderRadius: 10,
                fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                border: '1px solid rgba(167, 139, 250, 0.15)',
            }}>
                {isGrowth ? (
                    <>💡 <b>İyi haber!</b> Portföyünüz geçmişe göre <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>{changePctFromPast.toFixed(1)}%</span> değer kazanmış. Yatırımlarınız doğru yolda!</>
                ) : (
                    <>💡 Portföyündeki varlıklar geçmişte daha <span style={{ color: 'var(--accent-red)', fontWeight: 700 }}>yüksek</span> fiyatlardaydı. Ama endişelenme, piyasalar döngüseldir! 🔄</>
                )}
            </div>
        </div>
    );
}

// ============ SUB COMPONENTS ============

function AreaChartView({ data, isUp, isAsset, fmt, costLine }: { data: ChartPoint[]; isUp: boolean; isAsset: boolean; fmt: (v: number) => string; costLine?: number }) {
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
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{fmt(payload[0].value)}</p>
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
            {costLine !== undefined && (
                <ReferenceLine
                    y={costLine}
                    stroke="#a78bfa"
                    strokeDasharray="6 3"
                    strokeWidth={1.5}
                    label={{ value: 'Maliyet', position: 'insideTopRight', fill: '#a78bfa', fontSize: 10, fontWeight: 600 }}
                />
            )}
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
function CandlestickChart({ data, isUp: _isUp, fmt }: { data: ChartPoint[]; isUp: boolean; fmt: (v: number) => string }) {
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
                        <span style={{ fontWeight: 600 }}>{fmt(d.open)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Kapanış:</span>
                        <span style={{ fontWeight: 600 }}>{fmt(d.close)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Yüksek:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-green)' }}>{fmt(d.high)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Düşük:</span>
                        <span style={{ fontWeight: 600, color: 'var(--accent-red)' }}>{fmt(d.low)}</span>
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
    // What-if fields
    pastValue?: number;
    currentValue?: number;
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
