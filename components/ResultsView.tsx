import React, { useState, useMemo } from 'react';
import { useAppContext } from '../services/appState';
import { Result, Trade } from '../types';
import { filterTradesByPeriod } from '../services/statisticsService';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import Skeleton from './ui/Skeleton';
import { ICONS } from '../constants';

type Period = 'this-month' | 'last-month' | 'this-quarter' | 'all';
const availableResults = [Result.Win, Result.Loss, Result.Breakeven, Result.Missed];

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

const ResultCard: React.FC<{ 
    trade: Trade; 
    onViewTrade: (trade: Trade) => void;
    onImageClick: (src: string) => void;
}> = ({ trade, onViewTrade, onImageClick }) => {
    const imageUrl = useImageBlobUrl(trade.analysisResult.image);

    return (
        <div className="bg-[#232733] rounded-lg border border-gray-700/50 overflow-hidden group">
            <div 
                className="relative aspect-video bg-gray-800 cursor-pointer" 
                onClick={() => imageUrl && onImageClick(imageUrl)}
            >
                {imageUrl ? (
                    <img src={imageUrl} alt={`Result for ${trade.pair}`} className="w-full h-full object-contain" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Skeleton className="w-full h-full" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
            </div>
            <div className="p-3">
                <div className="flex justify-between items-start gap-2">
                    <div>
                        <p className="font-bold text-white truncate text-sm">{trade.pair}</p>
                        <p className="text-xs text-gray-400">{new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <span className={`py-1 px-2 flex-shrink-0 ${getResultClasses(trade.result)}`}>{trade.result}</span>
                </div>
                <button 
                    onClick={() => onViewTrade(trade)}
                    className="mt-3 w-full text-center py-1.5 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors text-xs font-medium"
                >
                    View Details
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

    const activeAccounts = useMemo(() => accounts.filter(a => !a.isArchived), [accounts]);

    const filteredTrades = useMemo(() => {
        const accountFiltered = trades.filter(trade => selectedAccountId === 'all' || trade.accountId === selectedAccountId);
        const periodFiltered = filterTradesByPeriod(accountFiltered, period);
        return periodFiltered
            .filter(trade => trade.result === selectedResult && trade.analysisResult?.image)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [trades, selectedAccountId, period, selectedResult]);
    
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

            {filteredTrades.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredTrades.map(trade => (
                        <ResultCard 
                            key={trade.id} 
                            trade={trade} 
                            onViewTrade={onViewTrade}
                            onImageClick={setFullscreenSrc}
                        />
                    ))}
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