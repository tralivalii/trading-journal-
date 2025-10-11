// FIX: Provided full content for missing DataView.tsx file.
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../services/appState';
import { calculateStats, filterTradesByPeriod } from '../services/statisticsService';
import { Trade, Account } from '../types';
import Chart from 'chart.js/auto';
import Skeleton from './ui/Skeleton';

type Period = 'week' | 'month' | 'quarter' | 'all';

const StatCard: React.FC<{ title: string; value: string | number; className?: string; change?: number; changeType?: 'profit' | 'rr' }> = ({ title, value, className = '', change, changeType }) => (
    <div className="bg-[#2A2F3B] p-4 rounded-lg border border-gray-700/50">
        <p className="text-sm text-[#8A91A8] uppercase tracking-wider">{title}</p>
        <p className={`text-2xl font-bold text-white mt-1 ${className}`}>{value}</p>
        {change !== undefined && change !== 0 && (
             <p className={`text-xs mt-1 font-semibold ${change > 0 ? 'text-green-400' : 'text-red-400'}`}>
                {change > 0 ? '+' : ''}
                {change.toFixed(changeType === 'rr' ? 2 : 0)}
                {changeType === 'profit' ? '' : ' R'}
            </p>
        )}
    </div>
);

const DataView: React.FC = () => {
    const { state } = useAppContext();
    const { trades, accounts } = state.userData!;
    const [period, setPeriod] = useState<Period>('month');

    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<Chart | null>(null);

    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);
    const activeAccountIds = useMemo(() => new Set(activeAccounts.map(a => a.id)), [activeAccounts]);

    const filteredTrades = useMemo(() => {
        const activeTrades = trades.filter(t => activeAccountIds.has(t.accountId));
        return filterTradesByPeriod(activeTrades, period);
    }, [trades, period, activeAccountIds]);
    
    const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);
    
    useEffect(() => {
        if (!chartRef.current) return;
        
        const cumulativePnlData = filteredTrades
            .slice()
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .reduce((acc, trade) => {
                const newTotal = (acc.length > 0 ? acc[acc.length - 1].pnl : 0) + trade.pnl;
                acc.push({ date: new Date(trade.date).toLocaleDateString(), pnl: newTotal });
                return acc;
            }, [] as { date: string; pnl: number }[]);

        const ctx = chartRef.current.getContext('2d');
        if (!ctx) return;
        
        if (chartInstance.current) {
            chartInstance.current.destroy();
        }

        chartInstance.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: cumulativePnlData.map(d => d.date),
                datasets: [{
                    label: 'Cumulative PnL',
                    data: cumulativePnlData.map(d => d.pnl),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#8A91A8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#8A91A8', maxRotation: 0, autoSkip: true, maxTicksLimit: 10 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });

        return () => {
            chartInstance.current?.destroy();
        };

    }, [filteredTrades]);
    
    if (state.isLoading) {
        return <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
    }

    const firstAccountCurrency = accounts.find(a => activeAccountIds.has(a.id))?.currency || 'USD';

    return (
        <div>
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <h1 className="text-3xl font-bold text-white flex-shrink-0">Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2">
                    {(['week', 'month', 'quarter', 'all'] as Period[]).map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p)}
                            className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-[#3B82F6] text-white' : 'bg-gray-700 hover:bg-gray-600 text-[#8A91A8] hover:text-white'}`}
                        >
                            {p === 'all' ? 'All Time' : `This ${p}`}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <StatCard 
                    title="Net Profit" 
                    value={stats.netProfit.toLocaleString('en-US', { style: 'currency', currency: firstAccountCurrency, minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    className={stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}
                />
                <StatCard title="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
                <StatCard title="Total Trades" value={stats.totalTrades} />
                <StatCard title="Avg. R:R" value={stats.averageRR.toFixed(2)} />
                <StatCard title="Wins / Losses" value={`${stats.wins} / ${stats.losses}`} />
                <StatCard 
                    title="Total R"
                    value={stats.totalRR.toFixed(2)}
                    className={stats.totalRR >= 0 ? 'text-green-400' : 'text-red-400'}
                />
            </div>
            
            <div className="bg-[#232733] rounded-lg p-6 border border-gray-700/50">
                <h2 className="text-xl font-semibold text-white mb-4">Equity Curve</h2>
                <div className="h-80 relative">
                    {filteredTrades.length > 0 ? (
                        <canvas ref={chartRef}></canvas>
                    ) : (
                        <div className="flex items-center justify-center h-full text-[#8A91A8]">No trading data for this period.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DataView;
