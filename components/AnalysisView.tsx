
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAppContext } from '../services/appState';
import { Trade, Result } from '../types';
import { calculateStats, filterTradesByPeriod } from '../services/statisticsService';
import { analyzeTradeGroups, generateTemporalData, calculateStreaks } from '../services/analysisService';
import Skeleton from './ui/Skeleton';

// Chart.js is loaded from a CDN as specified in service-worker.js, so we expect it on the window object.
declare global {
    interface Window {
        Chart: any;
    }
}

// --- Reusable UI Components ---
const StatCard: React.FC<{ label: string, value: string | number, subvalue?: string, className?: string }> = ({ label, value, subvalue, className }) => (
    <div className="bg-[#232733] p-4 rounded-lg border border-gray-700/50">
        <p className="text-sm text-[#8A91A8] uppercase tracking-wider">{label}</p>
        <p className={`text-3xl font-bold mt-1 ${className}`}>{value}</p>
        {subvalue && <p className="text-xs text-gray-500 mt-1">{subvalue}</p>}
    </div>
);

const ChartCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#232733] p-4 rounded-lg border border-gray-700/50">
        <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
        {children}
    </div>
);

// --- Chart Components ---

const EquityCurveChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);
    const data = useMemo(() => generateTemporalData(trades), [trades]);

    useEffect(() => {
        if (!canvasRef.current || !window.Chart) return;
        if (chartRef.current) chartRef.current.destroy();

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

        chartRef.current = new window.Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: 'Cumulative PnL',
                    data: data.data,
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.3,
                    pointRadius: data.data.length < 100 ? 3 : 0,
                    pointBackgroundColor: data.pointColors,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { ticks: { color: '#8A91A8' }, grid: { color: 'rgba(138, 145, 168, 0.1)' } },
                    y: { ticks: { color: '#8A91A8' }, grid: { color: 'rgba(138, 145, 168, 0.1)' } }
                }
            }
        });

        return () => chartRef.current?.destroy();
    }, [data]);

    return <div style={{ height: '300px' }}><canvas ref={canvasRef}></canvas></div>;
};

const DistributionChart: React.FC<{ title: string, data: Record<string, number> }> = ({ title, data }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const chartRef = useRef<any>(null);
    const labels = Object.keys(data);
    const values = Object.values(data);

    useEffect(() => {
        if (!canvasRef.current || !window.Chart || values.length === 0) return;
        if (chartRef.current) chartRef.current.destroy();
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        chartRef.current = new window.Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: title,
                    data: values,
                    backgroundColor: ['#3B82F6', '#10B981', '#EF4444', '#F59E0B', '#6366F1', '#EC4899'],
                    borderColor: '#232733',
                    borderWidth: 2,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#F0F0F0' }
                    }
                }
            }
        });
        
        return () => chartRef.current?.destroy();
    }, [data, title]);

    if (values.length === 0) return <p className="text-center text-gray-500 text-sm">No data available for this breakdown.</p>;

    return <div style={{ height: '250px' }}><canvas ref={canvasRef}></canvas></div>;
};

// --- Main Analysis View ---

const AnalysisView: React.FC = () => {
    const { state } = useAppContext();
    const { userData } = state;
    
    const [period, setPeriod] = useState<'week' | 'month' | 'quarter' | 'all'>('all');

    const trades = useMemo(() => (userData?.trades || []), [userData?.trades]);

    const filteredTrades = useMemo(() => filterTradesByPeriod(trades, period), [trades, period]);
    
    const stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);
    const analysis = useMemo(() => analyzeTradeGroups(filteredTrades), [filteredTrades]);
    const streaks = useMemo(() => calculateStreaks(filteredTrades), [filteredTrades]);
    
    const winData = analysis[Result.Win];
    const lossData = analysis[Result.Loss];
    
    if (state.isLoading) {
        return <Skeleton className="w-full h-96" />;
    }

    if (!userData || trades.length === 0) {
        return (
            <div className="text-center py-16">
                <h1 className="text-3xl font-bold text-white mb-4">Analysis</h1>
                <p className="text-gray-400">Not enough trade data to generate an analysis. Add some trades to get started!</p>
            </div>
        );
    }
    
    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Performance Analysis</h1>

            {/* --- Overview Stats --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <StatCard label="Net Profit" value={stats.netProfit.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} className={stats.netProfit >= 0 ? 'text-green-400' : 'text-red-400'} />
                <StatCard label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} subvalue={`${stats.wins}W / ${stats.losses}L`} />
                <StatCard label="Avg. R:R" value={stats.averageRR.toFixed(2)} subvalue={`Total R:R: ${stats.totalRR.toFixed(2)}`} />
                <StatCard label="Total Trades" value={stats.totalTrades} subvalue={`Completed: ${stats.wins + stats.losses + stats.breakevens}`} />
            </div>

            {/* --- Equity Curve --- */}
            <div className="mb-8">
                <ChartCard title="Equity Curve">
                    <EquityCurveChart trades={filteredTrades} />
                </ChartCard>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- Winning Trades Analysis --- */}
                {winData && winData.count > 0 && (
                    <ChartCard title={`Winning Trades (${winData.count})`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatCard label="Avg. R:R" value={winData.avgRR.toFixed(2)} className="text-green-400 !text-2xl" />
                            <StatCard label="Profit Sum" value={stats.profitSum.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} className="text-green-400 !text-2xl" />
                            <div className="md:col-span-2">
                               <DistributionChart title="Win Distribution by Pair" data={winData.distributionByPair} />
                            </div>
                            <div className="md:col-span-2">
                               <DistributionChart title="Win Distribution by Entry" data={winData.distributionByEntry} />
                            </div>
                        </div>
                    </ChartCard>
                )}

                {/* --- Losing Trades Analysis --- */}
                {lossData && lossData.count > 0 && (
                     <ChartCard title={`Losing Trades (${lossData.count})`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <StatCard label="Avg. R:R" value={lossData.avgRR.toFixed(2)} className="text-red-400 !text-2xl" />
                             <StatCard label="Loss Sum" value={stats.lossSum.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} className="text-red-400 !text-2xl" />
                            <div className="md:col-span-2">
                               <DistributionChart title="Loss Distribution by Pair" data={lossData.distributionByPair} />
                            </div>
                             <div className="md:col-span-2">
                               <DistributionChart title="Loss Distribution by Day" data={lossData.distributionByDay} />
                            </div>
                        </div>
                    </ChartCard>
                )}
            </div>

            {/* --- Streaks --- */}
            <div className="mt-8">
                 <ChartCard title="Streaks & Consistency">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm text-[#8A91A8]">Longest Win Streak</p>
                            <p className="text-2xl font-bold text-green-400">{streaks.longestWinStreak} Trades</p>
                        </div>
                         <div>
                            <p className="text-sm text-[#8A91A8]">Longest Loss Streak</p>
                            <p className="text-2xl font-bold text-red-400">{streaks.longestLossStreak} Trades</p>
                        </div>
                        <div>
                            <p className="text-sm text-[#8A91A8]">Current Streak</p>
                            <p className={`text-2xl font-bold ${streaks.currentStreak.type === 'win' ? 'text-green-400' : (streaks.currentStreak.type === 'loss' ? 'text-red-400' : 'text-gray-400')}`}>
                                {streaks.currentStreak.count > 0 ? `${streaks.currentStreak.count} ${streaks.currentStreak.type === 'win' ? 'Wins' : 'Losses'}` : 'N/A'}
                            </p>
                        </div>
                    </div>
                 </ChartCard>
            </div>

        </div>
    );
};

export default AnalysisView;
