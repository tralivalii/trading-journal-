import React, { useState, useMemo } from 'react';
// FIX: Changed imports to be relative paths
import { Trade, Account, Result } from '../types';
import { ICONS } from '../constants';
import { filterTradesByPeriod } from '../services/statisticsService';

interface TradesListProps {
  trades: Trade[];
  accounts: Account[];
  onEdit: (trade: Trade) => void;
  onView: (trade: Trade) => void;
  onDelete: (id: string) => void;
  onUpdateResult: (id: string, result: Result) => void;
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


const TradesList: React.FC<TradesListProps> = ({ trades, accounts, onEdit, onView, onDelete, onUpdateResult }) => {
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [period, setPeriod] = useState<JournalPeriod>('this-month');
  
  const accountsMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);

  const filteredTrades = useMemo(() => {
    const accountFiltered = trades.filter(trade => selectedAccountId === 'all' || trade.accountId === selectedAccountId);
    const periodFiltered = filterTradesByPeriod(accountFiltered, period);
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

  const getResultColor = (result: Result) => {
    switch (result) {
      case Result.Win: return 'text-green-400';
      case Result.Loss: return 'text-red-400';
      case Result.Breakeven: return 'text-gray-400';
      case Result.InProgress: return 'text-yellow-400';
      case Result.Missed: return 'text-blue-400';
      default: return 'text-white';
    }
  };

  const PeriodButton: React.FC<{p: JournalPeriod, label: string}> = ({ p, label }) => (
    <button 
      onClick={() => setPeriod(p)}
      className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
    >
      {label}
    </button>
  );

  return (
    <div>
        <div className="mb-6">
            <h1 className="text-3xl font-bold text-white">Trade Journal</h1>
            <div className="flex flex-wrap items-center gap-4 mt-4">
                <div className="flex flex-wrap items-center gap-2">
                    <PeriodButton p="this-month" label="This Month" />
                    <PeriodButton p="last-month" label="Last Month" />
                    <PeriodButton p="this-quarter" label="This Quarter" />
                    <PeriodButton p="all" label="All Time" />
                </div>
                <div>
                    <label htmlFor="accountFilter" className="text-sm text-gray-400 mr-2">Account:</label>
                    <select 
                        id="accountFilter"
                        value={selectedAccountId}
                        onChange={(e) => setSelectedAccountId(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="all">All Accounts</option>
                        {accounts.map(acc => (
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
                             <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-300">
                                  <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                                    <tr>
                                      <th scope="col" className="px-6 py-3">Date</th>
                                      <th scope="col" className="px-6 py-3">Pair</th>
                                      <th scope="col" className="px-6 py-3">Direction</th>
                                      <th scope="col" className="px-6 py-3">R:R</th>
                                      <th scope="col" className="px-6 py-3">PnL</th>
                                      <th scope="col" className="px-6 py-3">Result</th>
                                      <th scope="col" className="px-6 py-3 text-center">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {monthTrades.map(trade => {
                                        const account = accountsMap.get(trade.accountId);
                                        const currency = account?.currency || 'USD';
                                        return (
                                      <tr key={trade.id} onClick={() => onView(trade)} className="bg-gray-800/50 border-b border-gray-700/50 hover:bg-gray-700/50 transition-colors cursor-pointer">
                                        <td className="px-6 py-4">{new Date(trade.date).toLocaleDateString()}</td>
                                        <td className="px-6 py-4 font-medium text-white flex items-center gap-2">
                                            {trade.pair}
                                            {trade.risk > 2 && <AlertIcon message={`Risk: ${trade.risk}%`} />}
                                        </td>
                                        <td className={`px-6 py-4 font-semibold ${trade.direction === 'Long' ? 'text-cyan-400' : 'text-purple-400'}`}>{trade.direction}</td>
                                        <td className="px-6 py-4">{trade.rr.toFixed(2)}</td>
                                        <td className={`px-6 py-4 font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                          {Math.abs(trade.pnl).toLocaleString('en-US', { style: 'currency', currency: currency })}
                                        </td>
                                        <td className="px-6 py-4">
                                          <select
                                            value={trade.result}
                                            onChange={(e) => onUpdateResult(trade.id, e.target.value as Result)}
                                            onClick={(e) => e.stopPropagation()} // Prevent triggering other row events
                                            className={`font-bold p-1 rounded-md border-2 border-transparent bg-transparent hover:border-gray-600 focus:bg-gray-700 focus:ring-1 focus:ring-blue-500 transition-colors ${getResultColor(trade.result)}`}
                                          >
                                            {Object.values(Result).map(res => (
                                              <option key={res} value={res} className="bg-gray-800 text-white font-bold">
                                                {res}
                                              </option>
                                            ))}
                                          </select>
                                        </td>
                                        <td className="px-6 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                                          <div className="flex justify-center items-center gap-4">
                                            <button onClick={() => onView(trade)} className="font-medium text-blue-500 hover:underline">View</button>
                                            <button onClick={() => onEdit(trade)} className="font-medium text-yellow-500 hover:underline">Edit</button>
                                            <button onClick={() => onDelete(trade.id)} className="font-medium text-red-500 hover:underline">Delete</button>
                                          </div>
                                        </td>
                                      </tr>
                                    )})}
                                  </tbody>
                                </table>
                            </div>
                        </div>
                    );
                })
            ) : (
                <div className="text-center py-16 bg-gray-800/50 rounded-lg border border-gray-700/50">
                    <p className="text-gray-500">
                        No trades found for the selected period.
                    </p>
                </div>
            )}
        </div>
    </div>
  );
};

export default TradesList;