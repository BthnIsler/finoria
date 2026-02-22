'use client';

import React from 'react';
import { useWidgetLayout, WidgetSize } from '@/lib/contexts';

interface WidgetWrapperProps {
    widgetId: string;
    children: React.ReactNode;
}

const SIZE_ICONS: Record<WidgetSize, string> = {
    small: '▪',
    medium: '◾',
    large: '⬛',
};

export default function WidgetWrapper({ widgetId, children }: WidgetWrapperProps) {
    const { widgets, updateWidget, moveWidget, isEditing } = useWidgetLayout();
    const config = widgets.find((w) => w.id === widgetId);
    if (!config || !config.visible) return null;

    const sizeClass = `widget-${config.size}`;

    return (
        <div className={`widget-wrapper ${sizeClass} ${isEditing ? 'editing' : ''}`} style={{ order: config.order }}>
            {isEditing && (
                <div className="widget-toolbar">
                    <button onClick={() => moveWidget(widgetId, 'up')} title="Yukarı taşı">↑</button>
                    <button onClick={() => moveWidget(widgetId, 'down')} title="Aşağı taşı">↓</button>
                    <span style={{ width: 1, background: 'var(--border)', margin: '2px 0' }} />
                    {(['small', 'medium', 'large'] as WidgetSize[]).map((s) => (
                        <button
                            key={s}
                            onClick={() => updateWidget(widgetId, { size: s })}
                            title={s === 'small' ? 'Küçük' : s === 'medium' ? 'Orta' : 'Büyük'}
                            className={config.size === s ? 'active' : ''}
                        >
                            {SIZE_ICONS[s]}
                        </button>
                    ))}
                    <span style={{ width: 1, background: 'var(--border)', margin: '2px 0' }} />
                    <button
                        onClick={() => updateWidget(widgetId, { visible: false })}
                        title="Gizle"
                        style={{ color: 'var(--accent-red)' }}
                    >
                        ✕
                    </button>
                </div>
            )}
            {children}
        </div>
    );
}
