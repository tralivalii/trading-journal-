import React, { useState, useMemo } from 'react';
// FIX: Changed imports to be relative paths
import { Trade, Result, Account } from '../types';
import { ICONS } from '../constants';
import { filterTradesByPeriod } from '../services/statisticsService';
import { useAppContext } from '../services/appState';
import Skeleton from './ui/Skeleton';
import DropdownMenu from './ui/DropdownMenu';

interface TradesListProps {
  onEdit: (trade: Trade) => void;
  onView: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onAddTrade: () => void;
  onLoadMore: () => void;
  hasMore: boolean;
  isFetchingMore: boolean;
}

type JournalPeriod = 'this-month' | 'last-month' | 'this-quarter' | 'all';

const AlertIcon: React.FC<{ message: string }> = ({ message }) => (
    <div className="relative flex items-center group">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.636-1.22 2.85-1.22 3.486 0l5.58 10.796c.636 1.22-.474 2.605-1.743 2.605H4.42c-1.269 0-2.379-1.385-1.743-2.605l5.58-10.796zM10 14a1 1 0 100-2 1 1 0 000 2zm-1-3a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        <div className="absolute bottom-full mb-2 w-max px-2 py-1 bg-gray-900 text-white text-xs rounded-md border border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            {message}
        </div>
    </div>
);

const getResultClasses = (result: Result) => {
    switch (result) {
      case Result.Win: return 'bg-[#10B981]/10 text-[#10B981]';
      case Result.Loss: return 'bg-[#EF4444]/10 text-[#EF4444]';
      case Result.Breakeven: return 'bg-gray-500/10 text-[#8A91A8]';
      case Result.InProgress: return 'bg-yellow-500/10 text-yellow-400';
      case Result.Missed: return 'bg-blue-500/10 text-blue-400';
      default: return 'bg-gray-700 text-white';
    }
};

const MobileTradeCard: React.FC<{
    trade: Trade;
    account?: Account;
    onView: (trade: Trade) => void;
    onEdit: (trade: Trade) => void;
    onDelete: (id: string) => void;
    formattedDate: string;
}> = ({ trade, account, onView, onEdit, onDelete, formattedDate }) => {
    const currency = account?.currency || 'USD';
    const formattedPnl = trade.pnl.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2 });

    return (
        <div onPointerUp={() => onView(trade)} className="bg-[#2A2F3B] rounded-lg p-3 cursor-pointer border border-transparent hover:border-blue-600/50 transition-colors space-y-3">
            {/* Top Row: Pair, Result, Alerts, and PnL */}
            <div className="flex justify-between items-center">
                <div className="flex items-center gap-3 min-w-0"> {/* min-w-0 for truncate to work in flex */}
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="font-bold text-white text-lg truncate" title={trade.pair}>{trade.pair}</span>
                        <span className={`font-semibold py-1 px-2 rounded-full text-xs text-center inline-block flex-shrink-0 ${getResultClasses(trade.result)}`}>
                            {trade.result}
                        </span>
                    </div>
                     <div className="flex items-center gap-1.5 flex-shrink-0">
                        {account?.isArchived && <AlertIcon message="Account Archived" />}
                        {trade.risk > 2 && <AlertIcon message={`Risk: ${trade.risk}%`} />}
                    </div>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                    <div className={`font-bold text-lg ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formattedPnl}</div>
                </div>
            </div>

            {/* Bottom Row: Details, Date, and Actions */}
            <div className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-4">
                    <div>
                        <span className="text-xs text-gray-500 block">Direction</span>
                        <span className={`font-semibold ${trade.direction === 'Long' ? 'text-green-400' : 'text-red-400'}`}>{trade.direction}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 block">R:R</span>
                        <span className="font-semibold text-white">{trade.rr.toFixed(2)}</span>
                    </div>
                    <div>
                        <span className="text-xs text-gray-500 block">Risk</span>
                        <span className="font-semibold text-white">{trade.risk}%</span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2"> {/* Increased gap for date and menu */}
                    <div className="text-sm text-gray-400">{formattedDate}</div>
                    <DropdownMenu 
                        trigger={
                            <button onPointerUp={e => e.stopPropagation()} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50 transition-colors" aria-label="Trade actions">
                               <span className="w-5 h-5 block">{ICONS.moreVertical}</span>
                            </button>
                        }
                    >
                       <div className="p-1">
                            <button onClick={() => onView(trade)} className="w-full text-left flex items-center gap-3 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md transition-colors">
                                <span className="w-4 h-4">{ICONS.eye}</span> View
                            </button>
                            <button onClick={() => onEdit(trade)} className="w-full text-left flex items-center gap-3 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md transition-colors">
                                <span className="w-4 h-4">{ICONS.pencil}</span> Edit
                            </button>
                            <div className="my-1 border-t border-gray-700/50"></div>
                            <button onClick={() => onDelete(trade.id)} className="w-full text-left flex items-center gap-3 px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 rounded-md transition-colors">
                                <span className="w-4 h-4">{ICONS.trash}</span> Delete
                            </button>
                       </div>
                    </DropdownMenu>
                </div>
            </div>
        </div>
    );
};

const TradesListSkeleton: React.FC = () => (
    <div className="space-y-8">
        {[1, 2].map(i => (
            <div key={i}>
                <Skeleton className="h-7 w-48 mb-3" />
                {/* Desktop Skeleton */}
                <div className="hidden lg:block bg-[#232733] rounded-lg border border-gray-700/50 overflow-hidden">
                    <table className="w-full">
                        <thead className="text-xs text-[#8A91A8] uppercase bg-gray-800">
                             <tr>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-16" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-24" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-20" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-12" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-10" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-20" /></th>
                                <th className="px-6 py-3"><Skeleton className="h-4 w-28" /></th>
                                <th className="px-6 py-3 text-center"><Skeleton className="h-4 w-32 mx-auto" /></th>
                            </tr>
                        </thead>
                        <tbody>
                            {[1, 2, 3].map(j => (
                                <tr key={j} className="odd:bg-[#232733] even:bg-[#2A2F3B] border-b border-gray-700/50">
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-16" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-24" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-12" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-10" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-8" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-20" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-6 w-28 rounded-full" /></td>
                                    <td className="px-6 py-4"><Skeleton className="h-5 w-32 mx-auto" /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {/* Mobile Skeleton */}
                <div className="lg:hidden space-y-2">
                    {[1, 2, 3].map(j => (
                        <div key={j} className="bg-[#2A2F3B] rounded-lg p-3 border border-transparent">
                            <div className="flex justify-between items-start mb-3">
                                <Skeleton className="h-6 w-32" />
                                <Skeleton className="h-4 w-16" />
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                <div><Skeleton className="h-4 w-12 mx-auto" /><Skeleton className="h-5 w-10 mx-auto mt-1" /></div>
                                <div><Skeleton className="h-4 w-8 mx-auto" /><Skeleton className="h-5 w-12 mx-auto mt-1" /></div>
                                <div><Skeleton className="h-4 w-10 mx-auto" /><Skeleton className="h-5 w-16 mx-auto mt-1" /></div>
                            </div>
                            <div className="flex justify-between items-center">
                                <Skeleton className="h-6 w-28 rounded-full" />
                                <div className="flex items-center gap-1">
                                    <Skeleton className="w-8 h-8 rounded-full" />
                                    <Skeleton className="w-8 h-8 rounded-full" />
                                    <Skeleton className="w-8 h-8 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        ))}
    </div>
);


const TradesList: React.FC<TradesListProps> = ({ onEdit, onView, onDelete, onAddTrade, onLoadMore, hasMore, isFetchingMore }) => {
  const { state } = useAppContext();
  const { trades, accounts } = state.userData!;
  
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [period, setPeriod] = useState<JournalPeriod>('this-month');
  
  const accountsMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);
  const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

  const filteredTrades = useMemo(() => {
    const accountFiltered = trades.filter(trade => selectedAccountId === 'all' || trade.accountId === selectedAccountId);
    const periodFiltered = period === 'all' ? accountFiltered : filterTradesByPeriod(accountFiltered, period);
    return periodFiltered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [trades, selectedAccountId, period]);

  const groupedByMonthKey = useMemo(() => {
    return filteredTrades.reduce((groups, trade) => {
        const tradeDate = new Date(trade.date);
        const year = tradeDate.getFullYear();
        const month = tradeDate.getMonth();
        const key = `${year}-${String(month).padStart(2, '0')}`; // e.g., "2024-09" for October

        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(trade);
        return groups;
    }, {} as Record<string, Trade[]>);
  }, [filteredTrades]);

  const sortedMonthKeys = useMemo(() => Object.keys(groupedByMonthKey).sort().reverse(), [groupedByMonthKey]);

  const PeriodButton: React.FC<{p: JournalPeriod, label: string}> = ({ p, label }) => (
    <button 
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-[#3B82F6] text-white' : 'bg-gray-700 hover:bg-gray-600 text-[#8A91A8] hover:text-white'}`}
    >
      {label}
    </button>
  );
  
  if (state.isLoading) {
    return (
        <div>
             <div className="mb-6">
                <Skeleton className="h-9 w-64" />
                <div className="flex flex-wrap items-center gap-4 mt-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-7 w-24 rounded-md" />
                        <Skeleton className="h-7 w-24 rounded-md" />
                        <Skeleton className="h-7 w-28 rounded-md" />
                        <Skeleton className="h-7 w-20 rounded-md" />
                    </div>
                     <div>
                        <Skeleton className="h-9 w-48 rounded-md" />
                    </div>
                </div>
            </div>
            <TradesListSkeleton />
        </div>
    );
  }

  return (
    <div>
        <div className="mb-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-white flex-shrink-0">Trade Journal</h1>
                    <button 
                        onClick={onAddTrade}
                        className="hidden lg:flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm"
                    >
                       <span className="w-4 h-4">{ICONS.plus}</span> Add New Trade
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <PeriodButton p="this-month" label="This Month" />
                    <PeriodButton p="last-month" label="Last Month" />
                    <PeriodButton p="this-quarter" label="This Quarter" />
                    <PeriodButton p="all" label="All Time" />
                </div>
            </div>
            <div className="mt-4 flex justify-start md:justify-end">
                <div>
                    <label htmlFor="accountFilter" className="text-sm text-[#8A91A8] mr-2">Account:</label>
                    <select 
                        id="accountFilter"
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

        <div className="space-y-8">
            {sortedMonthKeys.length > 0 ? (
                sortedMonthKeys.map(monthKey => {
                    const [year, month] = monthKey.split('-');
                    const monthName = new Date(parseInt(year), parseInt(month)).toLocaleString('en-US', { month: 'long', year: 'numeric' });
                    const monthTrades = groupedByMonthKey[monthKey];

                    return (
                         <div key={monthKey}>
                            <h2 className="text-xl font-semibold text-white mb-3 pl-1">{monthName}</h2>
                            
                            {/* --- DESKTOP TABLE VIEW --- */}
                            <div className="hidden lg:block bg-[#232733] rounded-lg border border-gray-700/50 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm text-left text-[#F0F0F0]">
                                    <thead className="text-xs text-[#8A91A8] uppercase bg-gray-800">
                                        <tr>
                                        <th scope="col" className="px-6 py-3">Date</th>
                                        <th scope="col" className="px-6 py-3">Pair</th>
                                        <th scope="col" className="px-6 py-3">Direction</th>
                                        <th scope="col" className="px-6 py-3">R:R</th>
                                        <th scope="col" className="px-6 py-3">Risk</th>
                                        <th scope="col" className="px-6 py-3">PnL</th>
                                        <th scope="col" className="px-6 py-3">Result</th>
                                        <th scope="col" className="px-6 py-3 text-right"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthTrades.map(trade => {
                                            const account = accountsMap.get(trade.accountId);
                                            const currency = account?.currency || 'USD';
                                            const tradeDate = new Date(trade.date);
                                            const formattedDate = tradeDate.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
                                            return (
                                        <tr key={trade.id} onPointerUp={() => onView(trade)} className="odd:bg-[#232733] even:bg-[#2A2F3B] border-b border-gray-700/50 last:border-b-0 hover:bg-gray-700/50 transition-colors cursor-pointer">
                                            <td className="px-6 py-4 whitespace-nowrap">{formattedDate}</td>
                                            <td className="px-6 py-4 font-medium text-white whitespace-nowrap">
                                                <div className="flex items-center gap-2">
                                                    <span>{trade.pair}</span>
                                                    {account?.isArchived && <AlertIcon message="Account Archived" />}
                                                    {trade.risk > 2 && <AlertIcon message={`Risk: ${trade.risk}%`} />}
                                                </div>
                                            </td>
                                            <td className={`px-6 py-4 font-semibold ${trade.direction === 'Long' ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>{trade.direction}</td>
                                            <td className="px-6 py-4">{trade.rr.toFixed(2)}</td>
                                            <td className="px-6 py-4">{trade.risk}%</td>
                                            <td className={`px-6 py-4 font-semibold ${trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'} whitespace-nowrap`}>
                                            {Math.abs(trade.pnl).toLocaleString('en-US', { style: 'currency', currency: currency })}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`font-semibold py-1 px-3 rounded-full text-xs text-center w-28 inline-block ${getResultClasses(trade.result)}`}>
                                                    {trade.result}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right whitespace-nowrap" onPointerUp={(e) => e.stopPropagation()}>
                                                <div className="flex justify-end items-center gap-2">
                                                    <button onClick={() => onView(trade)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50 transition-colors" aria-label={`View trade for ${trade.pair} on ${formattedDate}`}>
                                                        <span className="w-5 h-5 block">{ICONS.eye}</span>
                                                    </button>
                                                    <button onClick={() => onEdit(trade)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50 transition-colors" aria-label={`Edit trade for ${trade.pair} on ${formattedDate}`}>
                                                        <span className="w-5 h-5 block">{ICONS.pencil}</span>
                                                    </button>
                                                    <button onClick={() => onDelete(trade.id)} className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50 transition-colors" aria-label={`Delete trade for ${trade.pair} on ${formattedDate}`}>
                                                        <span className="w-5 h-5 block">{ICONS.trash}</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        )})}
                                    </tbody>
                                    </table>
                                </div>
                            </div>
                            
                            {/* --- MOBILE CARD VIEW --- */}
                            <div className="lg:hidden space-y-2">
                                {monthTrades.map(trade => {
                                    const account = accountsMap.get(trade.accountId);
                                    const tradeDate = new Date(trade.date);
                                    const formattedDate = tradeDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                    return (
                                        <MobileTradeCard
                                            key={trade.id}
                                            trade={trade}
                                            account={account}
                                            onView={onView}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            formattedDate={formattedDate}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-16 bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col items-center justify-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-500">
                        No trades found for the selected period.
                    </p>
                    <button 
                        onClick={onAddTrade}
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-[#3B82F6] text-white rounded-lg hover:bg-blue-500 transition-colors"
                    >
                       <span className="w-5 h-5">{ICONS.plus}</span> Add First Trade
                    </button>
                </div>
            )}
        </div>

        {hasMore && period === 'all' && (
            <div className="mt-8 text-center">
                <button
                    onClick={onLoadMore}
                    disabled={isFetchingMore}
                    className="px-6 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-800 disabled:cursor-wait font-medium flex items-center justify-center gap-2 mx-auto"
                >
                    {isFetchingMore ? (
                        <>
                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading...
                        </>
                    ) : (
                        'Load More'
                    )}
                </button>
            </div>
        )}
    </div>
  );
};

export default TradesList;