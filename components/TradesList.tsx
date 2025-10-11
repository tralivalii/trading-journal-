
import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext, deleteTradeAction, fetchMoreTradesAction } from '../services/appState';
import { Trade, Result, Account } from '../types';
import Modal from './ui/Modal';
import TradeDetail from './TradeDetail';
import TradeForm from './TradeForm';
import { ICONS } from '../constants';
import CustomSelect from './ui/CustomSelect';

const TRADES_PAGE_SIZE = 20;

const TradesList: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { userData, hasMoreTrades, isFetchingMore } = state;
    const { trades, accounts } = userData!;

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
    const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
    
    const [searchQuery, setSearchQuery] = useState('');
    const [sortKey, setSortKey] = useState<'date' | 'pnl' | 'rr'>('date');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    
    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);
    const accountMap = useMemo(() => new Map(accounts.map(acc => [acc.id, acc])), [accounts]);

    const filteredAndSortedTrades = useMemo(() => {
        let filtered = trades.filter(trade => 
            trade.pair.toLowerCase().includes(searchQuery.toLowerCase())
        );
        
        return filtered.sort((a, b) => {
            let valA, valB;
            if (sortKey === 'date') {
                valA = new Date(a.date).getTime();
                valB = new Date(b.date).getTime();
            } else {
                valA = a[sortKey];
                valB = b[sortKey];
            }
            return sortDir === 'asc' ? valA - valB : valB - valA;
        });
    }, [trades, searchQuery, sortKey, sortDir]);

    const handleNewTrade = () => {
        setTradeToEdit(null);
        setIsFormModalOpen(true);
    };

    const handleEditTrade = (trade: Trade) => {
        setTradeToEdit(trade);
        setIsDetailModalOpen(false); // Close detail view if open
        setIsFormModalOpen(true);
    };
    
    const handleViewTrade = (trade: Trade) => {
        setSelectedTrade(trade);
        setIsDetailModalOpen(true);
    };

    const handleDeleteTrade = async (tradeId: string) => {
        if (confirm('Are you sure you want to delete this trade?')) {
            await deleteTradeAction(dispatch, state, tradeId);
        }
    };
    
    const handleSaveTrade = () => {
        setIsFormModalOpen(false);
        setTradeToEdit(null);
    };
    
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
    
    const currency = (accountId: string) => accountMap.get(accountId)?.currency || 'USD';
    
    const handleLoadMore = () => {
        if (!isFetchingMore) {
            fetchMoreTradesAction(dispatch, state, TRADES_PAGE_SIZE);
        }
    }
    
    if (activeAccounts.length === 0) {
        return (
            <div className="text-center py-10">
                <h2 className="text-xl font-semibold text-white">No Active Accounts</h2>
                <p className="text-[#8A91A8] mt-2">Please create an active account in Settings to start logging trades.</p>
            </div>
        );
    }
    
    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-white">Trades</h1>
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Search by pair..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full md:w-48 bg-[#1A1D26] border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-white"
                    />
                    <button onClick={handleNewTrade} className="flex-shrink-0 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors flex items-center gap-2">
                        <span className="w-5 h-5">{ICONS.plus}</span> New Trade
                    </button>
                </div>
            </div>

            <div className="bg-[#232733] rounded-lg border border-gray-700/50">
                <div className="hidden md:grid grid-cols-12 gap-4 p-4 font-semibold text-xs text-[#8A91A8] uppercase tracking-wider border-b border-gray-700/50">
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Pair</div>
                    <div className="col-span-2">Direction</div>
                    <div className="col-span-2">Result</div>
                    <div className="col-span-2">PnL</div>
                    <div className="col-span-1">R:R</div>
                    <div className="col-span-1 text-right">Actions</div>
                </div>

                {filteredAndSortedTrades.length > 0 ? (
                    filteredAndSortedTrades.map(trade => (
                        <div key={trade.id} className="grid grid-cols-2 md:grid-cols-12 gap-4 p-4 border-b border-gray-700/50 items-center hover:bg-gray-800/50 transition-colors">
                            <div className="md:col-span-2">
                                <span className="md:hidden text-xs text-[#8A91A8] uppercase">Date: </span>
                                <span className="text-sm font-medium text-white">{new Date(trade.date).toLocaleDateString()}</span>
                            </div>
                            <div className="md:col-span-2">
                                <span className="md:hidden text-xs text-[#8A91A8] uppercase">Pair: </span>
                                <span className="text-sm font-semibold text-white">{trade.pair}</span>
                            </div>
                            <div className="md:col-span-2">
                                <span className="md:hidden text-xs text-[#8A91A8] uppercase">Direction: </span>
                                <span className={`text-sm font-semibold ${trade.direction === 'Long' ? 'text-green-400' : 'text-red-400'}`}>{trade.direction}</span>
                            </div>
                            <div className="col-span-2 md:col-span-2 text-right md:text-left">
                                <CustomSelect<Result>
                                    value={trade.result}
                                    options={Object.values(Result)}
                                    onChange={(newResult) => {/* Quick edit could be here */}}
                                    getDisplayClasses={getResultClasses}
                                />
                            </div>
                             <div className="md:col-span-2">
                                <span className="md:hidden text-xs text-[#8A91A8] uppercase">PnL: </span>
                                <span className={`text-sm font-semibold ${trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {trade.pnl.toLocaleString('en-US', { style: 'currency', currency: currency(trade.accountId) })}
                                </span>
                            </div>
                            <div className="md:col-span-1">
                                <span className="md:hidden text-xs text-[#8A91A8] uppercase">R:R: </span>
                                <span className="text-sm font-medium text-white">{trade.rr.toFixed(2)}</span>
                            </div>
                            <div className="col-span-2 md:col-span-1 flex justify-end gap-2 items-center">
                                <button onClick={() => handleViewTrade(trade)} className="p-2 text-gray-400 hover:text-white transition-colors">{ICONS.eye}</button>
                                <button onClick={() => handleEditTrade(trade)} className="p-2 text-gray-400 hover:text-white transition-colors">{ICONS.pencil}</button>
                                <button onClick={() => handleDeleteTrade(trade.id)} className="p-2 text-gray-400 hover:text-red-400 transition-colors">{ICONS.trash}</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-10 text-[#8A91A8]">
                        <p>No trades found. Click "New Trade" to get started.</p>
                    </div>
                )}
                 {hasMoreTrades && (
                    <div className="p-4 text-center">
                        <button onClick={handleLoadMore} disabled={isFetchingMore} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:bg-gray-800 disabled:cursor-wait font-medium text-sm">
                            {isFetchingMore ? 'Loading...' : 'Load More Trades'}
                        </button>
                    </div>
                )}
            </div>
            
            <Modal isOpen={isFormModalOpen} onClose={() => setIsFormModalOpen(false)} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} size="4xl">
                <TradeForm tradeToEdit={tradeToEdit} onSave={handleSaveTrade} onCancel={() => setIsFormModalOpen(false)} />
            </Modal>
            
            {selectedTrade && (
                <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title="Trade Details" size="5xl">
                    <TradeDetail trade={selectedTrade} account={accountMap.get(selectedTrade.accountId)} onEdit={handleEditTrade} />
                </Modal>
            )}
        </div>
    );
};

export default TradesList;
