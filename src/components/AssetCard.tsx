'use client';

import React from 'react';
import { Asset, getCategoryMeta, GOLD_TYPES } from '@/lib/types';
import { formatCurrency, formatPercentage, getAssetCostInTRY } from '@/lib/utils';
import { deleteAsset } from '@/lib/db';
import { useCurrency } from '@/lib/contexts';

interface AssetCardProps {
    asset: Asset;
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
}

export default function AssetCard({ asset, onDelete, onEdit, onSell, onAnalyze }: AssetCardProps) {
    const cat = getCategoryMeta(asset.category);
    const { currency, convert, symbol, exchangeRates } = useCurrency();

    // The backend provides current prices entirely normalized in TRY
    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentPriceDisplay = convert(currentPriceTRY);

    const currentValueTRY = asset.amount * currentPriceTRY;
    const currentValueDisplay = convert(currentValueTRY);

    const hasPurchasePrice = asset.purchasePrice > 0;

    let pl = null;
    if (hasPurchasePrice) {
        // Convert the raw cost (e.g. 100 USD) to true TRY cost, so we compare apples to apples
        const trueCostTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
        const plValueTRY = currentValueTRY - trueCostTRY;
        // P/L value to display is scaled to selected currency
        const plValueDisplay = convert(plValueTRY);
        const plPercentage = trueCostTRY > 0 ? (plValueTRY / trueCostTRY) * 100 : 0;

        pl = { value: plValueDisplay, percentage: plPercentage };
    }

    const handleDelete = async () => {
        if (window.confirm(`"${asset.name}" varlığını silmek istediğinize emin misiniz?`)) {
            await deleteAsset(asset.id);
            onDelete(asset.id);
        }
    };

    return (
        <div
            className="glass-card"
            style={{
                padding: 0,
                overflow: 'hidden',
                position: 'relative',
            }}
        >
            {/* Top accent line */}
            <div
                style={{
                    height: 2,
                    background: `linear-gradient(90deg, ${cat.color}80, transparent)`,
                }}
            />

            <div style={{ padding: '18px 20px' }}>
                {/* Top row: icon + name + actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                        <div
                            style={{
                                width: 40, height: 40,
                                borderRadius: 10,
                                background: `${cat.color}12`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 20,
                                border: `1px solid ${cat.color}20`,
                                flexShrink: 0,
                            }}
                        >
                            {cat.icon}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {asset.name}
                            </h3>
                            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {asset.amount} · {cat.labelTR}
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: 4 }}>
                        {onAnalyze && (
                            <button onClick={() => onAnalyze(asset)} className="btn-icon" title="AI Analiz" style={{ width: 30, height: 30, fontSize: 13 }}>
                                🤖
                            </button>
                        )}
                        <button onClick={() => onEdit(asset)} className="btn-icon" title="Düzenle" style={{ width: 30, height: 30, fontSize: 13 }}>
                            ✏️
                        </button>
                        <button onClick={() => onSell(asset)} className="btn-icon" title="Çıkar / Sat" style={{ width: 30, height: 30, fontSize: 13 }}>
                            💸
                        </button>
                        <button
                            onClick={handleDelete}
                            className="btn-icon"
                            title="Sil"
                            style={{ width: 30, height: 30, fontSize: 13 }}
                            onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
                            onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                        >
                            🗑
                        </button>
                    </div>
                </div>

                {/* Value row */}
                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Güncel Değer
                        </p>
                        <p className="value-animate" style={{ fontSize: 20, fontWeight: 700 }}>
                            {formatCurrency(currentValueDisplay, currency)}
                        </p>
                    </div>

                    {pl && (
                        <div style={{ textAlign: 'right' }}>
                            <span
                                style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    padding: '4px 10px',
                                    borderRadius: 100,
                                    background: pl.value >= 0 ? 'rgba(0, 230, 138, 0.1)' : 'rgba(255, 77, 106, 0.1)',
                                    color: pl.value >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                }}
                            >
                                {pl.value >= 0 ? '▲' : '▼'} {formatPercentage(pl.percentage)}
                            </span>
                        </div>
                    )}
                </div>

                {/* Bottom bar */}
                <div
                    style={{
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: 11,
                        color: 'var(--text-muted)',
                    }}
                >
                    <span>{symbol}{currentPriceDisplay.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / birim</span>
                    {asset.currentPrice && (
                        <span className="live-dot" style={{ fontSize: 10 }}>
                            Canlı
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
