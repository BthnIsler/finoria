// ============================================
// Wealth Tracker - Utility Functions
// ============================================

export function formatCurrency(value: number, currency: string = 'TRY'): string {
    return new Intl.NumberFormat('tr-TR', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatNumber(value: number, decimals: number = 2): string {
    return new Intl.NumberFormat('tr-TR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(value);
}

export function formatPercentage(value: number): string {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
}

export function calculateProfitLoss(
    amount: number,
    purchasePrice: number,
    currentPrice: number
): { value: number; percentage: number } {
    const totalCost = amount * purchasePrice;
    const currentValue = amount * currentPrice;
    const value = currentValue - totalCost;
    const percentage = totalCost > 0 ? ((currentValue - totalCost) / totalCost) * 100 : 0;
    return { value, percentage };
}

export function getCurrentValue(amount: number, currentPrice: number): number {
    return amount * currentPrice;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
    return classes.filter(Boolean).join(' ');
}
