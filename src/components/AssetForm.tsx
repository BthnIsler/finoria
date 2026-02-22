'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Asset,
    AssetCategory,
    CATEGORIES,
    POPULAR_CRYPTOS,
    POPULAR_FOREX,
    GOLD_TYPES,
    PRECIOUS_METALS,
} from '@/lib/types';
import { searchStocksLocal, searchStocksAPI, StockItem } from '@/lib/stocks';
import { addAsset } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';

interface AssetFormProps {
    onClose: () => void;
    onAdd: (asset: Asset) => void;
}

export default function AssetForm({ onClose, onAdd }: AssetFormProps) {
    const [step, setStep] = useState<1 | 2>(1);
    const [category, setCategory] = useState<AssetCategory>('crypto');
    const [amount, setAmount] = useState('');
    const [purchasePrice, setPurchasePrice] = useState('');
    const [manualCurrentPrice, setManualCurrentPrice] = useState('');
    const [manualName, setManualName] = useState('');
    const [selectedPreset, setSelectedPreset] = useState('');
    const [selectedName, setSelectedName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const { user } = useAuth();

    // Stock-specific state
    const [stockMarket, setStockMarket] = useState<'BIST' | 'NASDAQ'>('BIST');
    const [stockSearch, setStockSearch] = useState('');
    const [showStockDropdown, setShowStockDropdown] = useState(false);
    const [filteredStocks, setFilteredStocks] = useState<StockItem[]>([]);
    const [searchingAPI, setSearchingAPI] = useState(false);
    const stockDropdownRef = useRef<HTMLDivElement>(null);
    const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Local search (instant)
    useEffect(() => {
        if (category !== 'stock') return;
        setFilteredStocks(searchStocksLocal(stockSearch, stockMarket));
    }, [stockSearch, stockMarket, category]);

    // API search (debounced)
    const searchAPI = useCallback(async (query: string, market: 'BIST' | 'NASDAQ') => {
        if (query.length < 2) return;
        setSearchingAPI(true);
        try {
            const results = await searchStocksAPI(query, market);
            if (results.length > 0) {
                setFilteredStocks((prev) => {
                    const existing = new Set(prev.map((s) => s.symbol));
                    const merged = [...prev];
                    for (const r of results) {
                        if (!existing.has(r.symbol)) merged.push(r);
                    }
                    return merged;
                });
            }
        } finally { setSearchingAPI(false); }
    }, []);

    useEffect(() => {
        if (category !== 'stock' || stockSearch.length < 2) return;
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => searchAPI(stockSearch, stockMarket), 400);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [stockSearch, stockMarket, category, searchAPI]);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (stockDropdownRef.current && !stockDropdownRef.current.contains(e.target as Node)) setShowStockDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handlePresetSelect = (presetId: string, presetName: string) => { setSelectedPreset(presetId); setSelectedName(presetName); };
    const handleGoldSelect = (goldId: string, goldName: string) => { setSelectedPreset(goldId); setSelectedName(goldName); };
    const handleStockSelect = (stock: StockItem) => {
        setSelectedPreset(`${stock.market}:${stock.symbol}`);
        setSelectedName(`${stock.name} (${stock.symbol})`);
        setStockSearch(''); setShowStockDropdown(false);
    };

    const needsManualPrice = category === 'real_estate' || category === 'savings' || category === 'other';
    const needsManualName = category === 'real_estate' || category === 'savings' || category === 'other';
    const currentName = needsManualName ? manualName : selectedName;

    const getApiId = (): string | undefined => {
        if (category === 'gold') return 'gold_gram';
        if (category === 'precious_metals') return selectedPreset ? `metal_${selectedPreset}` : undefined;
        if (needsManualName) return undefined;
        return selectedPreset || undefined;
    };

    // Step 1 is complete when a category item is selected
    const step1Done = needsManualName || !!selectedPreset || (category === 'stock' && !!selectedPreset);
    const canSubmit = currentName && amount && !isSaving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !user) return;
        setIsSaving(true);
        const goldType = GOLD_TYPES.find((g) => g.id === selectedPreset);
        const effectiveAmount = goldType ? parseFloat(amount) * goldType.grams : parseFloat(amount);
        const newAsset = await addAsset(user.id, {
            name: currentName,
            category,
            amount: effectiveAmount,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
            purchaseCurrency: (category === 'stock' && stockMarket === 'NASDAQ') ? 'USD' : 'TRY',
            manualCurrentPrice: manualCurrentPrice ? parseFloat(manualCurrentPrice) : undefined,
            apiId: getApiId(),
        });

        if (newAsset) {
            onAdd(newAsset);
        }
        setIsSaving(false);
        onClose();
    };

    const getPresets = () => {
        switch (category) {
            case 'crypto': return POPULAR_CRYPTOS.map((c) => ({ id: c.id, label: c.symbol, name: c.name, sub: c.name }));
            case 'forex': return POPULAR_FOREX.map((f) => ({ id: f.id, label: `${f.symbol} ${f.id}`, name: f.name, sub: f.name }));
            case 'gold': return GOLD_TYPES.map((g) => ({ id: g.id, label: g.name, name: g.name, sub: `${g.grams}g` }));
            case 'precious_metals': return PRECIOUS_METALS.map((m) => ({ id: m.id, label: m.name, name: m.name, sub: '' }));
            default: return [];
        }
    };

    const presets = getPresets();
    const catMeta = CATEGORIES.find((c) => c.key === category)!;

    // Styles
    const s = {
        overlay: {
            position: 'fixed' as const, inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn 0.2s ease',
        },
        modal: {
            background: 'var(--bg-secondary)', borderRadius: 28,
            maxWidth: 520, width: '92%', maxHeight: '90vh', overflowY: 'auto' as const,
            border: '1px solid var(--glass-border)',
            boxShadow: '0 32px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
            animation: 'slideUp 0.35s cubic-bezier(0.34,1.56,0.64,1)',
        },
        header: {
            padding: '28px 28px 0', position: 'relative' as const,
        },
        headerBar: {
            height: 4, borderRadius: 4,
            background: `linear-gradient(90deg, ${catMeta.color}, var(--accent-cyan), transparent)`,
            marginBottom: 20, transition: 'all 0.4s',
        },
        stepIndicator: {
            display: 'flex', gap: 8, marginBottom: 20,
        },
        stepDot: (active: boolean) => ({
            flex: active ? 3 : 1, height: 4, borderRadius: 4,
            background: active ? catMeta.color : 'var(--border)',
            transition: 'all 0.4s cubic-bezier(0.4,0,0.2,1)',
        }),
        catBtn: (active: boolean, color: string) => ({
            display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 6,
            padding: '14px 8px', borderRadius: 16, cursor: 'pointer',
            background: active ? `${color}15` : 'var(--bg-elevated)',
            border: `2px solid ${active ? color : 'var(--border)'}`,
            color: active ? color : 'var(--text-secondary)',
            transition: 'all 0.25s', minWidth: 0,
        }),
        presetBtn: (active: boolean) => ({
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 14, cursor: 'pointer',
            background: active ? `${catMeta.color}12` : 'var(--bg-elevated)',
            border: `2px solid ${active ? catMeta.color : 'var(--border)'}`,
            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
            transition: 'all 0.2s', fontSize: 13, fontWeight: active ? 600 : 400,
            width: '100%', textAlign: 'left' as const,
        }),
        inputWrap: {
            marginBottom: 18,
        },
        label: {
            fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: 0.8, textTransform: 'uppercase' as const, marginBottom: 8,
            display: 'block',
        },
        input: {
            width: '100%', padding: '14px 16px', borderRadius: 14,
            background: 'var(--bg-elevated)', border: '2px solid var(--border)',
            color: 'var(--text-primary)', fontSize: 14, fontWeight: 500,
            outline: 'none', transition: 'border-color 0.2s',
        },
    };

    return (
        <div style={s.overlay} onClick={onClose}>
            <div style={s.modal} onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={s.header}>
                    <div style={s.headerBar} />

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                        <div>
                            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
                                {step === 1 ? 'Varlık Ekle' : '💰 Detaylar'}
                            </h2>
                            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                {step === 1 ? 'Kategori ve yatırım aracı seçin' : `${catMeta.icon} ${currentName || catMeta.labelTR}`}
                            </p>
                        </div>
                        <button onClick={onClose} style={{
                            background: 'var(--bg-elevated)', border: '2px solid var(--border)',
                            borderRadius: '50%', width: 36, height: 36, display: 'flex',
                            alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                            color: 'var(--text-muted)', fontSize: 16, transition: 'all 0.2s',
                        }}
                            onMouseOver={(e) => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >✕</button>
                    </div>

                    {/* Step indicator */}
                    <div style={s.stepIndicator}>
                        <div style={s.stepDot(step === 1)} />
                        <div style={s.stepDot(step === 2)} />
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '8px 28px 28px' }}>
                    {step === 1 ? (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            {/* Category Grid */}
                            <div style={{ marginBottom: 24 }}>
                                <label style={s.label}>Kategori</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 8 }}>
                                    {CATEGORIES.map((cat) => (
                                        <button
                                            key={cat.key} type="button"
                                            style={s.catBtn(category === cat.key, cat.color)}
                                            onClick={() => { setCategory(cat.key); setSelectedPreset(''); setSelectedName(''); setManualName(''); setStockSearch(''); }}
                                        >
                                            <span style={{ fontSize: 24 }}>{cat.icon}</span>
                                            <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', letterSpacing: 0.3 }}>{cat.labelTR}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Stock Market Selector */}
                            {category === 'stock' && (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={s.label}>Borsa</label>
                                    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                                        {(['BIST', 'NASDAQ'] as const).map((m) => (
                                            <button key={m} type="button"
                                                style={{
                                                    ...s.presetBtn(stockMarket === m),
                                                    flex: 1, justifyContent: 'center', padding: '14px 16px', fontSize: 14, fontWeight: 700,
                                                }}
                                                onClick={() => { setStockMarket(m); setSelectedPreset(''); setSelectedName(''); setStockSearch(''); }}
                                            >
                                                {m === 'BIST' ? '🇹🇷 BIST' : '🇺🇸 NASDAQ / US'}
                                            </button>
                                        ))}
                                    </div>

                                    <div style={{ position: 'relative' }} ref={stockDropdownRef}>
                                        <input type="text" style={s.input}
                                            placeholder={`${stockMarket} hissesi ara... (ör: ${stockMarket === 'BIST' ? 'THYAO, Garanti' : 'AAPL, Tesla'})`}
                                            value={selectedName || stockSearch}
                                            onChange={(e) => { setStockSearch(e.target.value); setSelectedName(''); setSelectedPreset(''); setShowStockDropdown(true); }}
                                            onFocus={() => setShowStockDropdown(true)}
                                        />
                                        {searchingAPI && (
                                            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--accent-cyan)' }}>
                                                ⏳ Aranıyor...
                                            </span>
                                        )}
                                        {showStockDropdown && filteredStocks.length > 0 && (
                                            <div style={{
                                                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                                                background: 'var(--bg-card)', border: '2px solid var(--border)',
                                                borderRadius: 16, marginTop: 6, maxHeight: 260, overflowY: 'auto',
                                                boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
                                            }}>
                                                {filteredStocks.slice(0, 30).map((stock) => (
                                                    <div key={`${stock.market}:${stock.symbol}`}
                                                        onClick={() => handleStockSelect(stock)}
                                                        style={{
                                                            padding: '12px 16px', cursor: 'pointer', display: 'flex',
                                                            justifyContent: 'space-between', alignItems: 'center',
                                                            borderBottom: '1px solid var(--border)', transition: 'background 0.15s',
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-elevated)'}
                                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                                    >
                                                        <div>
                                                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 14 }}>{stock.symbol}</span>
                                                            <span style={{ color: 'var(--text-muted)', marginLeft: 10, fontSize: 12 }}>{stock.name}</span>
                                                        </div>
                                                        <span style={{
                                                            fontSize: 10, color: 'var(--text-muted)',
                                                            background: 'var(--bg-primary)', padding: '3px 10px',
                                                            borderRadius: 8, fontWeight: 600,
                                                        }}>{stock.market}</span>
                                                    </div>
                                                ))}
                                                {searchingAPI && (
                                                    <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, color: 'var(--accent-cyan)' }}>
                                                        ⏳ Daha fazla hisse aranıyor...
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Presets (crypto, forex, gold, metals) */}
                            {presets.length > 0 && (
                                <div style={{ marginBottom: 20 }}>
                                    <label style={s.label}>
                                        {category === 'crypto' ? 'Kripto Para Seçin'
                                            : category === 'forex' ? 'Döviz Seçin'
                                                : category === 'gold' ? 'Altın Türü'
                                                    : category === 'precious_metals' ? 'Değerli Maden'
                                                        : 'Seçin'}
                                    </label>
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: presets.length > 6 ? 'repeat(auto-fill, minmax(140px, 1fr))' : '1fr 1fr',
                                        gap: 8, maxHeight: 280, overflowY: 'auto',
                                    }}>
                                        {presets.map((p) => (
                                            <button key={p.id} type="button"
                                                style={s.presetBtn(selectedPreset === p.id)}
                                                onClick={() => category === 'gold' ? handleGoldSelect(p.id, p.name) : handlePresetSelect(p.id, p.name)}
                                            >
                                                <span>{p.label}</span>
                                                {p.sub && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{p.sub}</span>}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Manual name for manual categories */}
                            {needsManualName && (
                                <div style={s.inputWrap}>
                                    <label style={s.label}>Varlık Adı</label>
                                    <input type="text" style={s.input}
                                        placeholder={category === 'real_estate' ? 'ör: İstanbul Daire' : 'ör: Vadeli Mevduat'}
                                        value={manualName} onChange={(e) => setManualName(e.target.value)} required />
                                </div>
                            )}

                            {/* Next button */}
                            <button type="button"
                                onClick={() => setStep(2)}
                                disabled={!step1Done}
                                style={{
                                    width: '100%', padding: '16px', borderRadius: 16,
                                    background: step1Done ? `linear-gradient(135deg, ${catMeta.color}, var(--accent-cyan))` : 'var(--bg-elevated)',
                                    color: step1Done ? 'white' : 'var(--text-muted)',
                                    border: 'none', fontSize: 14, fontWeight: 700,
                                    cursor: step1Done ? 'pointer' : 'not-allowed',
                                    opacity: step1Done ? 1 : 0.5,
                                    transition: 'all 0.3s', marginTop: 8,
                                    boxShadow: step1Done ? `0 4px 20px ${catMeta.color}33` : 'none',
                                    letterSpacing: 0.5,
                                }}
                            >
                                Devam →
                            </button>
                        </div>
                    ) : (
                        <div style={{ animation: 'fadeIn 0.3s ease' }}>
                            {/* Back button */}
                            <button type="button" onClick={() => setStep(1)}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--accent-cyan)',
                                    fontSize: 13, cursor: 'pointer', marginBottom: 16,
                                    display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600,
                                    padding: 0,
                                }}
                            >← Geri Dön</button>

                            {/* Selected asset summary */}
                            <div style={{
                                background: `${catMeta.color}08`, border: `2px solid ${catMeta.color}20`,
                                borderRadius: 16, padding: '14px 18px', marginBottom: 24,
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <span style={{ fontSize: 28 }}>{catMeta.icon}</span>
                                <div>
                                    <p style={{ fontWeight: 700, fontSize: 14 }}>{currentName}</p>
                                    <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{catMeta.labelTR}</p>
                                </div>
                            </div>

                            {/* Amount & Price inputs */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                                <div>
                                    <label style={s.label}>
                                        {category === 'gold' && selectedPreset ? 'Adet'
                                            : category === 'stock' ? 'Lot / Adet'
                                                : category === 'precious_metals' ? 'Gram' : 'Miktar'}
                                    </label>
                                    <input type="number" style={s.input}
                                        placeholder={category === 'gold' ? '5' : category === 'stock' ? '100' : '0.5'}
                                        value={amount} onChange={(e) => setAmount(e.target.value)} step="any" min="0" required
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label style={s.label}>Alış Fiyatı ({category === 'stock' && stockMarket === 'NASDAQ' ? '$' : '₺'})</label>
                                    <input type="number" style={s.input}
                                        placeholder="Birim fiyat"
                                        value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} step="any" min="0" />
                                </div>
                            </div>

                            {/* Manual current price */}
                            {needsManualPrice && (
                                <div style={s.inputWrap}>
                                    <label style={s.label}>Güncel Değer (₺/birim)</label>
                                    <input type="number" style={s.input}
                                        placeholder="Şu anki birim fiyat"
                                        value={manualCurrentPrice} onChange={(e) => setManualCurrentPrice(e.target.value)} step="any" min="0" />
                                </div>
                            )}

                            {/* Submit buttons */}
                            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
                                <button type="button" onClick={onClose}
                                    style={{
                                        flex: 1, padding: '14px', borderRadius: 14,
                                        background: 'var(--bg-elevated)', border: '2px solid var(--border)',
                                        color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600,
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >İptal</button>
                                <button type="submit" disabled={!canSubmit}
                                    style={{
                                        flex: 2, padding: '14px', borderRadius: 14,
                                        background: canSubmit ? `linear-gradient(135deg, ${catMeta.color}, var(--accent-cyan))` : 'var(--bg-elevated)',
                                        color: canSubmit ? 'white' : 'var(--text-muted)',
                                        border: 'none', fontSize: 14, fontWeight: 700,
                                        cursor: canSubmit ? 'pointer' : 'not-allowed',
                                        opacity: canSubmit ? 1 : 0.5,
                                        transition: 'all 0.3s',
                                        boxShadow: canSubmit ? `0 4px 20px ${catMeta.color}33` : 'none',
                                        letterSpacing: 0.5,
                                    }}
                                >＋ Portföye Ekle</button>
                            </div>
                        </div>
                    )}
                </form>
            </div>

            <style jsx>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(24px) scale(0.97); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
            `}</style>
        </div>
    );
}
