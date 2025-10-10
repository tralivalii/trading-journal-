// FIX: Added full content for App.tsx
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Account, Trade, Stats, Result, User, Note, UserData } from './types';
import { AppProvider, useAppContext, deleteTradeAction, saveTradeAction } from './services/appState';
import TradesList from './components/TradesList';
import Modal from './components/ui/Modal';
import TradeForm from './components/TradeForm';
import AccountForm from './components/AccountForm';
import TradeDetail from './components/TradeDetail';
// FIX: Changed import to be a relative path
import DataView from './components/DataView';
// FIX: Changed import to be a relative path
import NotesView from './components/NotesView';
import { calculateStats, filterTradesByPeriod } from './services/statisticsService';
import { analyzeTradeGroups, calculateStreaks } from './services/analysisService';
import Auth from './components/Auth';
import { ICONS } from './constants';
import { supabase } from './services/supabase';

declare const Chart: any;

type View = 'journal' | 'dashboard' | 'notes' | 'data'; 
type Period = 'week' | 'month' | 'quarter' | 'all';
type AnalysisGroup = Result.Win | Result.Loss | Result.Breakeven | Result.Missed;


const StatCard: React.FC<{ label: string, value: string | number, className?: string }> = ({ label, value, className }) => {
    const valueStr = String(value);
    const fontSizeClass = valueStr.length > 8 ? 'text-xl' : 'text-2xl';
    
    return (
        <div className="bg-[#232733] p-4 rounded-lg border border-gray-700/50 text-center flex flex-col justify-center">
            <p className="text-sm font-medium text-[#8A91A8] uppercase tracking-wider">{label}</p>
            <p className={`font-bold ${fontSizeClass} ${className}`}>{value}</p>
        </div>
    );
};

const DataCard: React.FC<{ title: string, children: React.ReactNode, className?: string, headerAction?: React.ReactNode }> = ({ title, children, className, headerAction }) => (
    <div className={`bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col ${className}`}>
        <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {headerAction && <div>{headerAction}</div>}
        </div>
        <div className="p-4 flex-grow flex flex-col">{children}</div>
    </div>
);

const NoData: React.FC<{ message?: string, onAction?: () => void, actionText?: string }> = ({ message, onAction, actionText }) => (
    <div className="text-center py-8 text-[#8A91A8] flex-grow flex flex-col items-center justify-center gap-4">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p>{message || "Not enough data to display."}</p>
        {onAction && actionText && (
            <button 
                onClick={onAction}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors mt-2"
            >
               <span className="w-5 h-5">{ICONS.plus}</span> {actionText}
            </button>
        )}
    </div>
);


const Dashboard: React.FC<{ onAddTrade: () => void }> = ({ onAddTrade }) => {
    const { state } = useAppContext();
    const { trades, accounts } = state.userData!;

    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        accounts.forEach(acc => {
          if (!acc.isArchived) {
            const accountTrades = trades.filter(t => t.accountId === acc.id);
            const netPnl = accountTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
            balances.set(acc.id, acc.initialBalance + netPnl);
          }
        });
        return balances;
    }, [trades, accounts]);

    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);
    const activeAccountIds = useMemo(() => new Set(activeAccounts.map(a => a.id)), [activeAccounts]);
    const tradesForStats = useMemo(() => trades.filter(t => activeAccountIds.has(t.accountId)), [trades, activeAccountIds]);
    
    const [period, setPeriod] = useState<Period>('month');
    const [isBalancesModalOpen, setIsBalancesModalOpen] = useState(false);
    const filteredTrades = useMemo(() => filterTradesByPeriod(tradesForStats, period), [tradesForStats, period]);
    const stats: Stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

    const formatCurrency = (amount: number, currency: string | undefined = 'USD') => amount.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPercent = (value: number) => `${value.toFixed(2)}%`;
    const formatRR = (value: number) => `${value.toFixed(2)}R`;

    const mainCurrency = activeAccounts.length > 0 ? (activeAccounts[0].currency || 'USD') : 'USD';
    const totalBalance = useMemo(() => Array.from(accountBalances.values()).reduce((sum: number, balance: number) => sum + balance, 0), [accountBalances]);
    
    const [activeGroup, setActiveGroup] = useState<AnalysisGroup>(Result.Loss);

    const analysisTrades = useMemo(() => {
        const periodMap: { [key in Period]: 'week' | 'this-month' | 'this-quarter' | 'all' } = {
            week: 'week',
            month: 'this-month',
            quarter: 'this-quarter',
            all: 'all',
        };
        return filterTradesByPeriod(tradesForStats, periodMap[period]);
    }, [tradesForStats, period]);

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

        if (sortedData.length === 0) return (
            <div>
                 <h4 className="text-sm font-semibold text-[#8A91A8] mb-3 uppercase">{title}</h4>
                 <div className="text-sm text-[#8A91A8]">No data available.</div>
            </div>
        );

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

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-white">Dashboard</h1>
                <div className="flex flex-wrap items-center gap-2 mt-4">
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

            <div 
                className="bg-[#232733] p-6 rounded-lg border border-gray-700/50 text-center cursor-pointer hover:border-[#3B82F6] transition-colors flex flex-col justify-center mb-8"
                onClick={() => setIsBalancesModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setIsBalancesModalOpen(true)}
              >
                <p className="text-base font-medium text-[#8A91A8] uppercase tracking-wider">Total Balance</p>
                <p className="font-bold text-[#F0F0F0]" style={{fontSize: 'clamp(1.75rem, 5vw, 2.5rem)'}}>{formatCurrency(totalBalance, mainCurrency)}</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                 <StatCard label="Net Profit" value={formatCurrency(stats.netProfit, mainCurrency)} className={stats.netProfit >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}/>
                 <StatCard label="Total Trades" value={stats.totalTrades} className="text-[#F0F0F0]" />
                 <StatCard label="Win Rate" value={formatPercent(stats.winRate)} className={stats.winRate >= 50 ? 'text-[#10B981]' : 'text-[#EF4444]' }/>
                 <StatCard label="Avg R:R" value={formatRR(stats.averageRR)} className="text-[#F0F0F0]"/>
                 <StatCard label="Total RR" value={formatRR(stats.totalRR)} className="text-[#F0F0F0]"/>
                 <StatCard label="W/L/B/M" value={`${stats.wins}/${stats.losses}/${stats.breakevens}/${stats.missed}`} className="text-[#F0F0F0]"/>
            </div>

            <div className="mt-12 space-y-8">
                 <div className="flex justify-between items-center flex-wrap gap-4">
                     <h2 className="text-3xl font-bold text-white">Trade Analysis</h2>
                </div>

                {trades.length === 0 ? (
                    <DataCard title="Performance Analysis">
                        <NoData message="Add some trades to see your analysis." onAction={onAddTrade} actionText="Add New Trade" />
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
                                        {activeGroup === Result.Win && selectedGroupStats.distributionByTakeProfit && (
                                            <DistributionChart title="By Take Profit" data={selectedGroupStats.distributionByTakeProfit} total={selectedGroupStats.count} />
                                        )}
                                        {activeGroup === Result.Loss && selectedGroupStats.distributionByStoploss && (
                                            <DistributionChart title="By Stoploss" data={selectedGroupStats.distributionByStoploss} total={selectedGroupStats.count} />
                                        )}
                                        {activeGroup !== Result.Missed && selectedGroupStats.distributionByCloseType && (
                                            <DistributionChart title="By Close Type" data={selectedGroupStats.distributionByCloseType} total={selectedGroupStats.count} />
                                        )}
                                    </div>
                                </div>
                            ) : <NoData message={`No trades found for ${activeGroup}s.`} />}
                        </DataCard>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                             <DataCard title="Streak Analysis" className="lg:col-span-1">
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
                                                    <p className={`text-5xl font-bold ${streaks.currentStreak.type === 'win' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                                        {streaks.currentStreak.count}
                                                    </p>
                                                    <p className={`text-base ${streaks.currentStreak.type === 'win' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                                        {streaks.currentStreak.type === 'win' ? 'Wins' : 'Losses'}
                                                    </p>
                                                </>
                                            ) : (
                                                <p className="text-5xl font-bold text-[#8A91A8]">N/A</p>
                                            )}
                                        </div>
                                    </div>
                                ) : <NoData />}
                            </DataCard>

                            <DataCard 
                                title="Patterns & Correlations" 
                                className="lg:col-span-2"
                                headerAction={
                                    <div className="relative group">
                                        <button className="text-[#8A91A8] hover:text-white transition-colors" aria-label="View Details">
                                            <span className="w-5 h-5">{ICONS.eye}</span>
                                        </button>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                            View Details
                                        </div>
                                    </div>
                                }
                            >
                                <div className="text-[#F0F0F0] text-sm flex-grow">
                                    {typeof patterns === 'string' ? (
                                        <div className="flex items-center justify-center h-full text-[#8A91A8]">{patterns}</div>
                                    ) : Array.isArray(patterns) && patterns.length > 0 ? (
                                        <div className="space-y-3">
                                            {patterns.map((p, i) => (
                                                <div key={i}>
                                                    <span className="text-[#8A91A8]">
                                                        <span className="font-bold">{p.percentage}% </span>
                                                        {p.title}: 
                                                    </span>
                                                    <span className="font-semibold text-[#F0F0F0] ml-2">{p.key}</span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-[#8A91A8]">No significant patterns found.</div>
                                    )}
                                </div>
                            </DataCard>
                        </div>
                    </div>
                )}
            </div>
            
            <Modal isOpen={isBalancesModalOpen} onClose={() => setIsBalancesModalOpen(false)} title="Account Balances">
                 <div className="space-y-3">
                     {activeAccounts.map(acc => (
                         <div key={acc.id} className="grid grid-cols-3 items-center text-sm p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                             <div className="col-span-2">
                                <span className="font-semibold text-white">{acc.name}</span>
                                <br />
                                <span className="text-xs text-[#8A91A8]">Initial: {formatCurrency(acc.initialBalance, acc.currency)}</span>
                             </div>
                             <span className="text-lg font-bold text-right text-cyan-400">{formatCurrency(accountBalances.get(acc.id) ?? 0, acc.currency)}</span>
                         </div>
                     ))}
                     {activeAccounts.length === 0 && <p className="text-center text-[#8A91A8] py-4">No accounts created yet.</p>}
                 </div>
             </Modal>
        </div>
    );
}

// A more resilient function to get or create user settings.
// It prioritizes returning valid settings over throwing an error, to prevent the app from getting stuck.
const getUserSettings = async (userId: string): Promise<Omit<UserData, 'trades'|'accounts'|'notes'>> => {
    const defaultSettings = {
        pairs: ['EUR/USD', 'EUR/GBP', 'XAU/USD', 'BTC/USDT', 'ETH/USDT', 'XRP/USDT'],
        entries: ['2.0', 'Market', 'Order block', 'FVG', 'IDM'],
        risks: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5],
        defaultSettings: { accountId: '', pair: 'EUR/USD', entry: '2.0', risk: 1 },
        stoplosses: ['Session High/Low', 'FVG', 'Order block'],
        takeprofits: ['Session High/Low', 'FVG', 'Order block'],
        closeTypes: ['SL Hit', 'TP Hit', 'Manual', 'Breakeven'],
    };

    // 1. Try to fetch existing settings
    const { data, error } = await supabase
        .from('user_data')
        .select('data')
        .eq('user_id', userId)
        .single();

    // 2. If data is successfully fetched, return it
    if (data) {
        return data.data;
    }

    // 3. If there was an error, but it's NOT "no rows found", log it and return defaults as a fallback.
    // This handles network errors or RLS issues without crashing the app.
    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching user settings, falling back to defaults:', error);
        return defaultSettings;
    }

    // 4. If no settings were found (PGRST116), try to create them.
    const { error: insertError } = await supabase
        .from('user_data')
        .insert({ user_id: userId, data: defaultSettings });

    // 5. If the insert fails, log the error but still return defaults so the app can load.
    if (insertError) {
        console.error('Error creating default user data, falling back to defaults:', insertError);
    }
    
    // 6. Return defaults in all failure or creation scenarios.
    return defaultSettings;
};

const TOAST_ICONS = {
  success: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  error: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  close: (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};


function AppContent() {
  const { state, dispatch } = useAppContext();
  const { session, currentUser, userData, isLoading, isGuest } = state;

  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const [isDetailModalOpen, setDetailModalOpen] = useState(false);
  const [isDeleteConfirmModalOpen, setDeleteConfirmModalOpen] = useState(false);
  const [isDeleteTradeModalOpen, setDeleteTradeModalOpen] = useState(false);
  const [isFirstAccountModalOpen, setFirstAccountModalOpen] = useState(false);
  const [tradeIdToDelete, setTradeIdToDelete] = useState<string | null>(null);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [tradeToView, setTradeToView] = useState<Trade | null>(null);
  const [activeView, setActiveView] = useState<View>('journal');
  const [isLogoutConfirmModalOpen, setLogoutConfirmModalOpen] = useState(false);
  
  const [showFab, setShowFab] = useState(true);
  const lastScrollY = useRef(0);

  const [toast, setToast] = useState<{ message: string; id: number; type: 'success' | 'error' } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const closeToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast(null);
  }, []);
  
  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setToast({ message, id: Date.now(), type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  useEffect(() => {
    if (currentUser && !userData && !isGuest) {
      const fetchUserData = async () => {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        
        try {
            // Fetch all data in parallel
            const [
              userSettings,
              { data: accountsData, error: accountsError },
              { data: tradesData, error: tradesError },
              { data: notesData, error: notesError }
            ] = await Promise.all([
              getUserSettings(currentUser.id),
              supabase.from('accounts').select('*').eq('user_id', currentUser.id),
              supabase.from('trades').select('*').eq('user_id', currentUser.id),
              supabase.from('notes').select('*').eq('user_id', currentUser.id)
            ]);

            if (accountsError || tradesError || notesError) {
              throw accountsError || tradesError || notesError;
            }
            
            const fullUserData: UserData = {
              ...userSettings,
              accounts: (accountsData || []).map((a: any) => ({
                  id: a.id,
                  name: a.name,
                  initialBalance: a.initial_balance,
                  currency: a.currency,
                  isArchived: a.is_archived
              })),
              trades: (tradesData || []).map((t: any) => ({...t, accountId: t.account_id, riskAmount: t.risk_amount, closeType: t.close_type, analysisD1: t.analysis_d1, analysis1h: t.analysis_1h, analysis5m: t.analysis_5m, analysisResult: t.analysis_result })),
              notes: (notesData || []).map((n: any) => ({
                ...n,
                tags: Array.isArray(n.tags) ? n.tags : (typeof n.tags === 'string' && n.tags.startsWith('[')) ? JSON.parse(n.tags) : []
              }))
            };
            
            dispatch({ type: 'SET_USER_DATA', payload: fullUserData });

        } catch (error) {
            console.error('Error fetching data:', error);
            // Optional: show a toast message to the user
        } finally {
            dispatch({ type: 'SET_IS_LOADING', payload: false });
        }
      };
      
      fetchUserData();
    } else if (!currentUser && !isGuest) {
       dispatch({ type: 'SET_USER_DATA', payload: null });
    }
  }, [currentUser, userData, dispatch, isGuest]);

  const controlFabVisibility = useCallback(() => {
      if (window.scrollY > lastScrollY.current && window.scrollY > 100) {
          setShowFab(false);
      } else {
          setShowFab(true);
      }
      lastScrollY.current = window.scrollY;
  }, []);

  useEffect(() => {
      window.addEventListener('scroll', controlFabVisibility);
      return () => {
          window.removeEventListener('scroll', controlFabVisibility);
      };
  }, [controlFabVisibility]);

  const activeAccounts = useMemo(() => userData?.accounts.filter(a => !a.isArchived) || [], [userData]);

  const handleAddTrade = () => {
    if (isGuest) {
        showToast("This feature is disabled in guest mode.", 'error');
        return;
    }
    if (activeAccounts.length === 0) {
      setFirstAccountModalOpen(true);
    } else {
      setTradeToEdit(null);
      setFormModalOpen(true);
    }
  };

  const handleEditTrade = (trade: Trade) => {
    if (isGuest) {
        showToast("This feature is disabled in guest mode.", 'error');
        return;
    }
    setTradeToEdit(trade);
    setFormModalOpen(true);
  };

  const handleViewTrade = (trade: Trade) => {
    setTradeToView(trade);
    setDetailModalOpen(true);
  }

  const handleEditFromDetail = (trade: Trade) => {
    setDetailModalOpen(false);
    setTimeout(() => {
        handleEditTrade(trade);
    }, 150); 
  };

  const handleDeleteTrade = (id: string) => {
    if (isGuest) {
        showToast("This feature is disabled in guest mode.", 'error');
        return;
    }
    setTradeIdToDelete(id);
    setDeleteTradeModalOpen(true);
  };

  const handleConfirmDeleteTrade = async () => {
    if (tradeIdToDelete) {
        try {
            await deleteTradeAction(dispatch, state, tradeIdToDelete, showToast);
            showToast('Trade deleted successfully.', 'success');
        } catch (error) {
            console.error(error);
            showToast('Failed to delete trade.', 'error');
        }
    }
    setDeleteTradeModalOpen(false);
    setTradeIdToDelete(null);
  };

  const handleSaveTrade = async (tradeDataFromForm: Omit<Trade, 'id' | 'riskAmount' | 'pnl'>) => {
    try {
        await saveTradeAction(dispatch, state, tradeDataFromForm, !!tradeToEdit, showToast);
        if (!isGuest) {
            showToast(tradeToEdit ? 'Trade updated successfully.' : 'Trade added successfully.', 'success');
        }
        setFormModalOpen(false);
        setTradeToEdit(null);
    } catch(error) {
        console.error(error);
        showToast('Failed to save trade.', 'error');
    }
  };
  
  const handleSaveFirstAccount = async (accountData: Omit<Account, 'id'>) => {
    if (isGuest || !currentUser) {
        return;
    }
    try {
        const dbPayload = {
            name: accountData.name,
            initial_balance: accountData.initialBalance,
            currency: accountData.currency,
            user_id: currentUser.id,
        };

        const { data: savedData, error } = await supabase
            .from('accounts')
            .insert(dbPayload)
            .select()
            .single();

        if (error) throw error;

        const appAccount: Account = {
            id: savedData.id,
            name: savedData.name,
            initialBalance: savedData.initial_balance,
            currency: savedData.currency,
            isArchived: savedData.is_archived
        };
        
        dispatch({ type: 'UPDATE_ACCOUNTS', payload: [...(userData?.accounts || []), appAccount] });
        showToast('Account created! Now you can add your first trade.', 'success');
        setFirstAccountModalOpen(false);
        
        setTimeout(() => {
            setTradeToEdit(null);
            setFormModalOpen(true);
        }, 150);

    } catch (error: any) {
        console.error('Failed to save first account:', error);
        showToast(`Failed to save account: ${error.message}`, 'error');
    }
  };

  const handleLogout = () => {
    if (isGuest) {
        window.location.reload();
        return;
    }
    setLogoutConfirmModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'SET_SESSION', payload: null });
    setLogoutConfirmModalOpen(false);
  };
  
  const handleDeleteUserAccount = async () => {
    alert("This functionality requires server-side logic to properly delete a user and is not implemented in this example.");
    setDeleteConfirmModalOpen(false);
  };

  const NavItem: React.FC<{view: View, label: string}> = ({view, label}) => (
      <button 
        onClick={() => setActiveView(view)} 
        className={`px-3 py-2 rounded-md text-sm font-medium transition-colors relative ${activeView === view ? 'text-[#F0F0F0]' : 'text-[#8A91A8] hover:text-[#F0F0F0]'}`}
      >
        {label}
        {activeView === view && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#3B82F6] rounded-full"></span>}
      </button>
  );

  if (!session) {
    return <Auth />;
  }

  if (isLoading || !userData) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1A1D26] text-white">
            <div className="text-xl animate-pulse">Loading Your Journal...</div>
        </div>
    );
  }

  return (
    <div className="bg-[#1A1D26] text-[#F0F0F0] min-h-screen font-sans">
      <div className="container mx-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4 w-full justify-center md:w-auto md:justify-start">
                <NavItem view="journal" label="Journal" />
                <NavItem view="dashboard" label="Dashboard" />
                <NavItem view="notes" label="Notes" />
                <NavItem view="data" label="Data" />
            </div>
            <div className="flex items-center gap-4 w-full justify-center md:w-auto mt-4 md:mt-0">
                <div className="flex items-center gap-4">
                    <span className="text-sm text-[#8A91A8] hidden sm:inline">{currentUser?.email}</span>
                    <button onClick={handleLogout} className="text-sm font-medium text-[#8A91A8] hover:text-[#3B82F6] transition-colors">
                        Logout
                    </button>
                </div>
            </div>
        </header>

        {isGuest && (
            <div className="container mx-auto -mt-4 mb-6">
                <div className="bg-yellow-500/20 border border-yellow-500 text-yellow-300 px-4 py-3 rounded-lg text-center text-sm" role="alert">
                    You are in <strong>Guest Mode</strong>. Your data will not be saved. <a href="/" className="font-bold underline hover:text-white">Sign Up or Sign In</a> to start your journal.
                </div>
            </div>
        )}

        <main>
          {activeView === 'journal' && <TradesList onEdit={handleEditTrade} onView={handleViewTrade} onDelete={handleDeleteTrade} onAddTrade={handleAddTrade}/>}
          {activeView === 'dashboard' && <Dashboard onAddTrade={handleAddTrade} />}
          {activeView === 'notes' && <NotesView showToast={showToast} />}
          {activeView === 'data' && <DataView onInitiateDeleteAccount={() => setDeleteConfirmModalOpen(true)} showToast={showToast} />}
        </main>
      </div>

      {activeView === 'journal' && (
        <button
            onClick={handleAddTrade}
            className={`fixed bottom-6 right-6 w-14 h-14 bg-[#3B82F6] rounded-full text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] transform transition-transform duration-300 ease-in-out ${showFab ? 'scale-100' : 'scale-0'}`}
            aria-label="Add New Trade"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
        </button>
      )}

      {toast && (
        <div key={toast.id} className="fixed top-5 right-5 w-full max-w-sm z-[100] animate-toast-in-out">
            <div className="bg-[#2A2F3B] rounded-lg shadow-2xl border border-gray-700/50 flex overflow-hidden">
                <div className={`w-1.5 flex-shrink-0 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div className="p-4 flex items-start gap-3 flex-grow">
                    <div className={`w-6 h-6 flex-shrink-0 ${toast.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                        {toast.type === 'success' ? TOAST_ICONS.success : TOAST_ICONS.error}
                    </div>
                    <div className="flex-grow text-sm text-gray-200 pt-0.5">
                        <p>{toast.message}</p>
                    </div>
                    <button onClick={closeToast} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full" aria-label="Close notification">
                        <span className="w-5 h-5 block">{TOAST_ICONS.close}</span>
                    </button>
                </div>
            </div>
        </div>
      )}
      <style>{`
        @keyframes toast-in-out {
          0% { opacity: 0; transform: translateX(100%); }
          15% { opacity: 1; transform: translateX(0); }
          85% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(100%); }
        }
        .animate-toast-in-out {
          animation: toast-in-out 4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>

      <Modal isOpen={isFormModalOpen} onClose={() => setFormModalOpen(false)} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} size="4xl">
        <TradeForm onSave={handleSaveTrade} onCancel={() => setFormModalOpen(false)} tradeToEdit={tradeToEdit} accounts={activeAccounts} />
      </Modal>
      
      <Modal isOpen={isDetailModalOpen} onClose={() => setDetailModalOpen(false)} title="Trade Details" size="4xl">
        {tradeToView && <TradeDetail 
            trade={tradeToView} 
            account={userData.accounts.find(a => a.id === tradeToView.accountId)} 
            onEdit={handleEditFromDetail}
        />}
      </Modal>

      <Modal isOpen={isFirstAccountModalOpen} onClose={() => setFirstAccountModalOpen(false)} title="Create Your First Account">
        <div>
            <div className="text-center text-gray-300 mb-6">
                <p>To log a trade, you first need an account.</p>
                <p className="text-sm text-gray-500 mt-1">This represents your trading account with its starting balance.</p>
            </div>
            <AccountForm onSave={handleSaveFirstAccount} onCancel={() => setFirstAccountModalOpen(false)} accountToEdit={null} />
        </div>
      </Modal>

      <Modal isOpen={isDeleteConfirmModalOpen} onClose={() => setDeleteConfirmModalOpen(false)} title="Confirm Account Deletion">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to permanently delete your account and all of your data? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeleteConfirmModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleDeleteUserAccount} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete My Account</button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isDeleteTradeModalOpen} onClose={() => setDeleteTradeModalOpen(false)} title="Confirm Trade Deletion">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to permanently delete this trade? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setDeleteTradeModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleConfirmDeleteTrade} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete Trade</button>
            </div>
        </div>
      </Modal>
      
      <Modal isOpen={isLogoutConfirmModalOpen} onClose={() => setLogoutConfirmModalOpen(false)} title="Confirm Logout">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setLogoutConfirmModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button onClick={handleConfirmLogout} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Logout</button>
            </div>
        </div>
      </Modal>

    </div>
  );
}

const App: React.FC = () => (
    <AppContent />
);

export default App;
