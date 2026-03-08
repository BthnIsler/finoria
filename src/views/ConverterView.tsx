'use client';

import React from 'react';

export default function ConverterView() {
    return (
        <div className="pb-10 max-w-4xl mx-auto">
            <div className="mb-6">
                <h1 className="text-2xl font-extrabold text-primary mb-1">💱 Hızlı Çevirici</h1>
                <p className="text-xs text-muted">Döviz, altın ve kripto çevirici</p>
            </div>
            <iframe src="/converter" className="w-full h-[calc(100vh-160px)] border-none rounded-2xl" />
        </div>
    );
}
