'use client';

import React, { useState } from 'react';
import { Asset, getCategoryMeta } from '@/lib/types';
import { sellAsset } from '@/lib/db';
import { useAuth } from '@/lib/AuthContext';

interface SellAssetFormProps {
    asset: Asset;
    onClose: () => void;
    onSold: (assetId: string, remainingAsset: Asset | null) => void;
}

export default function SellAssetForm({ asset, onClose, onSold }: SellAssetFormProps) {
    const [sellAmount, setSellAmount] = useState('');
    const [sellPrice, setSellPrice] = useState(
        String(asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice ?? '')
    );
    const [isSaving, setIsSaving] = useState(false);
    const { user } = useAuth();

    const cat = getCategoryMeta(asset.category);
    const currentPrice = asset.currentPrice ?? asset.manualCurrentPrice ?? asset.purchasePrice;
    const maxAmount = asset.amount;
    const parsedAmount = parseFloat(sellAmount) || 0;
    const parsedPrice = parseFloat(sellPrice) || 0;
    const totalSaleValue = parsedAmount * parsedPrice;
    const profit = asset.purchasePrice > 0
        ? (parsedPrice - asset.purchasePrice) * parsedAmount
        : 0;

    const canSubmit = parsedAmount > 0 && parsedAmount <= maxAmount && parsedPrice >= 0 && !isSaving;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit || !user) return;
        setIsSaving(true);

        const updatedAsset = await sellAsset(user.id, asset.id, maxAmount, parsedAmount, parsedPrice);
        onSold(asset.id, updatedAsset);

        setIsSaving(false);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div style={{ padding: '28px 28px 20px', borderBottom: '1px solid var(--border)', position: 'relative' }}>
                    <div style={{
                        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                        background: 'linear-gradient(90deg, var(--accent-red), transparent)',
                        borderRadius: '24px 24px 0 0',
                    }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 12,
                                background: `${cat.color}15`, display: 'flex',
                                alignItems: 'center', justifyContent: 'center', fontSize: 22,
                                border: `1px solid ${cat.color}25`,
                            }}>
                                {cat.icon}
                            </div>
                            <div>
                                <h2 style={{ fontSize: 17, fontWeight: 700 }}>Varlık Çıkar</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{asset.name}</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%' }}>✕</button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 28 }}>
                    {/* Current holding info */}
                    <div style={{
                        background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                        borderRadius: 12, padding: 14, marginBottom: 20, fontSize: 13,
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                            <span style={{ color: 'var(--text-muted)' }}>Mevcut Miktar</span>
                            <span style={{ fontWeight: 600 }}>{maxAmount.toLocaleString('tr-TR')}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Güncel Fiyat</span>
                            <span style={{ fontWeight: 600 }}>₺{currentPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    {/* Sell amount */}
                    <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <p className="section-title" style={{ marginBottom: 0 }}>Satış Miktarı</p>
                            <button
                                type="button"
                                onClick={() => setSellAmount(String(maxAmount))}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--accent-purple)',
                                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                }}
                            >
                                Tamamını Sat
                            </button>
                        </div>
                        <input
                            type="number" className="input-field"
                            placeholder={`Maks: ${maxAmount}`}
                            value={sellAmount} onChange={(e) => setSellAmount(e.target.value)}
                            step="any" min="0" max={maxAmount} required
                        />
                    </div>

                    {/* Sell price per unit */}
                    <div style={{ marginBottom: 20 }}>
                        <p className="section-title" style={{ marginBottom: 10 }}>Satış Fiyatı (₺/birim)</p>
                        <input
                            type="number" className="input-field"
                            placeholder="Birim satış fiyatı"
                            value={sellPrice} onChange={(e) => setSellPrice(e.target.value)}
                            step="any" min="0" required
                        />
                    </div>

                    {/* Summary */}
                    {parsedAmount > 0 && (
                        <div style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                            borderRadius: 12, padding: 14, marginBottom: 20,
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                                <span style={{ color: 'var(--text-muted)' }}>Toplam Satış Tutarı</span>
                                <span style={{ fontWeight: 700, fontSize: 15 }}>
                                    ₺{totalSaleValue.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            {asset.purchasePrice > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Kar/Zarar</span>
                                    <span style={{
                                        fontWeight: 600,
                                        color: profit >= 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                                    }}>
                                        {profit >= 0 ? '+' : ''}₺{profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            )}
                            {parsedAmount >= maxAmount && (
                                <p style={{ color: 'var(--accent-red)', fontSize: 11, marginTop: 8, textAlign: 'center' }}>
                                    ⚠️ Tamamı satılacak, varlık portföyden kaldırılacak
                                </p>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                            İptal
                        </button>
                        <button
                            type="submit" disabled={!canSubmit}
                            style={{
                                flex: 2, justifyContent: 'center', display: 'flex', alignItems: 'center', gap: 8,
                                background: canSubmit ? 'linear-gradient(135deg, #dc2626, #b91c1c)' : 'var(--bg-elevated)',
                                color: canSubmit ? 'white' : 'var(--text-muted)',
                                border: 'none', padding: '12px 22px', borderRadius: 14,
                                fontWeight: 600, fontSize: 13, cursor: canSubmit ? 'pointer' : 'not-allowed',
                                transition: 'all 0.3s',
                            }}
                        >
                            Çıkar / Sat
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
