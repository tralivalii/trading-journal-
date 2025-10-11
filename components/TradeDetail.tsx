// FIX: Provided full content for missing TradeDetail.tsx file.
import React, { useState, useMemo } from 'react';
import { Trade, Result } from '../types';
import { useAppContext } from '../services/appState';
import { ICONS } from '../constants';
import { analyzeTradeWithAI } from '../services/aiService';

const DetailItem: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div>
        <p className="text-sm text-[#8A91A8] uppercase tracking-wider">{label}</p>
        <div className={`text-base text-white mt-1 font-medium ${className}`}>{children}</div>
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

const TradeDetail: React.FC<{ trade: Trade, onEdit: (trade: Trade) => void, onDelete: (id: string) => void }> = ({ trade, onEdit, onDelete }) => {
    const { state } = useAppContext();
    const account = useMemo(() => state.userData?.accounts.find(a => a.id === trade.accountId), [state.userData, trade.accountId]);
    const currency = account?.currency || 'USD';

    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleGetAIAnalysis = async () => {
        setIsAnalyzing(true);
        setAiAnalysis('');
        const analysis = await analyzeTradeWithAI(trade);
        setAiAnalysis(analysis);
        setIsAnalyzing(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-2xl font-bold text-white">{trade.pair}</h3>
                    <p className="text-gray-400">{new Date(trade.date).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(trade)} className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-700/50 transition-colors" aria-label="Edit trade"><span className="w-5 h-5 block">{ICONS.pencil}</span></button>
                    <button onClick={() => onDelete(trade.id)} className="p-2 text-gray-400 hover:text-red-400 rounded-full hover:bg-gray-700/50 transition-colors" aria-label="Delete trade"><span className="w-5 h-5 block">{ICONS.trash}</span></button>
                </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-4 bg-[#2A2F3B] rounded-lg border border-gray-700/50">
                <DetailItem label="Result">
                    <span className={`font-semibold py-1 px-3 rounded-full text-xs text-center w-28 inline-block ${getResultClasses(trade.result)}`}>
                        {trade.result}
                    </span>
                </DetailItem>
                <DetailItem label="Direction" className={trade.direction === 'Long' ? 'text-green-400' : 'text-red-400'}>
                    {trade.direction}
                </DetailItem>
                <DetailItem label="PnL" className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'}>
                    {trade.pnl.toLocaleString('en-US', { style: 'currency', currency })}
                </DetailItem>
                <DetailItem label="R:R Ratio">
                    {trade.rr.toFixed(2)}
                </DetailItem>
            </div>
            
            {(trade.setup || trade.execution || trade.outcome) && (
                <div className="space-y-4">
                    {trade.setup && <div className="prose prose-invert prose-sm max-w-none"><h4>Setup</h4><p>{trade.setup}</p></div>}
                    {trade.execution && <div className="prose prose-invert prose-sm max-w-none"><h4>Execution</h4><p>{trade.execution}</p></div>}
                    {trade.outcome && <div className="prose prose-invert prose-sm max-w-none"><h4>Outcome</h4><p>{trade.outcome}</p></div>}
                </div>
            )}
            
            <div>
                 <button onClick={handleGetAIAnalysis} disabled={isAnalyzing} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:bg-gray-500">
                    {isAnalyzing ? 'Analyzing...' : 'Get AI Analysis'}
                </button>
                {isAnalyzing && <p className="text-sm text-gray-400 mt-2 animate-pulse">AI is analyzing your trade...</p>}
                {aiAnalysis && (
                    <div className="mt-4 p-4 bg-[#1A1D26] rounded-lg border border-gray-700/50">
                        <p className="text-sm text-gray-300 whitespace-pre-wrap">{aiAnalysis}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradeDetail;
