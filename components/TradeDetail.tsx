import React, { useState } from 'react';
import { Trade, Account, Result, Analysis } from '../types';

interface TradeDetailProps {
  trade: Trade;
  account?: Account;
}

const DetailItem: React.FC<{ label: string; value: React.ReactNode; className?: string }> = ({ label, value, className }) => (
    <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className={`text-lg font-semibold text-white ${className}`}>{value}</p>
    </div>
);

const AnalysisDetailSection: React.FC<{ 
    title: string; 
    analysis: Analysis;
    onImageClick: (src: string) => void;
}> = ({ title, analysis, onImageClick }) => (
    <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
        <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
        <div className="space-y-3">
            {analysis.image ? (
                <img 
                    src={analysis.image} 
                    alt={`${title} chart`} 
                    className="rounded-md border border-gray-700 w-full cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => onImageClick(analysis.image!)}
                />
            ) : (
                <div className="flex items-center justify-center h-40 bg-gray-800 rounded-md text-gray-500 w-full">No Image</div>
            )}
            <p className="text-gray-300 whitespace-pre-wrap text-sm w-full pt-1">{analysis.notes || 'No notes for this section.'}</p>

        </div>
    </div>
);


const TradeDetail: React.FC<TradeDetailProps> = ({ trade, account }) => {
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);

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
  
  const currency = account?.currency || 'USD';

  return (
    <div className="space-y-6">
        <h2 className="text-2xl font-bold text-center">{trade.pair} - <span className={getResultColor(trade.result)}>{trade.result}</span></h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center bg-gray-900/50 p-4 rounded-lg">
        <DetailItem label="PnL" value={trade.pnl.toLocaleString('en-US', { style: 'currency', currency })} className={trade.pnl >= 0 ? 'text-green-400' : 'text-red-400'} />
        <DetailItem label="R:R" value={trade.rr.toFixed(2)} />
        <DetailItem label="Risk" value={trade.riskAmount.toLocaleString('en-US', { style: 'currency', currency })} />
        <DetailItem label="Risk (%)" value={`${trade.risk}%`} />
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <DetailItem label="Account" value={account?.name || 'N/A'} />
        <DetailItem label="Date" value={new Date(trade.date).toLocaleDateString()} />
        <DetailItem label="Direction" value={trade.direction} className={trade.direction === 'Long' ? 'text-cyan-400' : 'text-purple-400'}/>
        <DetailItem label="Setup" value={trade.setup || 'N/A'} />
      </div>

      <div className="space-y-4">
        <AnalysisDetailSection title="D1 Analysis" analysis={trade.analysisD1} onImageClick={setFullscreenImage} />
        <AnalysisDetailSection title="1h Analysis" analysis={trade.analysis1h} onImageClick={setFullscreenImage} />
        <AnalysisDetailSection title="5m Analysis" analysis={trade.analysis5m} onImageClick={setFullscreenImage} />
        <AnalysisDetailSection title="Result Analysis" analysis={trade.analysisResult} onImageClick={setFullscreenImage} />
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