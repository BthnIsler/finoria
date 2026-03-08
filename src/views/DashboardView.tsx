'use client';

import React from 'react';
import { Asset } from '@/lib/types';
import HeroWealthCard from '@/components/HeroWealthCard';
import WealthChart from '@/components/WealthChart';
import WealthHistoryChart from '@/components/WealthHistoryChart';
import MarketMovers from '@/components/MarketMovers';
import UpcomingEvents from '@/components/UpcomingEvents';
import GlobalHeadlines from '@/components/GlobalHeadlines';

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
            {/* Top row: Hero Card */}
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 items-stretch">
                <div className="bg-elevated rounded-2xl border border-light overflow-hidden">
                    <WealthHistoryChart
                        history={history}
                        currentTotal={totalWealth}
                        assets={assets}
                        totalCost={totalCost}
                    />
                </div>
                <div className="bg-elevated rounded-2xl border border-light overflow-hidden">
                    <WealthChart assets={assets} />
                </div>
            </div>

            {/* Market data + Upcoming Events */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <MarketMovers assets={assets} />
                <UpcomingEvents />
            </div>

            {/* Global Headlines - full width at bottom */}
            <div className="mb-10">
                <GlobalHeadlines />
            </div>
        </div>
    );
}
