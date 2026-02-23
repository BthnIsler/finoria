'use client';

import React, { useState, useMemo } from 'react';
import { Asset, CATEGORIES } from '@/lib/types';
import AssetCard from '@/components/AssetCard';
import WidgetWrapper from '@/components/WidgetWrapper';

interface AssetsTabsWidgetProps {
    widgetId: string;
    assets: Asset[];
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze?: (asset: Asset) => void;
}

export default function AssetsTabsWidget({
    widgetId,
    assets,
    onDelete,
    onEdit,
    onSell,
    onAnalyze
}: AssetsTabsWidgetProps) {
    const [activeTab, setActiveTab] = useState<string>('all');

    // Find which categories actually have assets
    const categoriesWithAssets = useMemo(() => {
        const counts = new Map<string, number>();
        assets.forEach(a => counts.set(a.category, (counts.get(a.category) || 0) + 1));

        return CATEGORIES.filter(c => counts.has(c.key)).map(c => ({
            ...c,
            count: counts.get(c.key) || 0
        }));
    }, [assets]);

    const filteredAssets = useMemo(() => {
        if (activeTab === 'all') return assets;
        return assets.filter(a => a.category === activeTab);
    }, [assets, activeTab]);

    return (
        <WidgetWrapper widgetId={widgetId}>
            <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <p className="section-title" style={{ marginBottom: 0 }}>Varlıklarım · {assets.length}</p>
                </div>

                {categoriesWithAssets.length > 1 && (
                    <div
                        className="hide-scrollbar"
                        style={{
                            display: 'flex',
                            gap: 8,
                            marginBottom: 20,
                            overflowX: 'auto',
                            paddingBottom: 4,
                        }}
                    >
                        <button
                            onClick={() => setActiveTab('all')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 20,
                                fontSize: 13,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                background: activeTab === 'all' ? 'var(--text-primary)' : 'var(--bg-elevated)',
                                color: activeTab === 'all' ? 'var(--bg-primary)' : 'var(--text-secondary)',
                                border: '1px solid',
                                borderColor: activeTab === 'all' ? 'transparent' : 'var(--border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            Tümü ({assets.length})
                        </button>

                        {categoriesWithAssets.map(cat => (
                            <button
                                key={cat.key}
                                onClick={() => setActiveTab(cat.key)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '8px 16px',
                                    borderRadius: 20,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                    background: activeTab === cat.key ? `${cat.color}20` : 'var(--bg-elevated)',
                                    color: activeTab === cat.key ? cat.color : 'var(--text-secondary)',
                                    border: '1px solid',
                                    borderColor: activeTab === cat.key ? cat.color : 'var(--border)',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span>{cat.icon}</span>
                                <span>{cat.labelTR}</span>
                                <span style={{
                                    opacity: 0.7,
                                    fontSize: 11,
                                    marginLeft: 2
                                }}>
                                    ({cat.count})
                                </span>
                            </button>
                        ))}
                    </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
                    {filteredAssets.map((asset) => (
                        <AssetCard
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
        </WidgetWrapper>
    );
}
