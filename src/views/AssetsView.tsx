'use client';

import React from 'react';
import { Asset } from '@/lib/types';
import AssetsTabsWidget from '@/components/AssetsTabsWidget';

interface AssetsViewProps {
    assets: Asset[];
    onDelete: (id: string) => void;
    onEdit: (asset: Asset) => void;
    onSell: (asset: Asset) => void;
    onAnalyze: (asset: Asset) => void;
}

export default function AssetsView({ assets, onDelete, onEdit, onSell, onAnalyze }: AssetsViewProps) {
    if (assets.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 px-5 text-center bg-elevated rounded-2xl border border-light">
                <div className="text-6xl mb-4 opacity-80">🗂️</div>
                <h3 className="text-xl font-bold mb-2 text-primary">Henüz bir varlık eklemediniz</h3>
                <p className="text-muted text-sm max-w-sm leading-relaxed">
                    Burada tüm yatırımlarınızın detaylı listesini görebilir, düzenleyebilir ve silebilirsiniz.
                </p>
            </div>
        );
    }

    return (
        <div className="pb-10">
            <AssetsTabsWidget
                widgetId="assets"
                assets={assets}
                onDelete={onDelete}
                onEdit={onEdit}
                onSell={onSell}
                onAnalyze={onAnalyze}
            />
        </div>
    );
}
