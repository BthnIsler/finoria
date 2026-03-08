'use client';

import React, { useState, useEffect, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConvertibleAsset {
    id: string;
    label: string;
    symbol: string;
    icon: string;
    group: string;
}

const ASSETS: ConvertibleAsset[] = [
    // Currencies
    { id: 'TRY', label: 'Türk Lirası', symbol: '₺', icon: '🇹🇷', group: 'Döviz' },
    { id: 'USD', label: 'Amerikan Doları', symbol: '$', icon: '🇺🇸', group: 'Döviz' },
    { id: 'EUR', label: 'Euro', symbol: '€', icon: '🇪🇺', group: 'Döviz' },
    { id: 'GBP', label: 'İngiliz Sterlini', symbol: '£', icon: '🇬🇧', group: 'Döviz' },
    { id: 'CHF', label: 'İsviçre Frangı', symbol: 'Fr', icon: '🇨🇭', group: 'Döviz' },
    { id: 'JPY', label: 'Japon Yeni', symbol: '¥', icon: '🇯🇵', group: 'Döviz' },
    { id: 'SAR', label: 'Suudi Riyali', symbol: 'ر.س', icon: '🇸🇦', group: 'Döviz' },
    { id: 'AED', label: 'BAE Dirhemi', symbol: 'د.إ', icon: '🇦🇪', group: 'Döviz' },
    // Gold
    { id: 'XAU_GRAM', label: 'Altın (gram)', symbol: 'g', icon: '🥇', group: 'Değerli Maden' },
    { id: 'XAU_OZ', label: 'Altın (ons)', symbol: 'oz', icon: '🥇', group: 'Değerli Maden' },
    { id: 'XAG_GRAM', label: 'Gümüş (gram)', symbol: 'g', icon: '🥈', group: 'Değerli Maden' },
    // Crypto
    { id: 'BTC', label: 'Bitcoin', symbol: '₿', icon: '🟠', group: 'Kripto' },
    { id: 'ETH', label: 'Ethereum', symbol: 'Ξ', icon: '💎', group: 'Kripto' },
    { id: 'USDT', label: 'Tether', symbol: '₮', icon: '🟢', group: 'Kripto' },
    { id: 'BNB', label: 'BNB', symbol: 'BNB', icon: '🔶', group: 'Kripto' },
];

type Rates = Record<string, number>; // all rates in TRY

async function fetchRates(): Promise<Rates> {
    // Fetch all needed rates from existing endpoints
    const rates: Rates = { TRY: 1 };
    try {
        // Forex rates
        // We use ExchangeRate-API directly for forex spot rates instead of historical-prices

        // Fetch USD/TRY from a public free API
        const usdRes = await fetch('https://api.exchangerate-api.com/v4/latest/USD').catch(() => null);
        if (usdRes?.ok) {
            const usdData = await usdRes.json();
            const usdToTry = usdData.rates?.TRY || 38;
            rates['USD'] = usdToTry;
            rates['EUR'] = usdToTry / (usdData.rates?.EUR || 1) * (1 / (1 / usdData.rates?.EUR || 1));
            // Compute each rate in TRY
            const baseRates = usdData.rates as Record<string, number>;
            ['EUR', 'GBP', 'CHF', 'JPY', 'SAR', 'AED'].forEach(cur => {
                if (baseRates[cur]) {
                    rates[cur] = usdToTry / baseRates[cur];
                }
            });
        }

        // Gold prices (XAU in USD)
        const goldRes = await fetch('https://api.metals.live/v1/spot/gold').catch(() => null);
        if (goldRes?.ok) {
            const goldData = await goldRes.json();
            // metals.live returns price per troy oz in USD
            const goldUsdOz = goldData[0]?.price || 3000;
            const goldTRYOz = goldUsdOz * (rates['USD'] || 38);
            rates['XAU_OZ'] = goldTRYOz;
            rates['XAU_GRAM'] = goldTRYOz / 31.1034768; // grams per troy oz
        }

        // Silver
        const silverRes = await fetch('https://api.metals.live/v1/spot/silver').catch(() => null);
        if (silverRes?.ok) {
            const silverData = await silverRes.json();
            const silverUsdOz = silverData[0]?.price || 32;
            const silverTRYOz = silverUsdOz * (rates['USD'] || 38);
            rates['XAG_GRAM'] = silverTRYOz / 31.1034768;
        }

        // Crypto rates (via CoinGecko)
        const cryptoRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether,binancecoin&vs_currencies=try').catch(() => null);
        if (cryptoRes?.ok) {
            const cryptoData = await cryptoRes.json();
            rates['BTC'] = cryptoData.bitcoin?.try || 0;
            rates['ETH'] = cryptoData.ethereum?.try || 0;
            rates['USDT'] = cryptoData.tether?.try || 0;
            rates['BNB'] = cryptoData.binancecoin?.try || 0;
        }
    } catch (e) {
        console.error('[Converter] rate fetch error', e);
    }
    return rates;
}

// ── Converter Page ─────────────────────────────────────────────────────────────

export default function ConverterPage() {
    const [rates, setRates] = useState<Rates>({ TRY: 1 });
    const [loading, setLoading] = useState(true);
    const [fromId, setFromId] = useState('USD');
    const [toId, setToId] = useState('TRY');
    const [amount, setAmount] = useState('1');
    const [lastUpdated, setLastUpdated] = useState('');

    const loadRates = useCallback(async () => {
        setLoading(true);
        const r = await fetchRates();
        setRates(r);
        setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
        setLoading(false);
    }, []);

    useEffect(() => { loadRates(); }, [loadRates]);

    const fromRate = rates[fromId] || 1; // TRY per 1 unit of fromId
    const toRate = rates[toId] || 1;   // TRY per 1 unit of toId
    const amountNum = parseFloat(amount) || 0;
    const result = (amountNum * fromRate) / toRate;

    const swap = () => {
        setFromId(toId);
        setToId(fromId);
    };

    const fromAsset = ASSETS.find(a => a.id === fromId)!;
    const toAsset = ASSETS.find(a => a.id === toId)!;

    const fmtResult = (n: number) => {
        if (!isFinite(n) || isNaN(n)) return '—';
        if (n < 0.0001 && n > 0) return n.toExponential(4);
        if (n > 1000000) return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n);
        if (n > 100) return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(n);
        return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 6 }).format(n);
    };

    // Quick amount presets
    const quickAmounts = fromId.includes('BTC') ? [0.001, 0.01, 0.1, 1] : [100, 500, 1000, 5000, 10000];

    // Groups for select
    const groups = [...new Set(ASSETS.map(a => a.group))];

    return (
        <div style={{ minHeight: '100vh', padding: '28px 20px', maxWidth: 600, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
                    💱 Hızlı Çevirici
                </h1>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Döviz, Altın ve Kripto Para çeviri aracı
                    {lastUpdated && ` · Güncellendi: ${lastUpdated}`}
                </p>
            </div>

            {/* Main converter card */}
            <div style={{
                background: 'var(--bg-elevated)',
                borderRadius: 20, border: '1px solid var(--border)',
                overflow: 'hidden', marginBottom: 16,
            }}>
                {/* From */}
                <div style={{ padding: '20px 20px 10px' }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Kaynak
                    </label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                        <select
                            value={fromId}
                            onChange={e => setFromId(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '10px 12px', borderRadius: 10,
                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                                outline: 'none', cursor: 'pointer',
                            }}
                        >
                            {groups.map(group => (
                                <optgroup key={group} label={group}>
                                    {ASSETS.filter(a => a.group === group).map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.icon} {a.label} ({a.symbol})
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        <input
                            type="number"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            style={{
                                width: 130, padding: '10px 12px', borderRadius: 10,
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 15, fontWeight: 700,
                                outline: 'none', textAlign: 'right',
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--accent-purple)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>
                </div>

                {/* Swap button (divider) */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '4px 20px' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                    <button
                        onClick={swap}
                        style={{
                            width: 32, height: 32,
                            borderRadius: '50%', border: '1px solid var(--border)',
                            background: 'var(--bg-primary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 15, transition: 'all 0.15s', margin: '0 12px',
                            color: 'var(--text-muted)',
                        }}
                        onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent-purple)'; e.currentTarget.style.color = 'var(--accent-purple)'; }}
                        onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        title="Çevir"
                    >
                        ⇅
                    </button>
                    <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>

                {/* To */}
                <div style={{ padding: '10px 20px 20px' }}>
                    <label style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                        Hedef
                    </label>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
                        <select
                            value={toId}
                            onChange={e => setToId(e.target.value)}
                            style={{
                                flex: 1,
                                padding: '10px 12px', borderRadius: 10,
                                background: 'var(--bg-primary)', border: '1px solid var(--border)',
                                color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
                                outline: 'none', cursor: 'pointer',
                            }}
                        >
                            {groups.map(group => (
                                <optgroup key={group} label={group}>
                                    {ASSETS.filter(a => a.group === group).map(a => (
                                        <option key={a.id} value={a.id}>
                                            {a.icon} {a.label} ({a.symbol})
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        {/* Result */}
                        <div style={{
                            width: 130, padding: '10px 12px', borderRadius: 10,
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.12), rgba(34,211,238,0.08))',
                            border: '1px solid rgba(139,92,246,0.2)',
                            textAlign: 'right',
                        }}>
                            {loading ? (
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 2 }}>Yükleniyor...</div>
                            ) : (
                                <div>
                                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-purple)' }}>
                                        {fmtResult(result)}
                                    </div>
                                    <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 1 }}>
                                        {toAsset?.symbol}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick amounts */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
                {quickAmounts.map(qa => (
                    <button
                        key={qa}
                        onClick={() => setAmount(qa.toString())}
                        style={{
                            flex: 1, padding: '8px 4px', borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: parseFloat(amount) === qa ? 'var(--accent-purple)' : 'var(--bg-elevated)',
                            border: '1px solid',
                            borderColor: parseFloat(amount) === qa ? 'var(--accent-purple)' : 'var(--border)',
                            color: parseFloat(amount) === qa ? '#fff' : 'var(--text-muted)',
                            cursor: 'pointer', transition: 'all 0.15s',
                        }}
                    >
                        {qa.toLocaleString('tr-TR')}
                    </button>
                ))}
            </div>

            {/* Rate info */}
            {!loading && fromRate > 0 && toRate > 0 && (
                <div style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 12, border: '1px solid var(--border)',
                    padding: '14px 16px',
                    display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                    <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        Güncel Kurlar
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            1 {fromAsset?.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            = {fmtResult(fromRate / toRate)} {toAsset?.symbol}
                        </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                            1 {toAsset?.label}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                            = {fmtResult(toRate / fromRate)} {fromAsset?.symbol}
                        </span>
                    </div>
                </div>
            )}

            {/* Refresh */}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
                <button
                    onClick={loadRates}
                    disabled={loading}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        fontSize: 11, color: 'var(--text-muted)',
                        fontWeight: 600, display: 'flex', alignItems: 'center',
                        gap: 4, margin: '0 auto', opacity: loading ? 0.5 : 1,
                    }}
                >
                    {loading ? '⏳ Güncelleniyor...' : '↻ Kurları Yenile'}
                </button>
            </div>
        </div>
    );
}
