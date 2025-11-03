import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trade, Account, Direction, Result, Analysis } from '../types';
import useSupabaseImage from '../hooks/useSupabaseImage';
import { useAppContext } from '../services/appState';
import { uploadImage, deleteImage } from '../services/storageService';
import { ICONS } from '../constants';
import useDebounce from '../hooks/useDebounce';

interface TradeFormProps {
  onSaveAndClose: (trade: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => void;
  onAutoSave?: (trade: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => Promise<string | undefined>;
  onClose: () => void;
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
    const { url: imageUrl, isLoading, error: imageError } = useSupabaseImage(analysis.image);

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
                    {isLoading && <div className="mt-3 text-sm text-gray-400 animate-pulse">Loading preview...</div>}
                    {imageError && <div className="mt-3 text-sm text-red-500">Error loading image</div>}
                    {imageUrl && !imageError && (
                        <div className="mt-3 relative inline-block">
                           <img src={imageUrl} alt={`${title} preview`} className="rounded-md h-40 w-auto border border-gray-700 object-contain" />
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

const timeframeMap: Record<string, { key: keyof Trade, title: string }> = {
    '1D': { key: 'analysisD1', title: 'D1 Analysis' },
    '1h': { key: 'analysis1h', title: '1h Analysis' },
    '5m': { key: 'analysis5m', title: '5m Analysis' },
    'Result': { key: 'analysisResult', title: 'Result Analysis' },
};

const TradeForm: React.FC<TradeFormProps> = ({ onSaveAndClose, onAutoSave, onClose, tradeToEdit, accounts }) => {
  const { state, dispatch } = useAppContext();
  const { userData, currentUser } = state;
  const { pairs, entries, risks, defaultSettings, stoplosses, takeprofits, closeTypes, analysisTimeframes } = userData!;
  
  const initialTradeStateRef = useRef<any>();
  const [isDirty, setIsDirty] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const rrInputRef = useRef<HTMLInputElement>(null);
  const commissionInputRef = useRef<HTMLInputElement>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [isFirstSave, setIsFirstSave] = useState(!tradeToEdit);
  const [currentTradeId, setCurrentTradeId] = useState<string | undefined>(tradeToEdit?.id);

  const [trade, setTrade] = useState(() => {
     const initialTradeState = {
        date: getLocalDateTimeString(new Date()),
        accountId: defaultSettings.accountId || (accounts.length > 0 ? accounts[0].id : ''),
        pair: defaultSettings.pair || (pairs.length > 0 ? pairs[0] : ''),
        entry: defaultSettings.entry || '',
        direction: Direction.Long,
        risk: typeof defaultSettings.risk === 'number' ? defaultSettings.risk : (risks.length > 0 ? risks[0] : 1),
        rr: '1.2',
        commission: '0',
        stoploss: defaultSettings.stoploss || '',
        takeprofit: defaultSettings.takeprofit || '',
        result: Result.InProgress,
        closeType: undefined,
        analysisD1: { ...emptyAnalysis },
        analysis1h: { ...emptyAnalysis },
        analysis5m: { ...emptyAnalysis },
        analysisResult: { ...emptyAnalysis },
     };

     const stateToEdit = tradeToEdit ? {
        ...tradeToEdit,
        date: tradeToEdit.date ? getLocalDateTimeString(new Date(tradeToEdit.date)) : getLocalDateTimeString(new Date()),
        rr: String(tradeToEdit.rr),
        commission: String(tradeToEdit.commission || 0),
     } : null;

     const { id, riskAmount, pnl, ...restOfTradeToEdit } = stateToEdit || {};
     const finalInitialState = tradeToEdit ? { ...initialTradeState, ...restOfTradeToEdit } : initialTradeState;
     initialTradeStateRef.current = finalInitialState;
     return finalInitialState;
  });

  const debouncedTrade = useDebounce(trade, 1000);

  useEffect(() => {
    const currentStateString = JSON.stringify(trade);
    const initialStateString = JSON.stringify(initialTradeStateRef.current);
    const dirty = currentStateString !== initialStateString;
    setIsDirty(dirty);
  }, [trade]);

  useEffect(() => {
    const performAutoSave = async () => {
        // Only auto-save if we are editing an existing trade
        if (!tradeToEdit || !isDirty || !onAutoSave || isSaving) return;

        // Validation for autosave
        if (trade.rr.trim() === '' || isNaN(parseFloat(trade.rr)) || trade.rr.trim().endsWith('.') ||
            trade.commission.trim() === '' || isNaN(parseFloat(trade.commission)) || trade.commission.trim().endsWith('.')) {
            return;
        }

        setIsSaving(true);
        const { riskAmount, pnl, ...tradeData } = trade;
        await onAutoSave({
            ...tradeData,
            id: currentTradeId,
            date: new Date(trade.date).toISOString(),
            rr: parseFloat(trade.rr),
            commission: parseFloat(trade.commission)
        });

        // After save, reset the "dirty" state by updating the initial state reference
        initialTradeStateRef.current = trade;
        setIsDirty(false);

        setIsSaving(false);
    };

    performAutoSave();
  }, [debouncedTrade, onAutoSave, isDirty, currentTradeId, tradeToEdit, isSaving]);
  
  const [isUploading, setIsUploading] = useState(false);

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
        if(window.confirm("You have unsaved changes. Are you sure you want to close?")) {
            onClose();
        }
    } else {
        onClose();
    }
  }, [isDirty, onClose]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (wrapper) {
      wrapper.addEventListener('closeRequest', handleCloseRequest);
    }
    return () => {
      if (wrapper) {
        wrapper.removeEventListener('closeRequest', handleCloseRequest);
      }
    };
  }, [handleCloseRequest]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (errors[name]) {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });
    }

    if (name === 'rr' || name === 'commission') {
        const normalizedValue = value.replace(',', '.');
        if (normalizedValue === '' || /^[0-9]*\.?[0-9]*$/.test(normalizedValue)) {
            setTrade(prev => ({ ...prev, [name]: normalizedValue }));
        }
        return;
    }
    
    setTrade(prev => {
        const isNumericSelect = name === 'risk';
        const updatedValue = isNumericSelect ? parseFloat(value) || 0 : value;
        let newState = { ...prev, [name]: updatedValue };
        if (name === 'result') {
            if (value === Result.Win) {
                newState.closeType = 'TP hit';
            } else if (value === Result.Loss) {
                newState.closeType = 'SL hit';
            }
        }
        return newState;
    });
  };

  const handleAnalysisChange = (sectionKey: keyof Trade, field: 'notes' | 'image', value: string | undefined) => {
      setTrade(prev => ({
          ...prev,
          [sectionKey]: {
              ...(prev[sectionKey] as Analysis),
              [field]: value
          }
      }));
  };

  const handleFileChange = async (sectionKey: keyof Trade, file: File | null) => {
      const currentImagePath = (trade[sectionKey] as Analysis).image;

      // Delete old image if it exists
      if (currentImagePath) {
          await deleteImage(currentImagePath);
      }

      if (file && currentUser) {
          setIsUploading(true);
          try {
              const storagePath = await uploadImage(file, currentUser.id);
              handleAnalysisChange(sectionKey, 'image', storagePath);
          } catch (error) {
              console.error("Error during image upload:", error);
              const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
              dispatch({ type: 'SHOW_TOAST', payload: { message: `Upload failed: ${errorMessage}`, type: 'error' } });
              handleAnalysisChange(sectionKey, 'image', undefined); // Clear image path on failure
          } finally {
              setIsUploading(false);
          }
      } else {
          // This handles the case where the "Remove" button is clicked
          handleAnalysisChange(sectionKey, 'image', undefined);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // This function is now only for creating new trades.
    if (tradeToEdit) return;

    const newErrors: Record<string, string> = {};
    if (trade.rr.trim() === '' || isNaN(parseFloat(trade.rr)) || trade.rr.trim().endsWith('.')) {
        newErrors.rr = "This field is required and must be a valid number.";
    }
    if (trade.commission.trim() === '' || isNaN(parseFloat(trade.commission)) || trade.commission.trim().endsWith('.')) {
        newErrors.commission = "This field is required and must be a valid number.";
    }

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);

        const firstErrorField = Object.keys(newErrors)[0];
        const fieldRef = firstErrorField === 'rr' 
            ? rrInputRef.current 
            : commissionInputRef.current;

        if (fieldRef) {
            fieldRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            fieldRef.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => {
                fieldRef.classList.remove('ring-2', 'ring-red-500');
            }, 1000);
        }
        return;
    }

    if (!trade.accountId || !trade.pair) {
      alert("Please select an account and a pair.");
      return;
    }

    const { riskAmount, pnl, ...tradeData } = trade;
    onSaveAndClose({
        ...tradeData,
        id: currentTradeId,
        date: new Date(trade.date).toISOString(),
        rr: parseFloat(trade.rr),
        commission: parseFloat(trade.commission)
    });
  };
  
  const isClosedTrade = trade.result !== Result.InProgress;

  return (
    <div ref={wrapperRef} id="trade-form-wrapper">
        <form onSubmit={handleSubmit} className="space-y-6 text-gray-200">
            {/* --- Section 1: Setup --- */}
            <div className="space-y-4 p-4 bg-[#232733] rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-semibold text-white">Trade Setup</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
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
                </div>
            </div>

            {/* --- Section 2: Management --- */}
            <div className="space-y-4 p-4 bg-[#232733] rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-semibold text-white">Risk & Management</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                    {/* --- Top Row --- */}
                    <FormField label="SL Type">
                        <select name="stoploss" value={trade.stoploss} onChange={handleChange} className={selectClasses}>
                            <option value="">Select SL</option>
                            {stoplosses.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FormField>
                    <FormField label="TP Type">
                        <select name="takeprofit" value={trade.takeprofit} onChange={handleChange} className={selectClasses}>
                            <option value="">Select TP</option>
                            {takeprofits.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Entry Type">
                        <select name="entry" value={trade.entry} onChange={handleChange} className={selectClasses}>
                            <option value="">Select Entry</option>
                            {entries.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Close Type">
                        <select name="closeType" value={trade.closeType || ''} onChange={handleChange} className={selectClasses} disabled={!isClosedTrade}>
                            <option value="">Select Type</option>
                            {closeTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                        </select>
                    </FormField>
                    
                    {/* --- Bottom Row --- */}
                    <FormField label="Risk (%)">
                        <select name="risk" value={trade.risk} onChange={handleChange} className={selectClasses}>
                            {risks.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </FormField>
                    <FormField label="R:R Ratio">
                        <input 
                            ref={rrInputRef}
                            type="text"
                            inputMode="decimal"
                            name="rr"
                            value={trade.rr}
                            onChange={handleChange}
                            className={`${numberInputClasses} ${errors.rr ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.rr && <p className="text-red-500 text-xs mt-1">{errors.rr}</p>}
                    </FormField>
                    <FormField label="Commission">
                        <input
                            ref={commissionInputRef}
                            type="text"
                            inputMode="decimal"
                            name="commission"
                            value={trade.commission}
                            onChange={handleChange}
                            className={`${numberInputClasses} ${errors.commission ? 'border-red-500 focus:ring-red-500' : ''}`}
                        />
                        {errors.commission && <p className="text-red-500 text-xs mt-1">{errors.commission}</p>}
                    </FormField>
                    <FormField label="Result">
                        <select name="result" value={trade.result} onChange={handleChange} required className={selectClasses}>
                            {Object.values(Result).map(res => <option key={res} value={res}>{res}</option>)}
                        </select>
                    </FormField>
                </div>
            </div>

            {/* --- Section 3: Analysis --- */}
            <div className="space-y-4 p-4 bg-[#232733] rounded-lg border border-gray-700/50">
                <h3 className="text-xl font-semibold text-white">Analysis Breakdown</h3>
                <div className="space-y-4">
                    {(analysisTimeframes || []).map(tf => {
                       const map = timeframeMap[tf];
                       if (!map) return null;
                       const analysisKey = map.key;
                       const analysisData = trade[analysisKey] as Analysis;
                       return (
                           <AnalysisSection 
                                key={tf}
                                title={map.title} 
                                analysis={analysisData} 
                                onFileChange={(file) => handleFileChange(analysisKey, file)} 
                                onNotesChange={(notes) => handleAnalysisChange(analysisKey, 'notes', notes)} 
                           />
                       )
                    })}
                </div>
            </div>
            
            {/* --- Actions --- */}
            <div className="flex justify-between items-center gap-3 pt-4">
                <div className="text-sm text-gray-500 transition-opacity duration-300">
                    {tradeToEdit && isSaving && (
                        <span className="flex items-center gap-2 animate-pulse">
                            <svg className="animate-spin h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Saving...
                        </span>
                    )}
                    {tradeToEdit && !isSaving && !isDirty && (
                        <span className="flex items-center gap-2 opacity-70">✓ Saved</span>
                    )}
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleCloseRequest}
                        className="px-4 py-2 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors text-sm font-medium"
                    >
                        {tradeToEdit ? 'Close' : 'Cancel'}
                    </button>
                    {!tradeToEdit && (
                        <button
                            type="submit"
                            disabled={isUploading || isSaving}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed text-sm font-medium"
                        >
                            {isUploading ? 'Uploading...' : 'Add Trade'}
                        </button>
                    )}
                </div>
            </div>
        </form>
    </div>
  );
};

export default TradeForm;