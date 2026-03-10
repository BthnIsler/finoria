'use client';

import React from 'react';
import { Asset } from '@/lib/types';
import HeroWealthCard from '@/components/HeroWealthCard';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
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
    /** When true: renders simplified mobile layout (no news/movers, compact charts) */
    isMobile?: boolean;
}

export default function DashboardView({ assets, totalWealth, totalCost, history, heroPLPeriod, setHeroPLPeriod, activeHeroPL, isMobile = false }: DashboardViewProps) {
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

            {/* 2. Charts Row — History chart left, Pie chart right */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', height: isMobile ? 320 : 420 }}>
                    <WealthHistoryChart
                        history={history}
                        currentTotal={totalWealth}
                        assets={assets}
                        totalCost={totalCost}
                    />
                </div>
                {/* Pie chart */}
                <div style={{ background: 'var(--bg-elevated)', borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', height: isMobile ? 'auto' : 420 }}>
                    <WealthChart assets={assets} isMobile={isMobile} />
                </div>
            </div>

            {/* 3. Upcoming Events — shown on both web and mobile */}
            <div className="mb-5">
                <UpcomingEvents />
            </div>

            {/* 4. News section — web only (mobile sees it in Haberler tab) */}
            {!isMobile && assets.length > 0 && (
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
