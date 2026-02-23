'use client';

import React, { useState, useMemo } from 'react';
import { Asset, CATEGORIES, getCategoryMeta } from '@/lib/types';
import { useCurrency } from '@/lib/contexts';
import { getAssetCostInTRY, formatPercentage } from '@/lib/utils';
import { deleteAsset } from '@/lib/db';
import WidgetWrapper from '@/components/WidgetWrapper';

interface AssetsTabsWidgetProps {
    widgetId: string;
    assets: Asset[];
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
}

function AssetRow({ asset, onDelete, onEdit, onSell, onAnalyze }: {
    asset: Asset;
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
}) {
    const cat = getCategoryMeta(asset.category);
    const { currency, convert, exchangeRates } = useCurrency();

    const currentPriceTRY = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const currentValueTRY = asset.amount * currentPriceTRY;
    const currentValueDisplay = convert(currentValueTRY);

    let plPercentage: number | null = null;
    let plIsPositive = true;
    if (asset.purchasePrice > 0) {
        const costTRY = getAssetCostInTRY(asset.amount, asset.purchasePrice, asset.purchaseCurrency, exchangeRates);
        if (costTRY > 0) {
            const plTRY = currentValueTRY - costTRY;
            plPercentage = (plTRY / costTRY) * 100;
            plIsPositive = plTRY >= 0;
        }
    }

    const handleDelete = async () => {
        if (window.confirm(`"${asset.name}" varlığını silmek istediğinize emin misiniz?`)) {
            await deleteAsset(asset.id);
            onDelete(asset.id);
        }
    };

    const fmt = (n: number) =>
        new Intl.NumberFormat('tr-TR', {
            style: 'currency', currency,
            minimumFractionDigits: 2, maximumFractionDigits: 2,
        }).format(n);

    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 14px',
                borderRadius: 12,
                transition: 'background 0.15s',
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
            {/* Icon */}
            <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: `${cat.color}18`,
                border: `1px solid ${cat.color}28`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, flexShrink: 0,
            }}>
                {cat.icon}
            </div>

            {/* Name + amount */}
            <div style={{ minWidth: 0, flex: '1 1 120px' }}>
                <p style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {asset.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                    {asset.amount} adet
                    {asset.currentPrice && (
                        <span style={{
                            marginLeft: 6, fontSize: 10, color: 'var(--accent-cyan)',
                            background: 'rgba(34,211,238,0.08)',
                            padding: '1px 6px', borderRadius: 6,
                        }}>● canlı</span>
                    )}
                </p>
            </div>

            {/* Value */}
            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 'auto' }}>
                <p style={{ fontSize: 13, fontWeight: 700 }}>{fmt(currentValueDisplay)}</p>
                {plPercentage !== null && (
                    <p style={{
                        fontSize: 11, fontWeight: 600, marginTop: 1,
                        color: plIsPositive ? 'var(--accent-green)' : 'var(--accent-red)',
                    }}>
                        {plIsPositive ? '▲' : '▼'} {formatPercentage(plPercentage)}
                    </p>
                )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {onAnalyze && (
                    <button onClick={() => onAnalyze(asset)} className="btn-icon" title="AI Analiz" style={{ width: 28, height: 28, fontSize: 12 }}>🤖</button>
                )}
                <button onClick={() => onEdit(asset)} className="btn-icon" title="Düzenle" style={{ width: 28, height: 28, fontSize: 12 }}>✏️</button>
                <button onClick={() => onSell(asset)} className="btn-icon" title="Sat/Çıkar" style={{ width: 28, height: 28, fontSize: 12 }}>💸</button>
                <button
                    onClick={handleDelete} className="btn-icon" title="Sil"
                    style={{ width: 28, height: 28, fontSize: 12 }}
                    onMouseOver={(e) => (e.currentTarget.style.borderColor = 'var(--accent-red)')}
                    onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                >🗑</button>
            </div>
        </div>
    );
}

export default function AssetsTabsWidget({
    widgetId,
    assets,
    onDelete,
    onEdit,
    onSell,
    onAnalyze
}: AssetsTabsWidgetProps) {
    // Collapsed by default — keeps homepage clean
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('all');

    const categoriesWithAssets = useMemo(() => {
        const counts = new Map<string, number>();
        assets.forEach(a => counts.set(a.category, (counts.get(a.category) || 0) + 1));
        return CATEGORIES.filter(c => counts.has(c.key)).map(c => ({
            ...c,
            count: counts.get(c.key) || 0,
        }));
    }, [assets]);

    const filteredAssets = useMemo(() => {
        if (activeTab === 'all') return assets;
        return assets.filter(a => a.category === activeTab);
    }, [assets, activeTab]);

    return (
        <WidgetWrapper widgetId={widgetId}>
            <div>
                {/* ──── Clickable header (always visible) ──── */}
                <button
                    onClick={() => setIsOpen(o => !o)}
                    style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {/* Folder / list icon */}
                        <div style={{
                            width: 32, height: 32, borderRadius: 9,
                            background: 'linear-gradient(135deg, rgba(167,139,250,0.15), rgba(34,211,238,0.1))',
                            border: '1px solid rgba(167,139,250,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 16,
                        }}>
                            💼
                        </div>
                        <div style={{ textAlign: 'left' }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'block' }}>
                                Varlıklarım
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {assets.length} varlık
                            </span>
                        </div>
                    </div>

                    {/* Chevron indicator */}
                    <span style={{
                        fontSize: 18,
                        color: 'var(--text-muted)',
                        transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        display: 'flex', alignItems: 'center',
                    }}>
                        ⌄
                    </span>
                </button>

                {/* ──── Collapsible body ──── */}
                <div style={{
                    overflow: 'hidden',
                    maxHeight: isOpen ? '2000px' : '0px',
                    transition: 'max-height 0.4s cubic-bezier(0.4,0,0.2,1)',
                    opacity: isOpen ? 1 : 0,
                    transitionProperty: 'max-height, opacity',
                }}>
                    {/* Divider */}
                    <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 10px' }} />

                    {/* Category tabs */}
                    {categoriesWithAssets.length > 1 && (
                        <div
                            className="hide-scrollbar"
                            style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 12 }}
                        >
                            <button
                                onClick={() => setActiveTab('all')}
                                style={{
                                    padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    background: activeTab === 'all' ? 'var(--text-primary)' : 'var(--bg-elevated)',
                                    color: activeTab === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                    border: '1px solid', borderColor: activeTab === 'all' ? 'transparent' : 'var(--border)',
                                    cursor: 'pointer', transition: 'all 0.2s',
                                }}
                            >
                                Tümü ({assets.length})
                            </button>
                            {categoriesWithAssets.map(cat => (
                                <button
                                    key={cat.key}
                                    onClick={() => setActiveTab(cat.key)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 4,
                                        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                                        whiteSpace: 'nowrap',
                                        background: activeTab === cat.key ? `${cat.color}18` : 'var(--bg-elevated)',
                                        color: activeTab === cat.key ? cat.color : 'var(--text-secondary)',
                                        border: '1px solid', borderColor: activeTab === cat.key ? cat.color : 'var(--border)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    {cat.icon} {cat.labelTR} ({cat.count})
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Asset rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {filteredAssets.map((asset) => (
                            <AssetRow
                                key={asset.id}
                                asset={asset}
                                onDelete={onDelete}
                                onEdit={onEdit}
                                onSell={onSell}
                                onAnalyze={onAnalyze}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </WidgetWrapper>
    );
}
