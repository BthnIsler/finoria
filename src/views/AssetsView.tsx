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
