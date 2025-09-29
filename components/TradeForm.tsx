import React, { useState, useEffect } from 'react';
import { Trade, Account, Direction, Result, DefaultSettings, Analysis } from '../types';

interface TradeFormProps {
  onSave: (trade: Trade) => void;
  onCancel: () => void;
  tradeToEdit?: Trade | null;
  accounts: Account[];
  pairs: string[];
  entries: string[];
  risks: number[];
  defaultSettings: DefaultSettings;
  stoplosses: string[];
  takeprofits: string[];
  closeTypes: string[];
}

const emptyAnalysis: Analysis = { image: '', notes: '' };
const initialTradeState = {
  date: new Date().toISOString().slice(0, 16), // Format for datetime-local
  accountId: '',
  pair: '',
  entry: '',
  direction: Direction.Long,
  risk: 1,
  rr: 1.2,
  commission: 0,
  stoploss: '',
  takeprofit: '',
  result: Result.InProgress,
  missedReason: undefined,
  closeType: undefined,
  analysisD1: { ...emptyAnalysis },
  analysis1h: { ...emptyAnalysis },
  analysis5m: { ...emptyAnalysis },
  analysisResult: { ...emptyAnalysis },
};


const AnalysisSection: React.FC<{
    title: string;
    analysis: Analysis;
    onFileChange: (file: File | null) => void;
    onNotesChange: (notes: string) => void;
}> = ({ title, analysis, onFileChange, onNotesChange }) => {
    
    const handleImageRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        onFileChange(null);
    }
    
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Chart Screenshot</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => onFileChange(e.target.files ? e.target.files[0] : null)}
                        className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500"
                    />
                    {analysis.image && (
                        <div className="mt-2 relative">
                           <img src={analysis.image} alt={`${title} preview`} className="rounded-md max-h-40" />
                           <button onClick={handleImageRemove} className="absolute top-1 right-1 bg-black/50 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-500 transition-colors">&times;</button>
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Notes</label>
                    <textarea
                        value={analysis.notes || ''}
                        onChange={(e) => onNotesChange(e.target.value)}
                        rows={5}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                </div>
            </div>
        </div>
    )
};


const TradeForm: React.FC<TradeFormProps> = ({ onSave, onCancel, tradeToEdit, accounts, pairs, entries, risks, defaultSettings, stoplosses, takeprofits, closeTypes }) => {
  const [trade, setTrade] = useState(() => {
     const defaults = {
        ...initialTradeState,
        accountId: defaultSettings.accountId || (accounts.length > 0 ? accounts[0].id : ''),
        pair: defaultSettings.pair || (pairs.length > 0 ? pairs[0] : ''),
        entry: defaultSettings.entry || '',
        risk: typeof defaultSettings.risk === 'number' ? defaultSettings.risk : (risks.length > 0 ? risks[0] : 1),
        stoploss: stoplosses.length > 0 ? stoplosses[0] : '',
        takeprofit: takeprofits.length > 0 ? takeprofits[0] : '',
     };
     
     const stateToEdit = tradeToEdit ? {
        ...tradeToEdit,
        date: tradeToEdit.date ? new Date(tradeToEdit.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
     } : null;

     const { riskAmount, ...restOfTradeToEdit } = stateToEdit || {};
     return tradeToEdit ? { ...defaults, ...restOfTradeToEdit } : defaults;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumberInput = type === 'number';
    
    let updatedValue: any = isNumberInput ? parseFloat(value) || 0 : value;

    setTrade(prev => {
        let newState = {...prev, [name]: updatedValue};
        
        if (name === 'result') {
            if (value !== Result.Missed) newState.missedReason = undefined;
            if (value === Result.InProgress) newState.closeType = undefined;
        }

        return newState;
    });
  };

  const handleAnalysisChange = (section: keyof Omit<typeof trade, 'id' | 'pnl'>, field: 'notes' | 'image', value: string) => {
      setTrade(prev => ({
          ...prev,
          [section]: {
              ...(prev[section] as Analysis),
              [field]: value
          }
      }))
  };

  const handleFileChange = (section: keyof Omit<typeof trade, 'id' | 'pnl'>, file: File | null) => {
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            handleAnalysisChange(section, 'image', reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        handleAnalysisChange(section, 'image', '');
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade.accountId || !trade.pair) {
      alert("Please select an account and a pair.");
      return;
    }

    const tradeData: Trade = {
      ...trade,
      id: tradeToEdit?.id || '', 
      riskAmount: 0,
      pnl: 0,
      date: new Date(trade.date).toISOString(), // Convert local time to ISO string
    };

    onSave(tradeData);
  };

  const isFormValid = trade.accountId && trade.pair;
  const isClosedTrade = trade.result !== Result.InProgress;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="datetime-local" name="date" value={trade.date} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Account</label>
          <select name="accountId" value={trade.accountId} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Account</option>
            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Pair</label>
          <select name="pair" value={trade.pair} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Pair</option>
            {pairs.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Direction</label>
          <select name="direction" value={trade.direction} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value={Direction.Long}>Long</option>
            <option value={Direction.Short}>Short</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Entry Type</label>
          <select name="entry" value={trade.entry} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Entry</option>
            {entries.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
         <div>
          <label className="block text-sm font-medium mb-1">Stoploss Type</label>
          <select name="stoploss" value={trade.stoploss} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Stoploss</option>
            {stoplosses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Take Profit Type</label>
          <select name="takeprofit" value={trade.takeprofit} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Take Profit</option>
            {takeprofits.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
         <div>
          <label className="block text-sm font-medium mb-1">Result</label>
          <select name="result" value={trade.result} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            {Object.values(Result).map(res => <option key={res} value={res}>{res}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Risk (%)</label>
          <select name="risk" value={trade.risk} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            {risks.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">R:R</label>
          <input type="number" name="rr" value={trade.rr} onChange={handleChange} required step="any" className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Commission</label>
          <input type="number" name="commission" value={trade.commission || 0} onChange={handleChange} step="any" className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9" />
        </div>
         {trade.result === Result.Missed && (
          <div>
            <label className="block text-sm font-medium mb-1">Missed Reason</label>
            <select name="missedReason" value={trade.missedReason || ''} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
              <option value="">Select Reason</option>
              <option value="Fear">Fear</option>
              <option value="Other">Other</option>
            </select>
          </div>
        )}
         {isClosedTrade && (
          <div>
            <label className="block text-sm font-medium mb-1">Close Type</label>
            <select name="closeType" value={trade.closeType || ''} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
              <option value="">Select Type</option>
              {closeTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
            </select>
          </div>
        )}
      </div>
      
      <div className="space-y-4">
        <AnalysisSection title="D1" analysis={trade.analysisD1} onFileChange={(file) => handleFileChange('analysisD1', file)} onNotesChange={(notes) => handleAnalysisChange('analysisD1', 'notes', notes)} />
        <AnalysisSection title="1h" analysis={trade.analysis1h} onFileChange={(file) => handleFileChange('analysis1h', file)} onNotesChange={(notes) => handleAnalysisChange('analysis1h', 'notes', notes)} />
        <AnalysisSection title="5m" analysis={trade.analysis5m} onFileChange={(file) => handleFileChange('analysis5m', file)} onNotesChange={(notes) => handleAnalysisChange('analysis5m', 'notes', notes)} />
        <AnalysisSection title="Result" analysis={trade.analysisResult} onFileChange={(file) => handleFileChange('analysisResult', file)} onNotesChange={(notes) => handleAnalysisChange('analysisResult', 'notes', notes)} />
      </div>

      <div className="flex justify-end pt-4 space-x-3">
        <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
        <button type="submit" disabled={!isFormValid} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
            {tradeToEdit ? 'Update Trade' : 'Add Trade'}
        </button>
      </div>
    </form>
  );
};

export default TradeForm;