'use client';

import React, { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
    value: number;
    duration?: number;
    formatter?: (n: number) => string;
    style?: React.CSSProperties;
    className?: string;
}

export default function AnimatedNumber({
    value,
    duration = 800,
    formatter,
    style,
    className,
}: AnimatedNumberProps) {
    const [displayValue, setDisplayValue] = useState(value);
    const prevValueRef = useRef(value);
    const animFrameRef = useRef<number>(0);

    useEffect(() => {
        const fromVal = prevValueRef.current;
        const toVal = value;
        prevValueRef.current = value;

        if (fromVal === toVal) {
            setDisplayValue(toVal);
            return;
        }

        const startTime = performance.now();
        const diff = toVal - fromVal;

        const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic for smooth deceleration
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayValue(fromVal + diff * eased);

            if (progress < 1) {
                animFrameRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(toVal);
            }
        };

        animFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [value, duration]);

    const formatted = formatter ? formatter(displayValue) : displayValue.toFixed(2);

    return (
        <span className={className} style={style}>
            {formatted}
        </span>
    );
}
