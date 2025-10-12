








import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Account, Trade, Stats, Result, User, Note, UserData } from './types';
import { AppProvider, useAppContext, deleteTradeAction, saveTradeAction, SyncStatus, saveAccountAction, deleteAccountAction, saveNoteAction, deleteNoteAction } from './services/appState';
import TradesList from './components/TradesList';
import Modal from './components/ui/Modal';
import TradeForm from './components/TradeForm';
import AccountForm from './components/AccountForm';
import TradeDetail from './components/TradeDetail';
import DataView from './components/DataView';
import NotesView from './components/NotesView';
import AnalysisView from './components/AnalysisView';
import { calculateStats, filterTradesByPeriod } from './services/statisticsService';
import { generateTemporalData } from './services/analysisService';
import Auth from './components/Auth';
import { ICONS } from './constants';
import { supabase } from './services/supabase';
import { getTable, bulkPut, getSyncQueue, clearSyncQueue } from './services/offlineService';
import DropdownMenu from './components/ui/DropdownMenu';

declare const Chart: any;

const TRADES_PAGE_SIZE = 25;
const NOTES_PAGE_SIZE = 20;

type View = 'journal' | 'dashboard' | 'analysis' | 'notes' | 'data'; 
type Period = 'week' | 'month' | 'quarter' | 'all' | 'this-month' | 'last-month' | 'this-quarter';

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

const EquityChart: React.FC<{ trades: Trade[] }> = ({ trades }) => {
    const chartRef = useRef<HTMLCanvasElement>(null);
    const chartInstance = useRef<any>(null);

    useEffect(() => {
        if (!chartRef.current || trades.length < 2) {
             if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
            return;
        }

        const chartData = generateTemporalData(trades);
        
        if (chartInstance.current) {
            chartInstance.current.data = {
                labels: chartData.labels,
                datasets: [{
                    data: chartData.data,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    pointBackgroundColor: chartData.pointColors,
                    fill: true,
                    tension: 0.2,
                    borderWidth: 2,
                }]
            };
            chartInstance.current.update();
        } else {
            const ctx = chartRef.current.getContext('2d');
            if (ctx) {
                 chartInstance.current = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: chartData.labels,
                        datasets: [{
                            label: 'Equity Curve',
                            data: chartData.data,
                            borderColor: '#3B82F6',
                            backgroundColor: 'rgba(59, 130, 246, 0.1)',
                            pointBackgroundColor: chartData.pointColors,
                            fill: true,
                            tension: 0.2,
                            borderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: '#2A2F3B',
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 12 },
                                padding: 10,
                                cornerRadius: 4,
                                displayColors: false,
                            },
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(138, 145, 168, 0.1)' },
                                ticks: { color: '#8A91A8', maxRotation: 0, autoSkip: true, maxTicksLimit: 7 },
                            },
                            y: {
                                grid: { color: 'rgba(138, 145, 168, 0.1)' },
                                ticks: { color: '#8A91A8' },
                            }
                        }
                    }
                });
            }
        }
        
        return () => {
            if (chartInstance.current) {
                chartInstance.current.destroy();
                chartInstance.current = null;
            }
        };

    }, [trades]);

    return (
        <div className="relative h-64 md:h-80">
            {trades.length < 2 ? (
                <NoData message="At least 2 trades are needed to show the equity curve." />
            ) : (
                <canvas ref={chartRef}></canvas>
            )}
        </div>
    );
};


const Dashboard: React.FC<{ onAddTrade: () => void }> = ({ onAddTrade }) => {
    const { state } = useAppContext();
    const { trades, accounts } = state.userData!;
    
    const [period, setPeriod] = useState<Period>('this-month');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    const [isBalancesModalOpen, setIsBalancesModalOpen] = useState(false);
    
    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);
    
    const accountBalances = useMemo(() => {
        const balances = new Map<string, number>();
        activeAccounts.forEach(acc => {
          const accountTrades = trades.filter(t => t.accountId === acc.id);
          const netPnl = accountTrades.reduce((sum, trade) => sum + Number(trade.pnl), 0);
          balances.set(acc.id, acc.initialBalance + netPnl);
        });
        return balances;
    }, [trades, activeAccounts]);

    const filteredTrades = useMemo(() => {
        const accountFiltered = trades.filter(trade =>
            (selectedAccountId === 'all' ? activeAccounts.some(a => a.id === trade.accountId) : trade.accountId === selectedAccountId)
        );
        return filterTradesByPeriod(accountFiltered, period);
    }, [trades, activeAccounts, selectedAccountId, period]);

    const stats: Stats = useMemo(() => calculateStats(filteredTrades), [filteredTrades]);

    const formatCurrency = (amount: number, currency: string | undefined = 'USD') => amount.toLocaleString('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatPercent = (value: number) => `${value.toFixed(2)}%`;
    const formatRR = (value: number) => `${value.toFixed(2)}R`;

    const balancesSummary = useMemo(() => {
        const summary: Record<string, number> = {};
        if (selectedAccountId !== 'all') {
            const balance = accountBalances.get(selectedAccountId);
            const account = activeAccounts.find(a => a.id === selectedAccountId);
            if (balance !== undefined && account) {
                summary[account.currency || 'USD'] = balance;
            }
        } else {
            activeAccounts.forEach(acc => {
                const balance = accountBalances.get(acc.id);
                if (balance !== undefined) {
                    const currency = acc.currency || 'USD';
                    summary[currency] = (summary[currency] || 0) + balance;
                }
            });
        }
        return summary;
    }, [accountBalances, activeAccounts, selectedAccountId]);

    // FIX: Add explicit return type to useMemo and type the reduce accumulator to ensure correct type inference, resolving 'unknown' type errors.
    const netProfitSummary = useMemo((): Record<string, number> => {
        if (filteredTrades.length === 0) return {};
        
        const accountsMap = new Map<string, Account>(accounts.map(acc => [acc.id, acc]));
    
        return filteredTrades.reduce((summary, trade) => {
            const account = accountsMap.get(trade.accountId);
            const currency = account?.currency || 'USD';
            summary[currency] = (summary[currency] || 0) + trade.pnl;
            return summary;
        }, {} as Record<string, number>);
    }, [filteredTrades, accounts]);


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
                    <h1 className="text-3xl font-bold text-white flex-shrink-0">Dashboard</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <PeriodButton p="this-month" label="This Month" />
                        <PeriodButton p="last-month" label="Last Month" />
                        <PeriodButton p="this-quarter" label="This Quarter" />
                        <PeriodButton p="all" label="All Time" />
                    </div>
                </div>
                <div className="mt-4 flex justify-start md:justify-end">
                    <div>
                        <label htmlFor="accountFilterDashboard" className="text-sm text-[#8A91A8] mr-2">Account:</label>
                        <select 
                            id="accountFilterDashboard"
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

            <div 
                className="bg-[#232733] p-6 rounded-lg border border-gray-700/50 text-center cursor-pointer hover:border-[#3B82F6] transition-colors flex flex-col justify-center mb-8"
                onClick={() => setIsBalancesModalOpen(true)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setIsBalancesModalOpen(true)}
              >
                <p className="text-base font-medium text-[#8A91A8] uppercase tracking-wider">
                    {selectedAccountId === 'all' ? 'Total Balance' : `${activeAccounts.find(a=>a.id === selectedAccountId)?.name} Balance`}
                </p>
                <div className="flex flex-wrap justify-center items-baseline gap-x-6 gap-y-2">
                    {Object.keys(balancesSummary).length > 0 ? (
                        Object.entries(balancesSummary).map(([currency, total]) => (
                             <p key={currency} className="font-bold text-[#F0F0F0]" style={{fontSize: 'clamp(1.75rem, 5vw, 2.5rem)'}}>
                                 {formatCurrency(total, currency)}
                             </p>
                        ))
                    ) : (
                        <p className="font-bold text-[#F0F0F0]" style={{fontSize: 'clamp(1.75rem, 5vw, 2.5rem)'}}>{formatCurrency(0)}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-6 mb-8">
                 <div className="bg-[#232733] p-4 rounded-lg border border-gray-700/50 text-center flex flex-col justify-center">
                    <p className="text-sm font-medium text-[#8A91A8] uppercase tracking-wider">Net Profit</p>
                    <div className="flex flex-col items-center justify-center gap-x-4 gap-y-1">
                        {Object.keys(netProfitSummary).length > 0 ? (
                            Object.entries(netProfitSummary).map(([currency, value]) => (
                                // FIX: With `netProfitSummary` correctly typed, `value` is a number and the `Number()` cast is no longer needed.
                                <p key={currency} className={`font-bold text-2xl ${value >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                                    {formatCurrency(value, currency)}
                                </p>
                            ))
                        ) : (
                            <p className="font-bold text-2xl text-[#F0F0F0]">{formatCurrency(0)}</p>
                        )}
                    </div>
                </div>
                 <StatCard label="Total Trades" value={stats.totalTrades} className="text-[#F0F0F0]" />
                 <StatCard label="Win Rate" value={formatPercent(stats.winRate)} className={stats.winRate >= 50 ? 'text-[#10B981]' : 'text-[#EF4444]' }/>
                 <StatCard label="Avg R:R" value={formatRR(stats.averageRR)} className="text-[#F0F0F0]"/>
                 <StatCard label="Total RR" value={formatRR(stats.totalRR)} className="text-[#F0F0F0]"/>
                 <StatCard label="W/L/B/M" value={`${stats.wins}/${stats.losses}/${stats.breakevens}/${stats.missed}`} className="text-[#F0F0F0]"/>
            </div>

             <div className="mb-8">
                <DataCard title="Equity Curve">
                    <EquityChart trades={filteredTrades} />
                </DataCard>
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

const SyncIndicator: React.FC<{ status: SyncStatus }> = ({ status }) => {
    const indicator = useMemo(() => {
        switch (status) {
            case 'online': return { text: 'Online', color: 'bg-green-500', icon: '✓' };
            case 'offline': return { text: 'Offline', color: 'bg-yellow-500', icon: '!' };
            case 'syncing': return { text: 'Syncing...', color: 'bg-blue-500', icon: '⟳' };
            default: return null;
        }
    }, [status]);

    if (!indicator) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 text-xs font-medium text-white px-3 py-1.5 rounded-full flex items-center gap-2 bg-gray-800 border border-gray-700/50 shadow-lg">
            <span className={`w-2.5 h-2.5 rounded-full ${indicator.color} ${status === 'syncing' ? 'animate-pulse' : ''}`}></span>
            <span>{indicator.text}</span>
        </div>
    );
};

// FIX: Coerce numeric properties to numbers to prevent type errors.
const mapTradeFromDb = (t: any): Trade => ({
    ...t,
    accountId: t.account_id,
    riskAmount: Number(t.risk_amount || 0),
    closeType: t.close_type,
    analysisD1: t.analysis_d1,
    analysis1h: t.analysis_1h,
    analysis5m: t.analysis_5m,
    analysisResult: t.analysis_result,
    aiAnalysis: t.ai_analysis,
    pnl: Number(t.pnl || 0),
    risk: Number(t.risk || 0),
    rr: Number(t.rr || 0),
    commission: t.commission ? Number(t.commission) : undefined,
    entryPrice: t.entry_price ? Number(t.entry_price) : undefined,
    stoplossPrice: t.stoploss_price ? Number(t.stoploss_price) : undefined,
    takeprofitPrice: t.takeprofit_price ? Number(t.takeprofit_price) : undefined,
});

async function processSyncQueue(userId: string) {
    const queue = await getSyncQueue();
    if (queue.length === 0) return true;

    for (const item of queue) {
        try {
            switch (item.type) {
                case 'trade': {
                    const { accountId, riskAmount, closeType, analysisD1, analysis1h, analysis5m, analysisResult, aiAnalysis, ...rest } = item.payload;
                    const supabasePayload = {
                        ...rest,
                        user_id: userId,
                        account_id: accountId,
                        risk_amount: riskAmount,
                        close_type: closeType,
                        analysis_d1: analysisD1,
                        analysis_1h: analysis1h,
                        analysis_5m: analysis5m,
                        analysis_result: analysisResult,
                        ai_analysis: aiAnalysis
                    };
                    
                    if (item.action === 'create' || item.action === 'update') {
                        const { error } = await supabase.from('trades').upsert(supabasePayload);
                        if (error) throw error;
                    } else if (item.action === 'delete') {
                        const { error } = await supabase.from('trades').delete().eq('id', item.payload.id);
                        if (error) throw error;
                    }
                    break;
                }
                case 'account': {
                    const { initialBalance, isArchived, ...rest } = item.payload;
                    const supabasePayload = {
                        ...rest,
                        user_id: userId,
                        initial_balance: initialBalance,
                        is_archived: isArchived
                    };
                    if (item.action === 'create' || item.action === 'update') {
                        const { error } = await supabase.from('accounts').upsert(supabasePayload);
                        if (error) throw error;
                    } else if (item.action === 'delete') {
                        const { error } = await supabase.from('accounts').delete().eq('id', item.payload.id);
                        if (error) throw error;
                    }
                    break;
                }
                case 'note': {
                    const payload = { ...item.payload, user_id: userId };
                    if (item.action === 'create' || item.action === 'update') {
                        const { error } = await supabase.from('notes').upsert(payload);
                        if (error) throw error;
                    } else if (item.action === 'delete') {
                        const { error } = await supabase.from('notes').delete().eq('id', item.payload.id);
                        if (error) throw error;
                    }
                    break;
                }
                 case 'settings': {
                    const { error } = await supabase
                        .from('user_data')
                        .upsert({ user_id: userId, data: item.payload });
                    if (error) throw error;
                    break;
                }
            }
        } catch (error) {
            console.error(`Sync Error (${item.type} ${item.action}):`, error);
            return false; // Stop processing on first error
        }
    }
    
    await clearSyncQueue();
    return true;
}

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

const ToastComponent: React.FC<{
  toast: { id: number; message: string; type: 'success' | 'error' };
  onClose: (id: number) => void;
}> = ({ toast, onClose }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const enterTimer = setTimeout(() => setIsVisible(true), 10);
    
    // Schedule animation out and removal
    const exitTimer = setTimeout(() => {
      setIsVisible(false);
      const removeTimer = setTimeout(() => onClose(toast.id), 300); // Wait for animation
      return () => clearTimeout(removeTimer);
    }, 4000);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [toast.id, onClose]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div className={`w-full max-w-sm transform transition-all duration-300 ease-in-out ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}`}>
        <div className="bg-[#2A2F3B] rounded-lg shadow-2xl border border-gray-700/50 flex overflow-hidden">
            <div className={`w-1.5 flex-shrink-0 ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <div className="p-4 flex items-start gap-3 flex-grow">
                <div className={`w-6 h-6 flex-shrink-0 ${toast.type === 'success' ? 'text-green-500' : 'text-red-500'}`}>
                    {toast.type === 'success' ? TOAST_ICONS.success : TOAST_ICONS.error}
                </div>
                <div className="flex-grow text-sm text-gray-200 pt-0.5">
                    <p>{toast.message}</p>
                </div>
                <button onClick={handleClose} className="text-gray-500 hover:text-white transition-colors flex-shrink-0 -mr-1 -mt-1 p-1 rounded-full" aria-label="Close notification">
                    <span className="w-5 h-5 block">{TOAST_ICONS.close}</span>
                </button>
            </div>
        </div>
    </div>
  );
};


function AppContent() {
  const { state, dispatch } = useAppContext();
  const { session, currentUser, userData, isLoading, isGuest, hasMoreTrades, isFetchingMore, toasts, syncStatus } = state;

  const [isFormModalOpen, setFormModalOpen] = useState(false);
  const tradeFormRef = useRef<{ handleCloseRequest: () => void }>(null);
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
  const prevSyncStatusRef = useRef(syncStatus);
  
  const closeToast = useCallback((id: number) => {
    dispatch({ type: 'HIDE_TOAST', payload: id });
  }, [dispatch]);

  // Stable sync handler
  const handleSync = useCallback(async () => {
      if (syncStatus === 'online' && currentUser && !isGuest) {
          const queue = await getSyncQueue();
          if (queue.length === 0) {
              return; // Nothing to sync
          }

          dispatch({ type: 'SET_SYNC_STATUS', payload: 'syncing' });
          const success = await processSyncQueue(currentUser.id);

          if (success) {
              dispatch({ type: 'SHOW_TOAST', payload: { message: 'Data synced successfully.', type: 'success' } });
          } else {
              dispatch({ type: 'SHOW_TOAST', payload: { message: 'Sync failed. Your changes are still saved locally.', type: 'error' } });
          }
          dispatch({ type: 'SET_SYNC_STATUS', payload: 'online' });
      }
  }, [syncStatus, currentUser, isGuest, dispatch]);

  // Effect to listen for custom sync requests
  useEffect(() => {
      const doSync = () => handleSync();
      window.addEventListener('sync-request', doSync);
      return () => window.removeEventListener('sync-request', doSync);
  }, [handleSync]);

  // Effect to trigger sync when coming back online
  useEffect(() => {
      const wasOffline = prevSyncStatusRef.current === 'offline';
      const isOnlineNow = syncStatus === 'online';

      if (wasOffline && isOnlineNow) {
          console.log("App came back online. Triggering sync.");
          handleSync();
      }

      prevSyncStatusRef.current = syncStatus;
  }, [syncStatus, handleSync]);


  useEffect(() => {
    if (currentUser && !userData && !isGuest) {
      const fetchInitialUserData = async () => {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        
        try {
            // Offline-first: load from IndexedDB immediately
            const [localTrades, localAccounts, localNotes, localSettings] = await Promise.all([
                getTable<Trade>('trades'),
                getTable<Account>('accounts'),
                getTable<Note>('notes'),
                getTable<any>('settings')
            ]);
            
            const localDataExists = localTrades.length > 0 || localAccounts.length > 0;
            if (localDataExists) {
                const settings = localSettings.length > 0 ? localSettings[0].data : {};
                dispatch({ type: 'SET_USER_DATA', payload: { trades: localTrades, accounts: localAccounts, notes: localNotes, ...settings } });
                dispatch({ type: 'SET_IS_LOADING', payload: false });
            }

            // Then, fetch from network to update
            if (navigator.onLine) {
                 const [
                  { data: accountsData, error: accountsError },
                  { data: tradesData, error: tradesError },
                  { data: notesData, error: notesError },
                  { data: userSettingsData, error: settingsError }
                ] = await Promise.all([
                  supabase.from('accounts').select('*').eq('user_id', currentUser.id),
                  supabase.from('trades').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }),
                  supabase.from('notes').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).range(0, NOTES_PAGE_SIZE - 1),
                  supabase.from('user_data').select('data').eq('user_id', currentUser.id).single()
                ]);
                
                if (accountsError || tradesError || notesError || settingsError) {
                    if (!localDataExists) throw accountsError || tradesError || notesError || settingsError;
                    console.warn("Network fetch failed, using local data.", accountsError || tradesError || notesError || settingsError);
                    return; // Keep local data if network fails
                }
                
                const serverTrades = (tradesData || []).map(mapTradeFromDb);
                // FIX: Explicitly type serverAccounts and coerce numeric properties to ensure type safety.
                const serverAccounts: Account[] = (accountsData || []).map((a: any) => ({
                    ...a,
                    initialBalance: Number(a.initial_balance || 0),
                    isArchived: a.is_archived,
                }));
                const serverNotes = (notesData || []) as Note[];
                const serverSettings = userSettingsData?.data || {};

                // Update IndexedDB with fresh data from server
                await Promise.all([
                    bulkPut('trades', serverTrades),
                    bulkPut('accounts', serverAccounts),
                    bulkPut('notes', serverNotes),
                    bulkPut('settings', [{ id: 'user-settings', data: serverSettings }])
                ]);
                
                // Update state
                const fullUserData: UserData = { ...serverSettings, accounts: serverAccounts, trades: serverTrades, notes: serverNotes };
                dispatch({ type: 'SET_USER_DATA', payload: fullUserData });
                dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: [], hasMore: serverNotes.length === NOTES_PAGE_SIZE } });
            }

        } catch (error) {
            console.error('Error fetching data:', error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load your journal. Please refresh.', type: 'error' } });
        } finally {
            dispatch({ type: 'SET_IS_LOADING', payload: false });
        }
      };
      
      fetchInitialUserData();
    } else if (!currentUser && !isGuest) {
       dispatch({ type: 'SET_USER_DATA', payload: null });
    }
  }, [currentUser, userData, dispatch, isGuest]);
  
  const handleLoadMore = useCallback(async () => {
    // This function needs to be re-evaluated in an offline-first context.
    // For now, it will only work online.
    if (isGuest || !currentUser || !userData || isFetchingMore || !navigator.onLine) return;
    dispatch({ type: 'FETCH_MORE_TRADES_START' });
    // ... rest of the online-only load more logic
  }, [currentUser, userData, isGuest, dispatch, isFetchingMore]);


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
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
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
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
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
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
        return;
    }
    setTradeIdToDelete(id);
    setDeleteTradeModalOpen(true);
  };

  const handleConfirmDeleteTrade = async () => {
    if (tradeIdToDelete) {
        await deleteTradeAction(dispatch, state, tradeIdToDelete);
    }
    setDeleteTradeModalOpen(false);
    setTradeIdToDelete(null);
  };

  const handleSaveTrade = async (tradeDataFromForm: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => {
    await saveTradeAction(dispatch, state, tradeDataFromForm, !!tradeToEdit);
    setFormModalOpen(false);
    setTradeToEdit(null);
  };
  
  const handleSaveFirstAccount = async (accountData: Omit<Account, 'id'>) => {
    await saveAccountAction(dispatch, state, accountData, false);
    setFirstAccountModalOpen(false);
    setTimeout(() => {
        handleAddTrade();
    }, 150);
  };

  const handleLogout = () => {
    if (isGuest) { window.location.reload(); return; }
    setLogoutConfirmModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'SET_SESSION', payload: null });
    setLogoutConfirmModalOpen(false);
  };
  
  const handleDeleteUserAccount = async () => {
     if (isGuest || !currentUser) return;
     const { error } = await supabase.rpc('delete_user_account');
     if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error deleting account: ${error.message}`, type: 'error' } });
     } else {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Account deletion initiated. You will be logged out.`, type: 'success' } });
        setTimeout(async () => {
             await supabase.auth.signOut();
             dispatch({ type: 'SET_SESSION', payload: null });
        }, 3000);
     }
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
  
  const handleFormClose = useCallback(() => {
    setFormModalOpen(false);
  }, []);

  if (isLoading) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-[#1A1D26] text-white">
            <div className="flex items-center gap-3">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading user data...</span>
            </div>
        </div>
    );
  }
  
  if (!session && !isGuest) {
    return <Auth />;
  }
  
  if (!userData) {
      return (
         <div className="min-h-screen flex items-center justify-center bg-[#1A1D26] text-white">
            <div className="text-xl">Could not load user data. Please refresh.</div>
        </div>
      )
  }

  return (
    <div className="bg-[#1A1D26] text-[#F0F0F0] min-h-screen font-sans">
      <SyncIndicator status={syncStatus} />
      <div className="container mx-auto p-4 md:p-8">
        <header className="flex justify-between items-center mb-8 flex-wrap gap-4">
            <div className="flex items-center gap-4 w-full justify-center md:w-auto md:justify-start">
                <NavItem view="journal" label="Journal" />
                <NavItem view="dashboard" label="Dashboard" />
                <NavItem view="analysis" label="Analysis" />
                <NavItem view="notes" label="Notes" />
                <NavItem view="data" label="Settings" />
            </div>
            <div className="flex items-center gap-4 w-full justify-center md:w-auto mt-4 md:mt-0">
                <DropdownMenu 
                    trigger={
                        <button className="w-10 h-10 flex items-center justify-center bg-gray-700 rounded-full hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </button>
                    }
                >
                    <div className="p-2">
                        <div className="px-2 py-1 text-sm text-gray-400 truncate">
                            {isGuest ? 'Guest Mode' : currentUser?.email}
                        </div>
                        <div className="my-1 border-t border-gray-700/50"></div>
                        <button 
                            onClick={handleLogout} 
                            className="w-full text-left px-2 py-1.5 text-sm text-red-400 hover:bg-gray-700 rounded-md transition-colors"
                        >
                           {isGuest ? 'Login or Sign Up' : 'Logout'}
                        </button>
                    </div>
                </DropdownMenu>
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
          {activeView === 'journal' && <TradesList onEdit={handleEditTrade} onView={handleViewTrade} onDelete={handleDeleteTrade} onAddTrade={handleAddTrade} onLoadMore={handleLoadMore} hasMore={hasMoreTrades} isFetchingMore={isFetchingMore} />}
          {activeView === 'dashboard' && <Dashboard onAddTrade={handleAddTrade} />}
          {activeView === 'analysis' && <AnalysisView />}
          {activeView === 'notes' && <NotesView />}
          {activeView === 'data' && <DataView onInitiateDeleteAccount={() => setDeleteConfirmModalOpen(true)} />}
        </main>
      </div>

      {activeView === 'journal' && (
        <button
            onClick={handleAddTrade}
            className={`fixed bottom-6 right-6 w-14 h-14 bg-[#3B82F6] rounded-full text-white flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.2)] transform transition-transform duration-300 ease-in-out lg:hidden ${showFab ? 'scale-100' : 'scale-0'}`}
            aria-label="Add New Trade"
        >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
        </button>
      )}

      <div className="fixed top-5 right-5 w-full max-w-sm z-[100] space-y-3">
          {toasts.map((toast) => (
              <ToastComponent key={toast.id} toast={toast} onClose={closeToast} />
          ))}
      </div>

      <Modal 
        isOpen={isFormModalOpen} 
        onClose={handleFormClose}
        onCloseRequest={() => {
            // Forward the close request to the form component itself to handle dirty state
            const tradeForm = document.getElementById('trade-form-wrapper');
            if (tradeForm) {
                 const event = new CustomEvent('closeRequest');
                 tradeForm.dispatchEvent(event);
            }
        }}
        title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} 
        size="4xl"
      >
        <TradeForm onSave={handleSaveTrade} onClose={handleFormClose} tradeToEdit={tradeToEdit} accounts={activeAccounts} />
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
                <button onClick={() => setDeleteTradeModalOpen(false)} className="px-6 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors font-medium">Cancel</button>
                <button onClick={handleConfirmDeleteTrade} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#232733] focus:ring-red-500">Yes, Delete Trade</button>
            </div>
        </div>
      </Modal>
      
      <Modal isOpen={isLogoutConfirmModalOpen} onClose={() => setLogoutConfirmModalOpen(false)} title="Confirm Logout">
        <div className="text-center">
            <p className="text-gray-300 mb-6">Are you sure you want to log out?</p>
            <div className="flex justify-center gap-4">
                <button onClick={() => setLogoutConfirmModalOpen(false)} className="px-6 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors font-medium">Cancel</button>
                <button onClick={handleConfirmLogout} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium">Logout</button>
            </div>
        </div>
      </Modal>

    </div>
  );
}

const App: React.FC = () => (
  <AppProvider>
    <AppContent />
  </AppProvider>
);

export default App;