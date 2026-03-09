'use client';

import React, { useState, useCallback, useEffect } from 'react';

// ────────────────────────────────────────────────────────────
// Currency / asset data
// ────────────────────────────────────────────────────────────
interface ConvAsset {
    id: string;
    label: string;
    symbol: string;
    flag?: string;
    category: 'crypto' | 'forex' | 'metal';
    coingeckoId?: string;
}

const ASSETS: ConvAsset[] = [
    // Crypto
    { id: 'bitcoin', label: 'Bitcoin', symbol: 'BTC', flag: '₿', category: 'crypto', coingeckoId: 'bitcoin' },
    { id: 'ethereum', label: 'Ethereum', symbol: 'ETH', flag: 'Ξ', category: 'crypto', coingeckoId: 'ethereum' },
    { id: 'tether', label: 'Tether', symbol: 'USDT', flag: '₮', category: 'crypto', coingeckoId: 'tether' },
    { id: 'solana', label: 'Solana', symbol: 'SOL', flag: '◎', category: 'crypto', coingeckoId: 'solana' },
    // Forex
    { id: 'USD', label: 'Amerikan Doları', symbol: 'USD', flag: '🇺🇸', category: 'forex' },
    { id: 'EUR', label: 'Euro', symbol: 'EUR', flag: '🇪🇺', category: 'forex' },
    { id: 'GBP', label: 'İngiliz Sterlini', symbol: 'GBP', flag: '🇬🇧', category: 'forex' },
    { id: 'TRY', label: 'Türk Lirası', symbol: 'TRY', flag: '🇹🇷', category: 'forex' },
    { id: 'CHF', label: 'İsviçre Frangı', symbol: 'CHF', flag: '🇨🇭', category: 'forex' },
    { id: 'JPY', label: 'Japon Yeni', symbol: 'JPY', flag: '🇯🇵', category: 'forex' },
    // Metals
    { id: 'gold', label: 'Altın (gram)', symbol: 'XAU/g', flag: '🥇', category: 'metal', coingeckoId: 'tether-gold' },
    { id: 'silver', label: 'Gümüş (gram)', symbol: 'XAG/g', flag: '🥈', category: 'metal' },
];

const CATEGORY_COLORS: Record<ConvAsset['category'], string> = {
    crypto: '#a78bfa',
    forex: '#60a5fa',
    metal: '#fbbf24',
};

const CATEGORY_LABELS: Record<ConvAsset['category'], string> = {
    crypto: 'Kripto',
    forex: 'Döviz',
    metal: 'Değerli Maden',
};

// ────────────────────────────────────────────────────────────
// Rate fetching
// ────────────────────────────────────────────────────────────
type RateMap = Record<string, number>; // id -> TRY price

async function fetchRates(): Promise<RateMap> {
    const rates: RateMap = {};

    try {
        // 1. Crypto via CoinGecko
        const cryptoIds = ASSETS.filter(a => a.coingeckoId && a.category === 'crypto').map(a => a.coingeckoId).join(',');
        const cRes = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=try`);
        if (cRes.ok) {
            const cData = await cRes.json();
            ASSETS.forEach(a => {
                if (a.coingeckoId && a.category === 'crypto' && cData[a.coingeckoId]?.try) {
                    rates[a.id] = cData[a.coingeckoId].try;
                }
            });
        }

        // 2. Gold via CoinGecko (tether-gold = 1 troy oz)
        const gRes = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=tether-gold&vs_currencies=try');
        if (gRes.ok) {
            const gData = await gRes.json();
            if (gData['tether-gold']?.try) {
                rates['gold'] = gData['tether-gold'].try / 31.1035;
            }
        }

        // 3. Forex via exchangerate-api
        const fRes = await fetch('https://api.exchangerate-api.com/v4/latest/TRY');
        if (fRes.ok) {
            const fData = await fRes.json();
            if (fData.rates) {
                ['USD', 'EUR', 'GBP', 'CHF', 'JPY'].forEach(cur => {
                    if (fData.rates[cur]) rates[cur] = 1 / fData.rates[cur];
                });
                rates['TRY'] = 1;
                // Silver approx (fallback)
                if (fData.rates.USD && rates['USD']) {
                    // Approx silver ~$32/oz → gram
                    rates['silver'] = (32 * rates['USD']) / 31.1035;
                }
            }
        }
    } catch { /* silent fail */ }

    return rates;
}

// ────────────────────────────────────────────────────────────
// Asset Selector
// ────────────────────────────────────────────────────────────
function AssetSelector({ value, onChange }: { value: string; onChange: (id: string) => void }) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selected = ASSETS.find(a => a.id === value);
    const filtered = ASSETS.filter(a =>
        a.label.toLowerCase().includes(search.toLowerCase()) ||
        a.symbol.toLowerCase().includes(search.toLowerCase())
    );
    const grouped = (['crypto', 'forex', 'metal'] as const).map(cat => ({
        cat, items: filtered.filter(a => a.category === cat)
    })).filter(g => g.items.length > 0);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setOpen(v => !v)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '14px 16px', borderRadius: 14,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', color: '#fff', textAlign: 'left',
                    transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseOver={e => (e.currentTarget.style.borderColor = 'rgba(167,139,250,0.5)')}
                onMouseOut={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            >
                <span style={{ fontSize: 22 }}>{selected?.flag}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{selected?.symbol}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected?.label}</div>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </button>

            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                        background: '#141928', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
                        zIndex: 10, maxHeight: 320, display: 'flex', flexDirection: 'column',
                        backdropFilter: 'blur(20px)',
                    }}>
                        <div style={{ padding: 10 }}>
                            <input
                                autoFocus
                                placeholder="Ara..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{
                                    width: '100%', padding: '8px 12px', borderRadius: 8,
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: 'rgba(255,255,255,0.05)', color: '#fff',
                                    fontSize: 13, outline: 'none', boxSizing: 'border-box',
                                }}
                            />
                        </div>
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {grouped.map(({ cat, items }) => (
                                <div key={cat}>
                                    <div style={{
                                        padding: '6px 14px 4px', fontSize: 10, fontWeight: 700,
                                        color: CATEGORY_COLORS[cat], letterSpacing: 1, textTransform: 'uppercase'
                                    }}>
                                        {CATEGORY_LABELS[cat]}
                                    </div>
                                    {items.map(a => (
                                        <button
                                            key={a.id}
                                            onClick={() => { onChange(a.id); setOpen(false); setSearch(''); }}
                                            style={{
                                                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                                                padding: '9px 14px', border: 'none',
                                                background: value === a.id ? `${CATEGORY_COLORS[a.category]}18` : 'transparent',
                                                cursor: 'pointer', color: '#fff', textAlign: 'left',
                                                transition: 'background 0.1s',
                                            }}
                                            onMouseOver={e => { if (value !== a.id) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                                            onMouseOut={e => { if (value !== a.id) e.currentTarget.style.background = 'transparent'; }}
                                        >
                                            <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{a.flag}</span>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: 13 }}>{a.symbol}</span>
                                                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginLeft: 6 }}>{a.label}</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────
// Quick amount shortcuts
// ────────────────────────────────────────────────────────────
const QUICK_AMOUNTS = [1, 10, 100, 1000, 10000];

// ────────────────────────────────────────────────────────────
// Main View
// ────────────────────────────────────────────────────────────
export default function ConverterView() {
    const [fromId, setFromId] = useState('USD');
    const [toId, setToId] = useState('TRY');
    const [amount, setAmount] = useState('1');
    const [rates, setRates] = useState<RateMap>({});
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState('');

    const loadRates = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetchRates();
            setRates(r);
            setLastUpdated(new Date().toLocaleTimeString('tr-TR'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadRates();
        const id = setInterval(loadRates, 60_000);
        return () => clearInterval(id);
    }, [loadRates]);

    const fromRate = rates[fromId] ?? 1;  // TRY price of 1 unit of FROM
    const toRate = rates[toId] ?? 1;      // TRY price of 1 unit of TO

    const numAmount = parseFloat(amount) || 0;
    const resultTRY = numAmount * fromRate;
    const result = toRate > 0 ? resultTRY / toRate : 0;

    const fromAsset = ASSETS.find(a => a.id === fromId)!;
    const toAsset = ASSETS.find(a => a.id === toId)!;

    const swap = () => {
        setFromId(toId);
        setToId(fromId);
    };

    const formatResult = (n: number) => {
        if (n === 0) return '0';
        if (n < 0.01) return n.toFixed(8);
        if (n < 1) return n.toFixed(6);
        if (n < 1000) return n.toFixed(4);
        return new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    };

    // Popular pairs for quick compare
    const popularPairs = [
        { from: 'USD', to: 'TRY', label: 'Dolar/TL' },
        { from: 'EUR', to: 'TRY', label: 'Euro/TL' },
        { from: 'bitcoin', to: 'TRY', label: 'BTC/TL' },
        { from: 'gold', to: 'TRY', label: 'Altın/TL' },
        { from: 'GBP', to: 'TRY', label: 'Sterlin/TL' },
        { from: 'ethereum', to: 'TRY', label: 'ETH/TL' },
    ];

    return (
        <div style={{ paddingBottom: 40, maxWidth: 800, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', marginBottom: 4, letterSpacing: -0.5 }}>
                    <span style={{ background: 'linear-gradient(135deg, #a78bfa, #60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Hızlı Çevirici</span>
                </h1>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Kripto, döviz ve değerli maden &mdash;
                    {loading ? ' Güncelleniyor...' : `son güncelleme: ${lastUpdated}`}
                    <button onClick={loadRates} title="Yenile" style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', fontSize: 13, padding: 0,
                        display: 'inline-flex', alignItems: 'center',
                    }}>⟳</button>
                </p>
            </div>

            {/* Main Converter Card */}
            <div style={{
                background: 'linear-gradient(145deg, rgba(20,25,45,0.9), rgba(15,19,35,0.95))',
                border: '1px solid rgba(167,139,250,0.2)',
                borderRadius: 24, padding: '28px 28px',
                boxShadow: '0 24px 64px rgba(0,0,0,0.4), 0 0 100px rgba(99,102,241,0.05)',
                marginBottom: 24,
            }}>
                {/* FROM */}
                <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                        Kaynak
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <AssetSelector value={fromId} onChange={setFromId} />
                        <div style={{ position: 'relative' }}>
                            <input
                                type="number" min="0" step="any"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                style={{
                                    width: '100%', padding: '14px 16px', borderRadius: 14,
                                    background: 'rgba(167,139,250,0.08)',
                                    border: '1px solid rgba(167,139,250,0.3)',
                                    color: '#fff', fontSize: 22, fontWeight: 800,
                                    outline: 'none', boxSizing: 'border-box',
                                    fontFamily: 'inherit', textAlign: 'right',
                                }}
                            />
                            <div style={{ position: 'absolute', bottom: -18, right: 0, fontSize: 11, color: CATEGORY_COLORS[fromAsset.category] }}>
                                {fromAsset.symbol}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick amounts */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '22px 0 16px' }}>
                    {QUICK_AMOUNTS.map(q => (
                        <button
                            key={q}
                            onClick={() => setAmount(String(q))}
                            style={{
                                padding: '5px 14px', borderRadius: 8,
                                background: amount === String(q) ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.05)',
                                border: amount === String(q) ? '1px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.08)',
                                color: amount === String(q) ? '#a78bfa' : 'rgba(255,255,255,0.5)',
                                fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                            }}
                        >
                            {q.toLocaleString('tr-TR')}
                        </button>
                    ))}
                </div>

                {/* Swap button */}
                <div style={{ display: 'flex', justifyContent: 'center', margin: '18px 0' }}>
                    <button
                        onClick={swap}
                        style={{
                            width: 48, height: 48, borderRadius: 12,
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
                            border: '1px solid rgba(139,92,246,0.4)',
                            color: '#a78bfa', fontSize: 22, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s', boxShadow: '0 4px 16px rgba(99,102,241,0.2)',
                        }}
                        onMouseOver={e => { (e.currentTarget as HTMLElement).style.transform = 'rotate(180deg) scale(1.1)'; }}
                        onMouseOut={e => { (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                        title="Çevir"
                    >
                        ⇅
                    </button>
                </div>

                {/* TO */}
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>
                        Hedef
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <AssetSelector value={toId} onChange={setToId} />
                        <div style={{
                            padding: '14px 16px', borderRadius: 14,
                            background: 'rgba(16,185,129,0.06)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 900, color: '#10b981', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                                {loading ? '...' : formatResult(result)}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(16,185,129,0.6)', textAlign: 'right', marginTop: 2 }}>
                                {toAsset.symbol}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Exchange rate display */}
                {!loading && fromRate > 0 && toRate > 0 && (
                    <div style={{
                        padding: '12px 16px', borderRadius: 12,
                        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        fontSize: 12,
                    }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)' }}>1 {fromAsset.symbol}</span>
                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 18 }}>=</span>
                        <span style={{ color: '#a78bfa', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                            {formatResult(fromRate / toRate)} {toAsset.symbol}
                        </span>
                    </div>
                )}
            </div>

            {/* Popular Pairs */}
            <div>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 12, letterSpacing: 0.5 }}>
                    POPÜLER KURlar
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                    {popularPairs.map(pair => {
                        const fRate = rates[pair.from] ?? 0;
                        const tRate = rates[pair.to] ?? 1;
                        const pairRate = tRate > 0 ? fRate / tRate : 0;
                        const fAsset = ASSETS.find(a => a.id === pair.from);
                        const tAsset = ASSETS.find(a => a.id === pair.to);
                        return (
                            <button
                                key={pair.label}
                                onClick={() => { setFromId(pair.from); setToId(pair.to); setAmount('1'); }}
                                style={{
                                    padding: '14px 16px', borderRadius: 14,
                                    background: fromId === pair.from && toId === pair.to
                                        ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.03)',
                                    border: fromId === pair.from && toId === pair.to
                                        ? '1px solid rgba(167,139,250,0.35)' : '1px solid rgba(255,255,255,0.06)',
                                    cursor: 'pointer', textAlign: 'left',
                                    transition: 'all 0.15s',
                                }}
                                onMouseOver={e => { if (!(fromId === pair.from && toId === pair.to)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                                onMouseOut={e => { if (!(fromId === pair.from && toId === pair.to)) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{pair.label}</span>
                                    <span style={{ fontSize: 16 }}>{fAsset?.flag}</span>
                                </div>
                                <div style={{ fontSize: 16, fontWeight: 800, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
                                    {loading ? '...' : pairRate > 0 ? formatResult(pairRate) : '—'}
                                </div>
                                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                                    1 {fAsset?.symbol} = x {tAsset?.symbol}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
