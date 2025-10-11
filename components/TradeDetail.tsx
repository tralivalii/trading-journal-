import React, { useState } from 'react';
// FIX: Removed unused and non-existent 'CloseType' from imports.
import { Trade, Account, Result, Analysis } from '../types';
import { ICONS } from '../constants';
import useImageBlobUrl from '../hooks/useImageBlobUrl';

interface TradeDetailProps {
  trade: Trade;
  account?: Account;
  onEdit: (trade: Trade) => void;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div>
        <p className="text-sm text-[#8A91A8] uppercase tracking-wider">{label}</p>
        <p className={`text-base font-semibold text-[#F0F0F0] ${className}`}>{value || 'N/A'}</p>
    </div>
);

const AnalysisDetailSection: React.FC<{ 
    title: string; 
    analysis: Analysis;
    onImageClick: (src: string) => void;
}> = ({ title, analysis, onImageClick }) => {
    const imageUrl = useImageBlobUrl(analysis.image);
    
    return (
        <div className="bg-[#1A1D26] p-4 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
            <div className="space-y-4">
                 <div className="w-full">
                    {imageUrl ? (
                        <img 
                            src={imageUrl} 
                            alt={`${title} chart`} 
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
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

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
             <div className="space-y-4">
                <AnalysisDetailSection title="D1 Analysis" analysis={trade.analysisD1} onImageClick={setFullscreenImage} />
                <AnalysisDetailSection title="1h Analysis" analysis={trade.analysis1h} onImageClick={setFullscreenImage} />
                <AnalysisDetailSection title="5m Analysis" analysis={trade.analysis5m} onImageClick={setFullscreenImage} />
                <AnalysisDetailSection title="Result Analysis" analysis={trade.analysisResult} onImageClick={setFullscreenImage} />
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