import React, { useState } from 'react';
// FIX: Removed unused and non-existent 'CloseType' from imports.
import { Trade, Account, Result, Analysis } from '../types';
import { ICONS } from '../constants';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import { analyzeTradeWithAI } from '../services/aiService';
import { useAppContext } from '../services/appState';
import { updateTradeWithAIAnalysisAction } from '../services/appState';

interface TradeDetailProps {
  trade: Trade;
  account?: Account;
  onEdit: (trade: Trade) => void;
}

type AnalysisTab = 'D1' | '1h' | '5m' | 'Result';

const DetailItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div>
        <p className="text-sm text-[#8A91A8] uppercase tracking-wider">{label}</p>
        <p className={`text-base font-semibold text-[#F0F0F0] ${className}`}>{value || 'N/A'}</p>
    </div>
);

const AnalysisDetailSection: React.FC<{ 
    analysis: Analysis;
    onImageClick: (src: string | null) => void;
}> = ({ analysis, onImageClick }) => {
    const imageUrl = useImageBlobUrl(analysis.image, { transform: { width: 600, quality: 80 } });
    
    return (
        <div className="bg-[#1A1D26] p-4 rounded-lg border border-gray-700/50">
            <div className="space-y-4">
                 <div className="w-full">
                    {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt={`Analysis chart`} 
                            className="rounded-md border border-gray-700 w-full cursor-pointer hover:opacity-90 transition-opacity object-contain"
                            onClick={() => onImageClick(imageUrl)}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-48 bg-gray-900/50 rounded-md text-gray-500 w-full">No Image</div>
                    )}
                </div>
                <div>
                    <p className="text-[#F0F0F0] whitespace-pre-wrap text-sm">{analysis.notes || 'No notes for this section.'}</p>
                </div>
            </div>
        </div>
    );
}


const TradeDetail: React.FC<TradeDetailProps> = ({ trade, account, onEdit }) => {
  const { state, dispatch } = useAppContext();
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AnalysisTab>('D1');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const analysisD1ImageUrl = useImageBlobUrl(trade.analysisD1.image);
  const analysis1hImageUrl = useImageBlobUrl(trade.analysis1h.image);
  const analysis5mImageUrl = useImageBlobUrl(trade.analysis5m.image);
  const analysisResultImageUrl = useImageBlobUrl(trade.analysisResult.image);

  const handleAiAnalysis = async () => {
    if (state.isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "AI Analysis is disabled in guest mode.", type: 'error' } });
        return;
    }
    setIsAiLoading(true);
    setAiError(null);
    try {
        const imageUrls = [analysisD1ImageUrl, analysis1hImageUrl, analysis5mImageUrl, analysisResultImageUrl].filter(Boolean) as string[];
        const analysisText = await analyzeTradeWithAI(trade, imageUrls);
        await updateTradeWithAIAnalysisAction(dispatch, state, trade.id, analysisText);

    } catch (error: any) {
        console.error("AI Analysis Error:", error);
        setAiError(error.message || "Failed to get AI analysis.");
        dispatch({ type: 'SHOW_TOAST', payload: { message: "Failed to get AI analysis.", type: 'error' } });
    } finally {
        setIsAiLoading(false);
    }
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
  
  const currency = account?.currency || 'USD';
  
  const StatCard: React.FC<{ label: string, value: string | number, className?: string }> = ({ label, value, className }) => (
      <div className="bg-[#1A1D26] p-4 rounded-lg border border-gray-700/50 text-center flex flex-col justify-center">
          <p className="text-sm font-medium text-[#8A91A8] uppercase tracking-wider">{label}</p>
          <p className={`font-bold text-2xl ${className}`}>{value}</p>
      </div>
  );

  const analysisContent: Record<AnalysisTab, Analysis> = {
    'D1': trade.analysisD1,
    '1h': trade.analysis1h,
    '5m': trade.analysis5m,
    'Result': trade.analysisResult,
  };

  return (
    <div className="space-y-6">
        {/* --- HEADER --- */}
        <div className="flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-4">
                <h2 className="text-3xl font-bold text-white">{trade.pair}</h2>
                <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${getResultClasses(trade.result)}`}>
                    {trade.result}
                </span>
            </div>
            <div className="flex items-center gap-4">
                <span className="text-base text-[#8A91A8] hidden sm:block">{new Date(trade.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                <button 
                    onClick={() => onEdit(trade)}
                    className="flex items-center gap-2 px-4 py-2 bg-[#2A2F3B] text-white rounded-lg hover:bg-[#373c49] border border-gray-600 hover:border-gray-500 transition-colors text-sm font-medium"
                    aria-label="Edit trade"
                >
                    {ICONS.pencil}
                    <span>Edit</span>
                </button>
            </div>
        </div>

        {/* --- KEY METRICS --- */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Net PnL" value={trade.pnl.toLocaleString('en-US', { style: 'currency', currency })} className={trade.pnl >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'} />
            <StatCard label="R:R Ratio" value={trade.rr.toFixed(2)} className="text-white" />
            <StatCard label="Risk Amount" value={trade.riskAmount.toLocaleString('en-US', { style: 'currency', currency })} className="text-white" />
            <StatCard label="Risk %" value={trade.risk} className="text-white" />
        </div>
      
        {/* --- TRADE DETAILS --- */}
        <div className="bg-[#232733] p-6 rounded-lg border border-gray-700/50">
             <h3 className="text-xl font-semibold text-white mb-4">Trade Information</h3>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
                <DetailItem label="Account" value={account?.name} />
                <DetailItem label="Direction" value={trade.direction} className={trade.direction === 'Long' ? 'text-[#10B981]' : 'text-[#EF4444]'}/>
                <DetailItem label="Entry Type" value={trade.entry} />
                <DetailItem label="Stoploss Type" value={trade.stoploss} />
                <DetailItem label="Take Profit Type" value={trade.takeprofit} />
                <DetailItem label="Close Type" value={trade.closeType} />
             </div>
        </div>
      
        {/* --- ANALYSIS NOTES & CHARTS --- */}
        <div>
            <h3 className="text-xl font-semibold text-white mb-4">Analysis Breakdown</h3>
            <div className="mb-4 border-b border-gray-700/50">
                <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                    {(Object.keys(analysisContent) as AnalysisTab[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`${
                                activeTab === tab
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                        >
                            {tab} Analysis
                        </button>
                    ))}
                </nav>
            </div>
            <div>
                <AnalysisDetailSection 
                    analysis={analysisContent[activeTab]}
                    onImageClick={setFullscreenImage}
                />
            </div>
        </div>

        {/* --- AI Analysis Section --- */}
        <div className="bg-[#232733] p-6 rounded-lg border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-semibold text-white">AI Coach Analysis</h3>
                {!trade.aiAnalysis && (
                    <button onClick={handleAiAnalysis} disabled={isAiLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-wait font-medium flex items-center justify-center gap-2 text-sm">
                        {isAiLoading ? (
                            <>
                                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                Analyzing...
                            </>
                        ) : "Analyze with AI"}
                    </button>
                )}
            </div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                {trade.aiAnalysis ? (
                    trade.aiAnalysis
                ) : isAiLoading ? (
                    <p className="text-gray-400 animate-pulse">The AI is analyzing your trade, notes, and charts. This may take a moment...</p>
                ) : aiError ? (
                    <p className="text-red-400">Error: {aiError}</p>
                ) : (
                    <p className="text-gray-500">Click the button to get an objective analysis of your trade from an AI trading coach.</p>
                )}
            </div>
        </div>
      
      {fullscreenImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-[60] flex justify-center items-center p-4 cursor-pointer" 
          onClick={() => setFullscreenImage(null)}
        >
          <img 
            src={fullscreenImage} 
            alt="Fullscreen view" 
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
};

export default TradeDetail;