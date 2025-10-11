import React, { useState, useMemo } from 'react';
import { useAppContext } from '../services/appState';
import { Result, Trade } from '../types';
import { analyzeTradeGroups, calculateStreaks } from '../services/analysisService';
import { filterTradesByPeriod } from '../services/statisticsService';

type Period = 'this-month' | 'last-month' | 'this-quarter' | 'all';

const DataCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col">
        <div className="p-4 border-b border-gray-700/50">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
        </div>
        <div className="p-4 flex-grow flex flex-col">{children}</div>
    </div>
);

const NoData: React.FC<{ message?: string }> = ({ message }) => (
    <div className="text-center py-8 text-[#8A91A8] flex-grow flex flex-col items-center justify-center gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>{message || "Not enough data to display."}</p>
    </div>
);

type AnalysisGroup = Result.Win | Result.Loss | Result.Breakeven | Result.Missed;

const AnalysisView: React.FC = () => {
    const { state } = useAppContext();
    const { trades, accounts } = state.userData!;
    const [activeGroup, setActiveGroup] = useState<AnalysisGroup>(Result.Loss);
    const [period, setPeriod] = useState<Period>('this-month');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    
    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

    const analysisTrades = useMemo(() => {
        const accountFiltered = trades.filter(trade =>
            (selectedAccountId === 'all' ? activeAccounts.some(a => a.id === trade.accountId) : trade.accountId === selectedAccountId)
        );
        return filterTradesByPeriod(accountFiltered, period);
    }, [trades, activeAccounts, selectedAccountId, period]);
    
    const analysisData = useMemo(() => analyzeTradeGroups(analysisTrades), [analysisTrades]);
    const streaks = useMemo(() => calculateStreaks(analysisTrades), [analysisTrades]);
    const selectedGroupStats = analysisData[activeGroup];

    const patterns = useMemo(() => {
        if (!selectedGroupStats || selectedGroupStats.count < 3) {
            return "Not enough trades to find meaningful patterns.";
        }

        const foundPatterns: { percentage: number, title: string, key: string }[] = [];
        const total = selectedGroupStats.count;

        const distributions: { title: string; data?: Record<string, number> }[] = [
            { title: 'Entry Type', data: selectedGroupStats.distributionByEntry },
            { title: 'Direction', data: selectedGroupStats.distributionByDirection },
            { title: 'Pair', data: selectedGroupStats.distributionByPair },
            { title: 'Day of Week', data: selectedGroupStats.distributionByDay },
            { title: 'R:R', data: selectedGroupStats.distributionByRR },
            { title: 'Take Profit', data: selectedGroupStats.distributionByTakeProfit },
            { title: 'Stoploss', data: selectedGroupStats.distributionByStoploss },
            { title: 'Close Type', data: selectedGroupStats.distributionByCloseType },
        ];

        for (const dist of distributions) {
            if (dist.data) {
                for (const [key, value] of Object.entries(dist.data)) {
                    const percentage = (value / total) * 100;
                    if (percentage >= 70) {
                        foundPatterns.push({ percentage: parseFloat(percentage.toFixed(0)), title: dist.title, key });
                    }
                }
            }
        }

        if (foundPatterns.length === 0) {
            return "No single parameter shows a concentration of 70% or more.";
        }
        return foundPatterns;
    }, [selectedGroupStats]);
    
    const DistributionChart: React.FC<{ title: string; data: Record<string, number>; total: number }> = ({ title, data, total }) => {
        const sortedData = Object.entries(data).sort(([, a], [, b]) => Number(b) - Number(a));
        if (sortedData.length === 0) return null;

        return (
            <div>
                <h4 className="text-sm font-semibold text-[#8A91A8] mb-3 uppercase">{title}</h4>
                <div className="space-y-4 text-sm">
                    {sortedData.map(([key, value]) => {
                        const percentage = total > 0 ? (Number(value) / total) * 100 : 0;
                        return (
                            <div key={key}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[#F0F0F0] truncate">{key}</span>
                                    <span className="text-right text-[#8A91A8] font-medium">{value} ({percentage.toFixed(0)}%)</span>
                                </div>
                                <div className="w-full bg-gray-700 rounded-full h-1.5">
                                    <div className="bg-[#3B82F6] h-1.5 rounded-full" style={{ width: `${percentage}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const PeriodButton: React.FC<{p: Period, label: string}> = ({ p, label }) => (
        <button 
          onClick={() => setPeriod(p)}
          className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-[#3B82F6] text-white' : 'bg-gray-700 hover:bg-gray-600 text-[#8A91A8] hover:text-white'}`}
        >
          {label}
        </button>
      );
    
    return (
        <div>
             <div className="mb-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white flex-shrink-0">Trade Analysis</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <PeriodButton p="this-month" label="This Month" />
                        <PeriodButton p="last-month" label="Last Month" />
                        <PeriodButton p="this-quarter" label="This Quarter" />
                        <PeriodButton p="all" label="All Time" />
                    </div>
                </div>
                <div className="mt-4 flex justify-start md:justify-end">
                    <div>
                        <label htmlFor="accountFilterAnalysis" className="text-sm text-[#8A91A8] mr-2">Account:</label>
                        <select 
                            id="accountFilterAnalysis"
                            value={selectedAccountId}
                            onChange={(e) => setSelectedAccountId(e.target.value)}
                            className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                        >
                            <option value="all">All Accounts</option>
                            {activeAccounts.map(acc => (
                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
            
            {analysisTrades.length === 0 ? (
                <DataCard title="Performance Analysis">
                    <NoData message="Add some trades in the selected period to see your analysis." />
                </DataCard>
            ) : (
                <div className="space-y-8">
                    <DataCard title="Performance Group Comparison">
                        <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-700/50 pb-4">
                            {(Object.keys(analysisData) as AnalysisGroup[]).map(group => (
                                <button 
                                    key={group} 
                                    onClick={() => setActiveGroup(group)}
                                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${activeGroup === group ? 'bg-[#3B82F6] text-white' : 'bg-[#2A2F3B] hover:bg-gray-700 text-[#8A91A8] hover:text-white'}`}>
                                    {group} ({analysisData[group]?.count || 0})
                                </button>
                            ))}
                        </div>
                        {selectedGroupStats && selectedGroupStats.count > 0 ? (
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Distributions for {activeGroup} Trades</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-8">
                                    <DistributionChart title="By Entry Type" data={selectedGroupStats.distributionByEntry} total={selectedGroupStats.count} />
                                    <DistributionChart title="By Direction" data={selectedGroupStats.distributionByDirection} total={selectedGroupStats.count} />
                                    <DistributionChart title="By Pair" data={selectedGroupStats.distributionByPair} total={selectedGroupStats.count} />
                                    <DistributionChart title="By Day of Week" data={selectedGroupStats.distributionByDay} total={selectedGroupStats.count} />
                                    <DistributionChart title="By R:R" data={selectedGroupStats.distributionByRR} total={selectedGroupStats.count} />
                                    {activeGroup === Result.Win && selectedGroupStats.distributionByTakeProfit && <DistributionChart title="By Take Profit" data={selectedGroupStats.distributionByTakeProfit} total={selectedGroupStats.count} />}
                                    {activeGroup === Result.Loss && selectedGroupStats.distributionByStoploss && <DistributionChart title="By Stoploss" data={selectedGroupStats.distributionByStoploss} total={selectedGroupStats.count} />}
                                    {activeGroup !== Result.Missed && selectedGroupStats.distributionByCloseType && <DistributionChart title="By Close Type" data={selectedGroupStats.distributionByCloseType} total={selectedGroupStats.count} />}
                                </div>
                            </div>
                        ) : <NoData message={`No trades found for ${activeGroup}s in this period.`} />}
                    </DataCard>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <DataCard title="Streak Analysis">
                            {streaks.longestWinStreak > 0 || streaks.longestLossStreak > 0 ? (
                                <div className="space-y-6 text-center">
                                    <div>
                                        <p className="text-[#8A91A8] text-xs uppercase">Longest Win Streak</p>
                                        <p className="text-3xl font-bold text-[#10B981]">{streaks.longestWinStreak}</p>
                                    </div>
                                     <div>
                                        <p className="text-[#8A91A8] text-xs uppercase">Longest Loss Streak</p>
                                        <p className="text-3xl font-bold text-[#EF4444]">{streaks.longestLossStreak}</p>
                                    </div>
                                    <div>
                                        <p className="text-[#8A91A8] text-xs uppercase">Current Streak</p>
                                        {streaks.currentStreak.type !== 'none' ? (
                                            <>
                                                <p className={`text-5xl font-bold ${streaks.currentStreak.type === 'win' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{streaks.currentStreak.count}</p>
                                                <p className={`text-base ${streaks.currentStreak.type === 'win' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{streaks.currentStreak.type === 'win' ? 'Wins' : 'Losses'}</p>
                                            </>
                                        ) : <p className="text-5xl font-bold text-[#8A91A8]">N/A</p>}
                                    </div>
                                </div>
                            ) : <NoData />}
                        </DataCard>

                        <DataCard title="Patterns & Correlations" >
                            <div className="text-[#F0F0F0] text-sm flex-grow">
                                {typeof patterns === 'string' ? (
                                    <div className="flex items-center justify-center h-full text-[#8A91A8]">{patterns}</div>
                                ) : Array.isArray(patterns) && patterns.length > 0 ? (
                                    <div className="space-y-3">
                                        {patterns.map((p, i) => (
                                            <div key={i}>
                                                <span className="text-[#8A91A8]"><span className="font-bold">{p.percentage}% </span>{p.title}: </span>
                                                <span className="font-semibold text-[#F0F0F0] ml-2">{p.key}</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : <div className="flex items-center justify-center h-full text-[#8A91A8]">No significant patterns found.</div>}
                            </div>
                        </DataCard>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisView;
