import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trade, Account, Result, Direction, Analysis } from '../types';
import { useAppContext } from '../services/appState';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';
import CustomSelect from './ui/CustomSelect';
import useImageBlobUrl from '../hooks/useImageBlobUrl';

// Reusable FormField component for consistency (similar to AccountForm)
const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
    </div>
);

// Shared styles for form controls
const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const selectClasses = `${textInputClasses} pl-3 pr-10 py-2 appearance-none bg-no-repeat bg-right [background-position-x:calc(100%-0.75rem)] [background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m8 9 4 4 4-4'/%3e%3c/svg%3e")]`;

const timeframeMap: Record<string, { key: keyof Trade, title: string }> = {
    '1D': { key: 'analysisD1', title: 'Daily Analysis' },
    '1h': { key: 'analysis1h', title: '1-Hour Analysis' },
    '5m': { key: 'analysis5m', title: '5-Minute Analysis' },
    'Result': { key: 'analysisResult', title: 'Result Analysis' },
};


interface ImageUploaderProps {
    storagePath?: string;
    onUpload: (path: string) => void;
    onRemove: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ storagePath, onUpload, onRemove }) => {
    const { state } = useAppContext();
    const { currentUser } = state;
    const { url: imageUrl, isLoading: isUrlLoading } = useImageBlobUrl(storagePath);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || !currentUser) return;

        setIsUploading(true);
        try {
            // Remove existing image if one exists
            if (storagePath) {
                await supabase.storage.from('trade-attachments').remove([storagePath]);
            }

            const newPath = `${currentUser.id}/${crypto.randomUUID()}-${file.name}`;
            const { error } = await supabase.storage.from('trade-attachments').upload(newPath, file);
            if (error) throw error;
            onUpload(newPath);
        } catch (error) {
            console.error('Error uploading image:', error);
            // Optionally dispatch a toast notification
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemove = async () => {
        if (!storagePath) return;
        try {
            await supabase.storage.from('trade-attachments').remove([storagePath]);
            onRemove();
        } catch (error) {
            console.error('Error removing image:', error);
        }
    };

    return (
        <div className="w-full bg-gray-900/50 p-3 rounded-md border border-dashed border-gray-600">
            {isUrlLoading || isUploading ? (
                <div className="flex items-center justify-center h-40 text-gray-500">
                     <svg className="animate-spin h-5 w-5 text-white mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isUploading ? 'Uploading...' : 'Loading...'}
                </div>
            ) : imageUrl ? (
                <div className="relative group">
                    <img src={imageUrl} alt="Trade analysis" className="rounded-md w-full h-auto max-h-60 object-contain" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button type="button" onClick={handleRemove} className="p-2 bg-red-600 text-white rounded-full hover:bg-red-500 transition-colors">
                            <span className="w-5 h-5 block">{ICONS.trash}</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-center h-40">
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors">
                        <span className="w-5 h-5">{ICONS.plus}</span>
                        Upload Chart
                    </button>
                </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </div>
    );
};

interface TradeFormProps {
  onSave: (trade: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => void;
  onClose: () => void;
  tradeToEdit: Trade | null;
  accounts: Account[];
}

const TradeForm: React.FC<TradeFormProps> = ({ onSave, onClose, tradeToEdit, accounts }) => {
    const { state } = useAppContext();
    const { defaultSettings, pairs, entries, risks, stoplosses, takeprofits, closeTypes, analysisTimeframes } = state.userData!;
    
    const getInitialState = useCallback(() => {
      if (tradeToEdit) {
        return { ...tradeToEdit };
      }
      return {
        date: new Date().toISOString(),
        accountId: defaultSettings.accountId || (accounts.length > 0 ? accounts[0].id : ''),
        pair: defaultSettings.pair || '',
        direction: Direction.Long,
        entry: defaultSettings.entry || '',
        risk: Number(defaultSettings.risk) || 1,
        rr: 2,
        result: Result.InProgress,
        commission: 0,
        stoploss: defaultSettings.stoploss || '',
        takeprofit: defaultSettings.takeprofit || '',
        entryPrice: undefined,
        stoplossPrice: undefined,
        takeprofitPrice: undefined,
        closeType: '',
        analysisD1: { image: undefined, notes: '' },
        analysis1h: { image: undefined, notes: '' },
        analysis5m: { image: undefined, notes: '' },
        analysisResult: { image: undefined, notes: '' },
        aiAnalysis: '',
      } as Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string };
    }, [tradeToEdit, defaultSettings, accounts]);

    const [trade, setTrade] = useState(getInitialState());
    const [initialStateJSON, setInitialStateJSON] = useState(() => JSON.stringify(getInitialState()));
    const isDirty = JSON.stringify(trade) !== initialStateJSON;
    const [activeTab, setActiveTab] = useState('Details');

    useEffect(() => {
        const tradeFormWrapper = document.getElementById('trade-form-wrapper');
        const handleCloseRequest = () => {
          if (isDirty) {
            if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
              onClose();
            }
          } else {
            onClose();
          }
        };

        if (tradeFormWrapper) {
          tradeFormWrapper.addEventListener('closeRequest', handleCloseRequest);
        }

        return () => {
          if (tradeFormWrapper) {
            tradeFormWrapper.removeEventListener('closeRequest', handleCloseRequest);
          }
        };
    }, [isDirty, onClose]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const isNumber = type === 'number' && name !== 'date';
        setTrade(prev => ({ ...prev, [name]: isNumber ? parseFloat(value) || 0 : value }));
    };
    
    const handleAnalysisChange = (timeframeKey: keyof Trade, field: keyof Analysis, value: string | undefined) => {
        setTrade(prev => ({
            ...prev,
            [timeframeKey]: {
                ...(prev[timeframeKey] as Analysis),
                [field]: value,
            }
        }));
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
    
    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!trade.accountId) {
            alert("Please select an account.");
            return;
        }
        if (!trade.pair) {
            alert("Please select or enter a pair.");
            return;
        }
        
        const { id, riskAmount, pnl, ...tradeToSave } = trade as Trade;
        onSave(tradeToEdit ? { ...tradeToSave, id: tradeToEdit.id } : tradeToSave);
    };
    
    const renderDetails = () => (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Column 1 */}
            <div className="space-y-4">
                <FormField label="Date & Time">
                    <input 
                        type="datetime-local" 
                        name="date" 
                        value={trade.date ? new Date(trade.date).toISOString().slice(0, 16) : ''}
                        onChange={(e) => setTrade(prev => ({ ...prev, date: new Date(e.target.value).toISOString() }))} 
                        className={textInputClasses} 
                    />
                </FormField>
                <FormField label="Account">
                    <select name="accountId" value={trade.accountId} onChange={handleChange} className={selectClasses}>
                        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                </FormField>
                <FormField label="Pair">
                    <input list="pairs" name="pair" value={trade.pair} onChange={handleChange} className={textInputClasses} />
                    <datalist id="pairs">
                        {pairs.map(p => <option key={p} value={p} />)}
                    </datalist>
                </FormField>
                <FormField label="Direction">
                    <select name="direction" value={trade.direction} onChange={handleChange} className={selectClasses}>
                        {Object.values(Direction).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </FormField>
            </div>
            {/* Column 2 */}
            <div className="space-y-4">
                <FormField label="Entry Type">
                    <input list="entries" name="entry" value={trade.entry} onChange={handleChange} className={textInputClasses} />
                    <datalist id="entries">
                        {entries.map(e => <option key={e} value={e} />)}
                    </datalist>
                </FormField>
                <FormField label="Risk (%)">
                    <select name="risk" value={trade.risk} onChange={handleChange} className={selectClasses}>
                        {risks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </FormField>
                 <FormField label="R:R Ratio">
                    <input type="number" name="rr" value={trade.rr} onChange={handleChange} className={numberInputClasses} step="0.1" />
                </FormField>
                <FormField label="Commission ($)">
                    <input type="number" name="commission" value={trade.commission || ''} onChange={handleChange} className={numberInputClasses} step="0.01" />
                </FormField>
            </div>
            {/* Column 3 */}
            <div className="space-y-4">
                <FormField label="Stoploss Type">
                    <input list="stoplosses" name="stoploss" value={trade.stoploss} onChange={handleChange} className={textInputClasses} />
                    <datalist id="stoplosses">
                        {stoplosses.map(s => <option key={s} value={s} />)}
                    </datalist>
                </FormField>
                <FormField label="Takeprofit Type">
                    <input list="takeprofits" name="takeprofit" value={trade.takeprofit} onChange={handleChange} className={textInputClasses} />
                    <datalist id="takeprofits">
                        {takeprofits.map(t => <option key={t} value={t} />)}
                    </datalist>
                </FormField>
                <FormField label="Result">
                    <CustomSelect
                        value={trade.result}
                        options={Object.values(Result)}
                        onChange={(value) => setTrade(prev => ({ ...prev, result: value }))}
                        getDisplayClasses={getResultClasses}
                    />
                </FormField>
                {trade.result !== Result.InProgress && trade.result !== Result.Missed && (
                    <FormField label="Close Type">
                        <select name="closeType" value={trade.closeType} onChange={handleChange} className={selectClasses}>
                            <option value="">Select...</option>
                            {closeTypes.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </FormField>
                )}
            </div>
        </div>
    );
    
    const renderAnalysis = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(analysisTimeframes || Object.keys(timeframeMap)).map(tfKey => {
                const map = timeframeMap[tfKey];
                if (!map) return null;
                const analysis = trade[map.key as keyof Trade] as Analysis;

                return (
                    <div key={map.key}>
                        <h3 className="text-lg font-semibold text-white mb-2">{map.title}</h3>
                        <div className="space-y-3">
                            <ImageUploader 
                                storagePath={analysis?.image}
                                onUpload={(path) => handleAnalysisChange(map.key as keyof Trade, 'image', path)}
                                onRemove={() => handleAnalysisChange(map.key as keyof Trade, 'image', undefined)}
                            />
                             <textarea
                                value={analysis?.notes || ''}
                                onChange={(e) => handleAnalysisChange(map.key as keyof Trade, 'notes', e.target.value)}
                                placeholder="Add notes for this timeframe..."
                                className={`${textInputClasses} h-24`}
                            />
                        </div>
                    </div>
                )
            })}
        </div>
    );

    return (
        <form onSubmit={handleSave} id="trade-form-wrapper">
            <div className="mb-6 border-b border-gray-700">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    {['Details', 'Analysis'].map(tab => (
                        <button
                            key={tab}
                            type="button"
                            onClick={() => setActiveTab(tab)}
                            className={`${
                                activeTab === tab
                                    ? 'border-blue-500 text-blue-400'
                                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'
                            } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>
            </div>
            
            <div className="min-h-[400px]">
                {activeTab === 'Details' && renderDetails()}
                {activeTab === 'Analysis' && renderAnalysis()}
            </div>

            <div className="flex justify-end gap-4 pt-6 mt-6 border-t border-gray-700/50">
                <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{tradeToEdit ? 'Update Trade' : 'Save Trade'}</button>
            </div>
        </form>
    );
};

export default TradeForm;
