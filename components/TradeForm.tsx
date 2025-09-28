import React, { useState, useEffect } from 'react';
import { Trade, Account, Direction, Result, DefaultSettings, Analysis } from '../types';

interface TradeFormProps {
  onSave: (trade: Trade) => void;
  onCancel: () => void;
  tradeToEdit?: Trade | null;
  accounts: Account[];
  pairs: string[];
  setups: string[];
  risks: number[];
  defaultSettings: DefaultSettings;
}

const emptyAnalysis: Analysis = { image: '', notes: '' };
const initialTradeState = {
  date: new Date().toISOString().split('T')[0],
  accountId: '',
  pair: '',
  setup: '',
  direction: Direction.Long,
  risk: 1,
  rr: 1.2,
  commission: 0,
  // riskAmount is now calculated in App.tsx
  result: Result.InProgress,
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


const TradeForm: React.FC<TradeFormProps> = ({ onSave, onCancel, tradeToEdit, accounts, pairs, setups, risks, defaultSettings }) => {
  const [trade, setTrade] = useState(() => {
     const defaults = {
        ...initialTradeState,
        accountId: defaultSettings.accountId || (accounts.length > 0 ? accounts[0].id : ''),
        pair: defaultSettings.pair || (pairs.length > 0 ? pairs[0] : ''),
        setup: defaultSettings.setup || '',
        risk: typeof defaultSettings.risk === 'number' ? defaultSettings.risk : (risks.length > 0 ? risks[0] : 1),
     };
     // The tradeToEdit object will not have riskAmount, so we remove it from the state
     const { riskAmount, ...restOfTradeToEdit } = tradeToEdit || {};
     return tradeToEdit ? { ...defaults, ...restOfTradeToEdit } : defaults;
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const isNumberInput = type === 'number';
    setTrade(prev => ({ ...prev, [name]: isNumberInput ? parseFloat(value) || 0 : value }));
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

    // Pass a compliant Trade object to the parent.
    // The parent will calculate riskAmount and PnL.
    // FIX: The complex type assertion was causing a TypeScript error.
    // Spreading the `trade` state and then explicitly defining the remaining properties
    // ensures the created object correctly matches the `Trade` type.
    const tradeData: Trade = {
      ...trade,
      id: tradeToEdit?.id || '', // Parent will handle UUID for new trades
      riskAmount: 0, // Placeholder, will be calculated in App.tsx
      pnl: 0, // Placeholder, will be calculated in App.tsx
    };

    onSave(tradeData);
  };

  const isFormValid = trade.accountId && trade.pair;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-gray-200">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Date</label>
          <input type="date" name="date" value={trade.date} onChange={handleChange} required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9" />
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
          <label className="block text-sm font-medium mb-1">Setup</label>
          <select name="setup" value={trade.setup} onChange={handleChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-9">
            <option value="">Select Setup</option>
            {setups.map(s => <option key={s} value={s}>{s}</option>)}
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