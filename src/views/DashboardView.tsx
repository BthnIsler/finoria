'use client';

import React from 'react';
import { Asset } from '@/lib/types';
import HeroWealthCard from '@/components/HeroWealthCard';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
import MarketMovers from '@/components/MarketMovers';
import UpcomingEvents from '@/components/UpcomingEvents';
import NewsSection from '@/components/NewsSection';

import { WealthSnapshot } from '@/lib/storage';

interface DashboardViewProps {
    assets: Asset[];
    totalWealth: number;
    totalCost: number;
    history: WealthSnapshot[];
    heroPLPeriod: '1d' | '1w' | '1m' | 'all';
    setHeroPLPeriod: (p: '1d' | '1w' | '1m' | 'all') => void;
    activeHeroPL: { pl: number; pct: number; label: string };
}

export default function DashboardView({ assets, totalWealth, totalCost, history, heroPLPeriod, setHeroPLPeriod, activeHeroPL }: DashboardViewProps) {
    return (
        <div className="pb-10">
            {/* 1. Hero Wealth Card - full width */}
            <div className="mb-6">
                <HeroWealthCard
                    assets={assets}
                    totalWealth={totalWealth}
                    totalCost={totalCost}
                    history={history}
                    heroPLPeriod={heroPLPeriod}
                    setHeroPLPeriod={setHeroPLPeriod}
                    activeHeroPL={activeHeroPL}
                    onShare={() => {}}
                />
            </div>

            {/* 2. Charts Row — History chart left, Pie chart right and perfectly centered */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', height: 420 }}>
                    <WealthHistoryChart
                        history={history}
                        currentTotal={totalWealth}
                        assets={assets}
                        totalCost={totalCost}
                    />
                </div>
                {/* Pie chart: explicit height so ResponsiveContainer works in Capacitor WebView */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', height: 420 }}>
                    <WealthChart assets={assets} />
                </div>
            </div>

            {/* 3. Market Movers + Upcoming Events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <MarketMovers assets={assets} />
                <UpcomingEvents />
            </div>

            {/* 4. News section — two-column layout */}
            {assets.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 17 }}>📰</span>
                        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: -0.3, margin: 0 }}>
                            Portföy Haberleri
                        </h2>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 6, padding: '2px 8px' }}>
                            varlıklarınızla ilgili haberler
                        </span>
                    </div>
                    <NewsSection assets={assets} />
                </div>
            )}
        </div>
    );
}
