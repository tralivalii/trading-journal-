import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trade, Account, Direction, Result, Analysis } from '../types';
import useImageBlobUrl from '../hooks/useImageBlobUrl';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';

interface TradeFormProps {
  onSave: (trade: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => void;
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

// Client-side image compression utility
const compressImage = (file: File, maxWidth = 1920, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const scale = maxWidth / img.width;
                canvas.width = scale < 1 ? maxWidth : img.width;
                canvas.height = scale < 1 ? img.height * scale : img.height;

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    return reject(new Error('Failed to get canvas context'));
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const newFile = new File([blob], file.name, {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            reject(new Error('Canvas toBlob failed'));
                        }
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
    });
};

const timeframeMap: Record<string, { key: keyof Trade, title: string }> = {
    '1D': { key: 'analysisD1', title: 'D1 Analysis' },
    '1h': { key: 'analysis1h', title: '1h Analysis' },
    '5m': { key: 'analysis5m', title: '5m Analysis' },
    'Result': { key: 'analysisResult', title: 'Result Analysis' },
};

const TradeForm: React.FC<TradeFormProps> = ({ onSave, onClose, tradeToEdit, accounts }) => {
  const { state, dispatch } = useAppContext();
  const { userData, currentUser, isGuest } = state;
  const { pairs, entries, risks, defaultSettings, stoplosses, takeprofits, closeTypes, analysisTimeframes } = userData!;
  
  const initialTradeStateRef = useRef<Omit<Trade, 'id' | 'pnl' | 'riskAmount'>>();
  const [isDirty, setIsDirty] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [trade, setTrade] = useState(() => {
     const initialTradeState = {
        date: getLocalDateTimeString(new Date()),
        accountId: defaultSettings.accountId || (accounts.length > 0 ? accounts[0].id : ''),
        pair: defaultSettings.pair || (pairs.length > 0 ? pairs[0] : ''),
        entry: defaultSettings.entry || '',
        direction: Direction.Long,
        risk: typeof defaultSettings.risk === 'number' ? defaultSettings.risk : (risks.length > 0 ? risks[0] : 1),
        rr: 1.2,
        commission: 0,
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
        date: tradeToEdit.date ? getLocalDateTimeString(new Date(tradeToEdit.date)) : getLocalDateTimeString(new Date())
     } : null;

     const { id, riskAmount, pnl, ...restOfTradeToEdit } = stateToEdit || {};
     const finalInitialState = tradeToEdit ? { ...initialTradeState, ...restOfTradeToEdit } : initialTradeState;
     initialTradeStateRef.current = finalInitialState;
     return finalInitialState;
  });

  useEffect(() => {
    const currentStateString = JSON.stringify(trade);
    const initialStateString = JSON.stringify(initialTradeStateRef.current);
    setIsDirty(currentStateString !== initialStateString);
  }, [trade]);
  
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
      if (isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "Image uploads are disabled in guest mode.", type: 'error' } });
        return;
      }
      const currentImageKey = (trade[sectionKey] as Analysis).image;

      if (currentImageKey) {
          try {
              const { error } = await supabase.storage.from('screenshots').remove([`${currentUser!.id}/${currentImageKey}`]);
              if (error) throw error;
          } catch (e) {
              console.error("Failed to delete old image from Supabase Storage", e);
          }
      }

      if (file) {
        setIsUploading(true);
        try {
            const compressedFile = await compressImage(file);
            const imageKey = `${crypto.randomUUID()}-${compressedFile.name}`;
            const { error } = await supabase.storage.from('screenshots').upload(`${currentUser!.id}/${imageKey}`, compressedFile, { contentType: compressedFile.type });
            if (error) throw error;
            handleAnalysisChange(sectionKey, 'image', imageKey);
        } catch (error) {
            console.error("Error saving image to Supabase Storage:", error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: "Could not save image.", type: 'error' } });
        } finally {
            setIsUploading(false);
        }
      } else {
        handleAnalysisChange(sectionKey, 'image', undefined);
      }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trade.accountId || !trade.pair) {
      alert("Please select an account and a pair.");
      return;
    }
    const { riskAmount, pnl, ...tradeData } = trade as any; // Cast to avoid TS errors on extra fields
    onSave({
        ...tradeData,
        id: tradeToEdit?.id,
        date: new Date(trade.date).toISOString(),
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
            <div className="flex justify-end gap-4 pt-4">
                <button 
                    type="button" 
                    onClick={handleCloseRequest} 
                    className="px-6 py-2.5 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 hover:text-white transition-colors font-medium"
                >
                    Cancel
                </button>
                <button 
                    type="submit" 
                    disabled={isUploading} 
                    className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed font-medium"
                >
                    {isUploading ? 'Uploading...' : (tradeToEdit ? 'Update Trade' : 'Add Trade')}
                </button>
            </div>
        </form>
    </div>
  );
};

export default TradeForm;