
import React, { useState } from 'react';
import { Trade, Account, Direction, Result, Analysis } from '../types';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';

interface TradeFormProps {
  onSave: (trade: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => void;
  onCancel: () => void;
  tradeToEdit?: Trade | null;
  accounts: Account[];
}

const getLocalDateTimeString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const emptyAnalysis: Analysis = { image: undefined, notes: '' };
const initialTradeState = {
  date: getLocalDateTimeString(new Date()), // Format for datetime-local
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
  closeType: undefined,
  analysisD1: { ...emptyAnalysis },
  analysis1h: { ...emptyAnalysis },
  analysis5m: { ...emptyAnalysis },
  analysisResult: { ...emptyAnalysis },
};

const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
    </div>
);

const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const selectClasses = `${baseControlClasses} pl-3 pr-10 py-2 appearance-none bg-no-repeat bg-right [background-position-x:calc(100%-0.75rem)] [background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m8 9 4 4 4-4M8 15l4-4 4 4'/%3e%3c/svg%3e")] disabled:bg-gray-800 disabled:cursor-not-allowed disabled:text-gray-500`;
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;


const AnalysisSection: React.FC<{
    title: string;
    analysis: Analysis;
    onFileChange: (file: File | null) => void;
    onNotesChange: (notes: string) => void;
}> = ({ title, analysis, onFileChange, onNotesChange }) => {
    const imageUrl = useImageBlobUrl(analysis.image);

    const handleImageRemove = (e: React.MouseEvent) => {
        e.preventDefault();
        onFileChange(null);
    }
    
    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) {
                    e.preventDefault();
                    onFileChange(file);
                    return; // Process only the first image found
                }
            }
        }
    };

    return (
        <div className="bg-[#1A1D26] p-4 rounded-lg border border-gray-700/50">
            <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <FormField label="Chart Screenshot">
                        <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => onFileChange(e.target.files ? e.target.files[0] : null)}
                            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                        />
                    </FormField>
                    {imageUrl && (
                        <div className="mt-3 relative">
                           <img src={imageUrl} alt={`${title} preview`} className="rounded-md max-h-40 border border-gray-700" />
                           <button onClick={handleImageRemove} className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-500 transition-colors text-lg leading-none" aria-label="Remove image">&times;</button>
                        </div>
                    )}
                </div>
                <div>
                    <FormField label="Notes">
                        <textarea
                            value={analysis.notes || ''}
                            onChange={(e) => onNotesChange(e.target.value)}
                            onPaste={handlePaste}
                            rows={5}
                            placeholder="Type notes or paste a screenshot..."
                            className={textInputClasses}
                        ></textarea>
                    </FormField>
                </div>
            </div>
        </div>
    )
};


const TradeForm: React.FC<TradeFormProps> = ({ onSave, onCancel, tradeToEdit, accounts }) => {
  const { state } = useAppContext();
  const { userData, currentUser, isGuest } = state;
  const { pairs, entries, risks, defaultSettings, stoplosses, takeprofits, closeTypes } = userData!;

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
        date: tradeToEdit.date ? getLocalDateTimeString(new Date(tradeToEdit.date)) : getLocalDateTimeString(new Date())
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
        if (name === 'result' && value === Result.InProgress) {
            newState.closeType = undefined;
        }
        return newState;
    });
  };

  const handleAnalysisChange = (section: keyof Omit<typeof trade, 'id' | 'pnl' | 'riskAmount'>, field: 'notes' | 'image', value: string | undefined) => {
      setTrade(prev => ({
          ...prev,
          [section]: {
              ...(prev[section] as Analysis),
              [field]: value
          }
      }));
  };

  const handleFileChange = async (section: keyof Omit<typeof trade, 'id' | 'pnl' | 'riskAmount'>, file: File | null) => {
      if (isGuest) {
        alert("Image uploads are disabled in guest mode.");
        return;
      }
      const currentImageKey = (trade[section] as Analysis).image;

      if (currentImageKey) {
          try {
              await supabase.storage.from('screenshots').remove([`${currentUser!.id}/${currentImageKey}`]);
          } catch (e) {
              console.error("Failed to delete old image from Supabase Storage", e);
          }
      }

      if (file) {
        try {
            const imageKey = `${crypto.randomUUID()}-${file.name}`;
            const { error } = await supabase.storage.from('screenshots').upload(`${currentUser!.id}/${imageKey}`, file, { contentType: file.type });
            if (error) throw error;
            handleAnalysisChange(section, 'image', imageKey);
        } catch (error) {
            console.error("Error saving image to Supabase Storage:", error);
            alert("Could not save image.");
        }
      } else {
        handleAnalysisChange(section, 'image', undefined);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade.accountId || !trade.pair) {
      alert("Please select an account and a pair.");
      return;
    }
    const { riskAmount, pnl, ...tradeData } = trade;
    onSave({
        ...tradeData,
        id: tradeToEdit?.id,
        date: new Date(trade.date).toISOString(),
    });
  };

  const isFormValid = trade.accountId && trade.pair;
  const isClosedTrade = trade.result !== Result.InProgress;

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-gray-200">
        <div className="bg-[#232733] p-6 rounded-lg border border-gray-700/50">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                <FormField label="Date">
                    <input type="datetime-local" name="date" value={trade.date} onChange={handleChange} required className={textInputClasses} />
                </FormField>
                <FormField label="Account">
                    <select name="accountId" value={trade.accountId} onChange={handleChange} required className={selectClasses}>
                        <option value="">Select Account</option>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                </FormField>
                <FormField label="Pair">
                    <select name="pair" value={trade.pair} onChange={handleChange} required className={selectClasses}>
                        <option value="">Select Pair</option>
                        {pairs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </FormField>
                <FormField label="Direction">
                    <select name="direction" value={trade.direction} onChange={handleChange} required className={selectClasses}>
                        <option value={Direction.Long}>Long</option>
                        <option value={Direction.Short}>Short</option>
                    </select>
                </FormField>
                <FormField label="Entry Type">
                    <select name="entry" value={trade.entry} onChange={handleChange} className={selectClasses}>
                        <option value="">Select Entry</option>
                        {entries.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>
                <FormField label="R:R Ratio">
                    <input type="number" name="rr" value={trade.rr} onChange={handleChange} required step="any" className={numberInputClasses} />
                </FormField>
                <FormField label="SL Type">
                    <select name="stoploss" value={trade.stoploss} onChange={handleChange} className={selectClasses}>
                        <option value="">Select Stoploss</option>
                        {stoplosses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>
                <FormField label="TP Type">
                    <select name="takeprofit" value={trade.takeprofit} onChange={handleChange} className={selectClasses}>
                        <option value="">Select Take Profit</option>
                        {takeprofits.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>
                <FormField label="Result">
                    <select name="result" value={trade.result} onChange={handleChange} required className={selectClasses}>
                        {Object.values(Result).map(res => <option key={res} value={res}>{res}</option>)}
                    </select>
                </FormField>
                <FormField label="Risk (%)">
                    <select name="risk" value={trade.risk} onChange={handleChange} className={selectClasses}>
                        {risks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </FormField>
                <FormField label="Commission ($)">
                    <input type="number" name="commission" value={trade.commission || 0} onChange={handleChange} step="any" className={numberInputClasses} />
                </FormField>
                <FormField label="Close Type">
                    <select name="closeType" value={trade.closeType || ''} onChange={handleChange} className={selectClasses} disabled={!isClosedTrade}>
                        <option value="">Select Type</option>
                        {closeTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                    </select>
                </FormField>
            </div>
        </div>
      
      <div>
            <h3 className="text-xl font-semibold text-white mb-4">Analysis Breakdown</h3>
            <div className="space-y-4">
                <AnalysisSection title="D1 Analysis" analysis={trade.analysisD1} onFileChange={(file) => handleFileChange('analysisD1', file)} onNotesChange={(notes) => handleAnalysisChange('analysisD1', 'notes', notes)} />
                <AnalysisSection title="1h Analysis" analysis={trade.analysis1h} onFileChange={(file) => handleFileChange('analysis1h', file)} onNotesChange={(notes) => handleAnalysisChange('analysis1h', 'notes', notes)} />
                <AnalysisSection title="5m Analysis" analysis={trade.analysis5m} onFileChange={(file) => handleFileChange('analysis5m', file)} onNotesChange={(notes) => handleAnalysisChange('analysis5m', 'notes', notes)} />
                <AnalysisSection title="Result Analysis" analysis={trade.analysisResult} onFileChange={(file) => handleFileChange('analysisResult', file)} onNotesChange={(notes) => handleAnalysisChange('analysisResult', 'notes', notes)} />
            </div>
      </div>

      <div className="flex justify-end pt-4">
        <button type="submit" disabled={!isFormValid} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed font-medium">
            {tradeToEdit ? 'Update Trade' : 'Add Trade'}
        </button>
      </div>
    </form>
  );
};

export default TradeForm;
