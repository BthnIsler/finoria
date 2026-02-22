'use client';

import React, { useState } from 'react';
import {
    Asset,
    AssetCategory,
    CATEGORIES,
    POPULAR_CRYPTOS,
    POPULAR_FOREX,
    GOLD_TYPES,
} from '@/lib/types';
import { updateAsset } from '@/lib/storage';

interface EditAssetFormProps {
    asset: Asset;
    onClose: () => void;
    onUpdate: (updated: Asset) => void;
}

export default function EditAssetForm({ asset, onClose, onUpdate }: EditAssetFormProps) {
    const [amount, setAmount] = useState(String(asset.amount));
    const [purchasePrice, setPurchasePrice] = useState(String(asset.purchasePrice || ''));
    const [manualCurrentPrice, setManualCurrentPrice] = useState(
        String(asset.manualCurrentPrice || '')
    );

    const catMeta = CATEGORIES.find((c) => c.key === asset.category)!;
    const needsManualPrice =
        asset.category === 'stock' ||
        asset.category === 'real_estate' ||
        asset.category === 'savings' ||
        asset.category === 'other';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const updated = updateAsset(asset.id, {
            amount: parseFloat(amount) || 0,
            purchasePrice: parseFloat(purchasePrice) || 0,
            manualCurrentPrice: manualCurrentPrice ? parseFloat(manualCurrentPrice) : undefined,
        });
        if (updated) onUpdate(updated);
        onClose();
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div
                    style={{
                        padding: '28px 28px 20px',
                        borderBottom: '1px solid var(--border)',
                        position: 'relative',
                    }}
                >
                    <div
                        style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0,
                            height: 3,
                            background: `linear-gradient(90deg, ${catMeta.color}, transparent)`,
                            borderRadius: '24px 24px 0 0',
                        }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div
                                style={{
                                    width: 42, height: 42,
                                    borderRadius: 12,
                                    background: `${catMeta.color}15`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 22,
                                    border: `1px solid ${catMeta.color}25`,
                                }}
                            >
                                {catMeta.icon}
                            </div>
                            <div>
                                <h2 style={{ fontSize: 17, fontWeight: 700 }}>{asset.name}</h2>
                                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Düzenle</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="btn-icon" style={{ borderRadius: '50%' }}>
                            ✕
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: 28 }}>
                    {/* Amount */}
                    <div style={{ marginBottom: 20 }}>
                        <p className="section-title" style={{ marginBottom: 10 }}>Miktar</p>
                        <input
                            type="number"
                            className="input-field"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            step="any"
                            min="0"
                            required
                        />
                    </div>

                    {/* Purchase Price */}
                    <div style={{ marginBottom: 20 }}>
                        <p className="section-title" style={{ marginBottom: 10 }}>Alış Fiyatı (₺)</p>
                        <input
                            type="number"
                            className="input-field"
                            placeholder="Birim başı alış fiyatı"
                            value={purchasePrice}
                            onChange={(e) => setPurchasePrice(e.target.value)}
                            step="any"
                            min="0"
                        />
                    </div>

                    {/* Manual current price */}
                    {needsManualPrice && (
                        <div style={{ marginBottom: 20 }}>
                            <p className="section-title" style={{ marginBottom: 10 }}>Güncel Değer (₺/birim)</p>
                            <input
                                type="number"
                                className="input-field"
                                placeholder="Güncel birim fiyat"
                                value={manualCurrentPrice}
                                onChange={(e) => setManualCurrentPrice(e.target.value)}
                                step="any"
                                min="0"
                            />
                        </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
                        <button type="button" className="btn-secondary" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>
                            İptal
                        </button>
                        <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>
                            ✓ Kaydet
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
