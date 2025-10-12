import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAppContext } from '../services/appState';
import { Result, Trade } from '../types';
import { filterTradesByPeriod } from '../services/statisticsService';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import Skeleton from './ui/Skeleton';
import { ICONS } from '../constants';

type Period = 'this-month' | 'last-month' | 'this-quarter' | 'all';
const availableResults = [Result.Win, Result.Loss, Result.Breakeven, Result.Missed];
const PAGE_SIZE = 10;

const getResultClasses = (result: Result) => {
    const baseClasses = 'font-semibold rounded-full text-xs text-center inline-block';
    const colorMapping = {
      [Result.Win]: 'bg-[#10B981]/10 text-[#10B981]',
      [Result.Loss]: 'bg-[#EF4444]/10 text-[#EF4444]',
      [Result.Breakeven]: 'bg-gray-500/10 text-[#8A91A8]',
      [Result.Missed]: 'bg-blue-500/10 text-blue-400',
      [Result.InProgress]: 'bg-yellow-500/10 text-yellow-400'
    };
    return `${baseClasses} ${colorMapping[result]}`;
};

const MetricItem: React.FC<{ label: string, value: string | number }> = ({ label, value }) => (
    <div>
        <p className="text-xs text-[#8A91A8] uppercase">{label}</p>
        <p className="font-semibold text-white truncate" title={String(value)}>{value || 'N/A'}</p>
    </div>
);

const ResultCard: React.FC<{ 
    trade: Trade; 
    onViewTrade: (trade: Trade) => void;
    onImageClick: (src: string) => void;
}> = ({ trade, onViewTrade, onImageClick }) => {
    const imageUrl = useImageBlobUrl(trade.analysisResult.image);

    return (
        <div className="bg-[#232733] rounded-lg border border-gray-700/50 overflow-hidden group transition-all duration-300 hover:shadow-lg hover:border-blue-600/50">
            {/* Image Section */}
            <div 
                className="relative w-full h-[25rem] bg-gray-900 cursor-pointer overflow-hidden" 
                onClick={() => imageUrl && onImageClick(imageUrl)}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt={`Result for ${trade.pair}`} className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                    </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
            
            {/* Info Section */}
            <div className="p-4 space-y-4">
                <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-white text-lg truncate">{trade.pair}</p>
                    <span className={`py-1 px-3 flex-shrink-0 ${getResultClasses(trade.result)}`}>{trade.result}</span>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <MetricItem label="Entry" value={trade.entry} />
                    <MetricItem label="SL Type" value={trade.stoploss} />
                    <MetricItem label="TP Type" value={trade.takeprofit} />
                    <MetricItem label="R:R" value={trade.rr.toFixed(2)} />
                </div>

                <button 
                    onClick={() => onViewTrade(trade)}
                    className="mt-2 w-full text-center py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium"
                >
                    View Full Details
                </button>
            </div>
        </div>
    );
};


const ResultsView: React.FC<{ onViewTrade: (trade: Trade) => void }> = ({ onViewTrade }) => {
    const { state } = useAppContext();
    const { trades, accounts } = state.userData!;
    
    const [period, setPeriod] = useState<Period>('this-month');
    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
    const [selectedResult, setSelectedResult] = useState<Result>(Result.Loss);
    const [fullscreenSrc, setFullscreenSrc] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

    const filteredTrades = useMemo(() => {
        const accountFiltered = trades.filter(trade => selectedAccountId === 'all' || trade.accountId === selectedAccountId);
        const periodFiltered = filterTradesByPeriod(accountFiltered, period);
        const results = periodFiltered
            .filter(trade => trade.result === selectedResult && trade.analysisResult?.image)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setPage(1); // Reset page when filters change
        return results;
    }, [trades, selectedAccountId, period, selectedResult]);

    const displayedTrades = useMemo(() => {
        return filteredTrades.slice(0, page * PAGE_SIZE);
    }, [filteredTrades, page]);

    const hasMore = useMemo(() => {
        return displayedTrades.length < filteredTrades.length;
    }, [displayedTrades.length, filteredTrades.length]);

    const observer = useRef<IntersectionObserver>();
    const lastCardRef = useCallback(node => {
        if (isLoadingMore) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && hasMore) {
                setIsLoadingMore(true);
                setTimeout(() => {
                    setPage(prevPage => prevPage + 1);
                    setIsLoadingMore(false);
                }, 500);
            }
        });

        if (node) observer.current.observe(node);
    }, [isLoadingMore, hasMore]);
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFullscreenSrc(null);
            }
        };

        if (fullscreenSrc) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [fullscreenSrc]);
    
    const PeriodButton: React.FC<{p: Period, label: string}> = ({ p, label }) => (
        <button 
          onClick={() => setPeriod(p)}
          className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${period === p ? 'bg-[#3B82F6] text-white' : 'bg-gray-700 hover:bg-gray-600 text-[#8A91A8] hover:text-white'}`}
        >
          {label}
        </button>
      );
      
    const ResultButton: React.FC<{r: Result}> = ({ r }) => (
        <button
            onClick={() => setSelectedResult(r)}
            className={`px-3 py-1 rounded-md text-xs capitalize transition-colors flex-shrink-0 ${selectedResult === r ? 'bg-[#3B82F6] text-white' : 'bg-gray-700 hover:bg-gray-600 text-[#8A91A8] hover:text-white'}`}
        >
            {r}
        </button>
    );

    return (
        <div>
             <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h1 className="text-3xl font-bold text-white flex-shrink-0">Results Gallery</h1>
                    <div className="flex flex-wrap items-center gap-2">
                        <PeriodButton p="this-month" label="This Month" />
                        <PeriodButton p="last-month" label="Last Month" />
                        <PeriodButton p="this-quarter" label="This Quarter" />
                        <PeriodButton p="all" label="All Time" />
                    </div>
                </div>
                 <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2">
                       {availableResults.map(r => <ResultButton key={r} r={r} />)}
                    </div>
                    <div className="flex justify-start md:justify-end">
                        <div className="flex items-center">
                            <label htmlFor="accountFilterResults" className="text-sm text-[#8A91A8] mr-2">Account:</label>
                            <select 
                                id="accountFilterResults"
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="bg-gray-700 border border-gray-600 rounded-md px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#3B82F6]"
                            >
                                <option value="all">All Accounts</option>
                                {activeAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                 </div>
            </div>

            {displayedTrades.length > 0 ? (
                <div className="max-w-2xl mx-auto space-y-8">
                    {displayedTrades.map((trade, index) => {
                        const isLastCard = displayedTrades.length === index + 1;
                        return (
                            <div ref={isLastCard ? lastCardRef : null} key={trade.id}>
                                <ResultCard 
                                    trade={trade} 
                                    onViewTrade={onViewTrade}
                                    onImageClick={setFullscreenSrc}
                                />
                            </div>
                        );
                    })}
                    {isLoadingMore && (
                        <div className="flex justify-center items-center p-4">
                            <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    )}
                </div>
            ) : (
                 <div className="text-center py-16 bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col items-center justify-center gap-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500">
                        No result screenshots found for the selected filters.
                    </p>
                    <p className="text-xs text-gray-600 max-w-xs">
                        Make sure you've added screenshots to the "Result Analysis" section when logging your trades.
                    </p>
                </div>
            )}
            
            {fullscreenSrc && (
                <div 
                  className="fixed inset-0 bg-black/80 z-[60] flex justify-center items-center p-4" 
                  onClick={() => setFullscreenSrc(null)}
                >
                  <div
                    className="relative w-auto h-auto max-w-full max-h-full flex"
                    onClick={e => e.stopPropagation()}
                  >
                    <img 
                      src={fullscreenSrc} 
                      alt="Fullscreen result" 
                      className="block max-w-[90vw] max-h-[90vh] object-contain rounded-lg"
                    />
                  </div>
                  <button
                    onClick={() => setFullscreenSrc(null)}
                    className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-1.5 hover:bg-black/80 transition-colors"
                    aria-label="Close fullscreen view"
                  >
                    <span className="w-6 h-6 block">{ICONS.x}</span>
                  </button>
                </div>
            )}
        </div>
    );
};

export default ResultsView;