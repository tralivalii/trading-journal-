import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Trade, Account, Direction, Result, Analysis } from '../types';
import { useAppContext } from '../services/appState';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';
import CustomSelect from './ui/CustomSelect';

// --- PROPS & STATE ---

interface TradeFormProps {
  onSave: (tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => void;
  onClose: () => void;
  tradeToEdit: Trade | null;
  accounts: Account[];
}

type TradeFormData = Omit<Trade, 'pnl' | 'riskAmount'>;

// --- STYLES & HELPERS ---

const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const selectClasses = `${textInputClasses} pl-3 pr-10 py-2 appearance-none bg-no-repeat bg-right [background-position-x:calc(100%-0.75rem)] [background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m8 9 4 4 4-4M8 15l4-4 4 4'/%3e%3c/svg%3e")]`;

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
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

// --- ANALYSIS SUB-COMPONENT ---

interface AnalysisSectionProps {
    analysis: Analysis;
    onAnalysisChange: (analysis: Analysis) => void;
    title: string;
}

const AnalysisSection: React.FC<AnalysisSectionProps> = ({ analysis, onAnalysisChange, title }) => {
    const { state: { currentUser }, dispatch } = useAppContext();
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onAnalysisChange({ ...analysis, notes: e.target.value });
    };

    const handleImageUpload = async (file: File) => {
        if (!currentUser) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'You must be logged in to upload images.', type: 'error' } });
            return;
        }
        setIsUploading(true);
        try {
            const storagePath = `${currentUser.id}/${crypto.randomUUID()}-${file.name}`;
            const { error: uploadError } = await supabase.storage
                .from('trade-attachments')
                .upload(storagePath, file);
            if (uploadError) throw uploadError;
            onAnalysisChange({ ...analysis, image: storagePath });
             dispatch({ type: 'SHOW_TOAST', payload: { message: 'Image uploaded.', type: 'success' } });
        } catch (error: any) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: `Image upload failed: ${error.message}`, type: 'error' } });
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
    };

    const handleRemoveImage = async () => {
        if (!analysis.image) return;

        const { error: storageError } = await supabase.storage.from('trade-attachments').remove([analysis.image]);
        if (storageError) {
             dispatch({ type: 'SHOW_TOAST', payload: { message: `Could not remove image: ${storageError.message}`, type: 'error' } });
        }
        onAnalysisChange({ ...analysis, image: undefined });
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">Chart Image</label>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" hidden />
                <div className="h-48 bg-[#1A1D26] border border-gray-600 rounded-md flex items-center justify-center p-2 text-center">
                    {isUploading ? (
                        <p className="text-gray-400">Uploading...</p>
                    ) : analysis.image ? (
                        <div className="relative group">
                            <p className="text-green-400 truncate text-sm">{analysis.image.split('/').pop()}</p>
                            <button type="button" onClick={handleRemoveImage} className="absolute -top-4 -right-4 bg-red-600 text-white rounded-full h-6 w-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">&times;</button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => fileInputRef.current?.click()} className="text-gray-400 hover:text-white">
                            Click to upload
                        </button>
                    )}
                </div>
            </div>
            <div>
                <FormField label="Notes">
                    <textarea 
                        value={analysis.notes || ''} 
                        onChange={handleNotesChange} 
                        className={textInputClasses + " h-48 resize-none"}
                        placeholder={`Notes for ${title}...`}
                    />
                </FormField>
            </div>
        </div>
    );
};


// --- MAIN FORM COMPONENT ---

const TradeForm: React.FC<TradeFormProps> = ({ onSave, onClose, tradeToEdit, accounts }) => {
    const { state } = useAppContext();
    const { userData } = state;
    
    const getInitialState = useCallback((): Omit<TradeFormData, 'riskAmount' | 'pnl'> => {
        const defaults = userData?.defaultSettings;
        const baseState = {
            id: crypto.randomUUID(), // for keying, not saved
            date: new Date().toISOString().substring(0, 16),
            accountId: accounts.some(a => a.id === defaults?.accountId) ? defaults!.accountId : accounts[0]?.id || '',
            pair: defaults?.pair || '',
            direction: Direction.Long,
            entry: defaults?.entry || '',
            risk: typeof defaults?.risk === 'number' ? defaults.risk : 1,
            rr: 2,
            result: Result.InProgress,
            commission: 0,
            stoploss: defaults?.stoploss || '',
            takeprofit: defaults?.takeprofit || '',
            entryPrice: undefined,
            stoplossPrice: undefined,
            takeprofitPrice: undefined,
            closeType: '',
            analysisD1: { image: undefined, notes: '' },
            analysis1h: { image: undefined, notes: '' },
            analysis5m: { image: undefined, notes: '' },
            analysisResult: { image: undefined, notes: '' },
            aiAnalysis: '',
        };
        if (tradeToEdit) {
            return {
                ...baseState,
                ...tradeToEdit,
                date: new Date(tradeToEdit.date).toISOString().substring(0, 16),
            };
        }
        return baseState;
    }, [tradeToEdit, accounts, userData?.defaultSettings]);

    const [tradeData, setTradeData] = useState(getInitialState);
    const [activeTab, setActiveTab] = useState('D1');
    const [isDirty, setIsDirty] = useState(false);
    const initialStateRef = useRef(getInitialState());

    useEffect(() => {
        const initialState = getInitialState();
        setTradeData(initialState);
        initialStateRef.current = initialState;
    }, [tradeToEdit, getInitialState]);
    
    useEffect(() => {
        setIsDirty(JSON.stringify(tradeData) !== JSON.stringify(initialStateRef.current));
    }, [tradeData]);

    useEffect(() => {
        const wrapper = document.getElementById('trade-form-wrapper');
        const handleCloseRequest = () => {
            if (isDirty) {
                if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                    onClose();
                }
            } else {
                onClose();
            }
        };
        wrapper?.addEventListener('closeRequest', handleCloseRequest);
        return () => wrapper?.removeEventListener('closeRequest', handleCloseRequest);
    }, [isDirty, onClose]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        let finalValue: any = value;
        if (type === 'number' || name === 'risk' || name === 'rr' || name === 'commission') {
            finalValue = parseFloat(value) || 0;
        }
        if (name.includes('Price') && value === '') {
            finalValue = undefined;
        }
        setTradeData(prev => ({ ...prev, [name]: finalValue }));
    };

    const handleAnalysisChange = (fieldName: keyof TradeFormData, analysis: Analysis) => {
        setTradeData(prev => ({ ...prev, [fieldName]: analysis }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { ...saveData } = tradeData;
        onSave({ ...saveData, date: new Date(tradeData.date).toISOString() });
    };

    const timeframeMap = (userData?.analysisTimeframes || ['D1', '1h', '5m', 'Result']).reduce((acc, tf) => {
        const keyMap: Record<string, keyof TradeFormData> = {
            'D1': 'analysisD1',
            '1D': 'analysisD1',
            '1h': 'analysis1h',
            '5m': 'analysis5m',
            'Result': 'analysisResult',
        };
        const key = keyMap[tf] || `analysis${tf}`;
        acc[tf] = key as keyof TradeFormData;
        return acc;
    }, {} as Record<string, keyof TradeFormData>);
    
    const analysisTimeframes = Object.keys(timeframeMap);

    return (
        <div id="trade-form-wrapper">
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Core Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    <FormField label="Account" className="lg:col-span-1">
                        <select name="accountId" value={tradeData.accountId} onChange={handleChange} required className={selectClasses}>
                            {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Pair" className="lg:col-span-1">
                        <input list="pairs" name="pair" value={tradeData.pair} onChange={handleChange} required className={textInputClasses} />
                        <datalist id="pairs">
                            {userData?.pairs?.map(p => <option key={p} value={p} />)}
                        </datalist>
                    </FormField>
                    <FormField label="Date & Time" className="lg:col-span-1">
                        <input type="datetime-local" name="date" value={tradeData.date} onChange={handleChange} required className={textInputClasses} />
                    </FormField>
                    <FormField label="Direction" className="lg:col-span-1">
                         <select name="direction" value={tradeData.direction} onChange={handleChange} required className={`${selectClasses} ${tradeData.direction === Direction.Long ? 'text-green-400' : 'text-red-400'}`}>
                            <option value={Direction.Long}>Long</option>
                            <option value={Direction.Short}>Short</option>
                        </select>
                    </FormField>
                     <FormField label="Result" className="lg:col-span-1">
                        <CustomSelect
                            value={tradeData.result}
                            options={Object.values(Result)}
                            onChange={(value) => setTradeData(prev => ({ ...prev, result: value }))}
                            getDisplayClasses={getResultClasses}
                        />
                    </FormField>
                </div>
                
                {/* Risk & Types */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                     <FormField label="Risk (%)">
                        <select name="risk" value={tradeData.risk} onChange={handleChange} required className={selectClasses}>
                            {userData?.risks?.map(r => <option key={r} value={r}>{r}%</option>)}
                        </select>
                    </FormField>
                    <FormField label="R:R Ratio">
                        <input type="number" step="0.1" name="rr" value={tradeData.rr} onChange={handleChange} required className={numberInputClasses} />
                    </FormField>
                    <FormField label="Entry Type">
                        <input list="entries" name="entry" value={tradeData.entry} onChange={handleChange} className={textInputClasses} />
                        <datalist id="entries">{userData?.entries?.map(e => <option key={e} value={e} />)}</datalist>
                    </FormField>
                    <FormField label="SL Type">
                        <input list="stoplosses" name="stoploss" value={tradeData.stoploss} onChange={handleChange} className={textInputClasses} />
                        <datalist id="stoplosses">{userData?.stoplosses?.map(s => <option key={s} value={s} />)}</datalist>
                    </FormField>
                    <FormField label="TP Type">
                        <input list="takeprofits" name="takeprofit" value={tradeData.takeprofit} onChange={handleChange} className={textInputClasses} />
                        <datalist id="takeprofits">{userData?.takeprofits?.map(t => <option key={t} value={t} />)}</datalist>
                    </FormField>
                </div>
                
                {/* Price Levels & Close */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                     <FormField label="Entry Price">
                        <input type="number" step="any" name="entryPrice" value={tradeData.entryPrice || ''} onChange={handleChange} className={numberInputClasses} />
                    </FormField>
                    <FormField label="Stoploss Price">
                        <input type="number" step="any" name="stoplossPrice" value={tradeData.stoplossPrice || ''} onChange={handleChange} className={numberInputClasses} />
                    </FormField>
                    <FormField label="Takeprofit Price">
                        <input type="number" step="any" name="takeprofitPrice" value={tradeData.takeprofitPrice || ''} onChange={handleChange} className={numberInputClasses} />
                    </FormField>
                    <FormField label="Commission ($)">
                        <input type="number" step="0.01" name="commission" value={tradeData.commission || ''} onChange={handleChange} className={numberInputClasses} />
                    </FormField>
                    <FormField label="Close Type">
                        <input list="closeTypes" name="closeType" value={tradeData.closeType || ''} onChange={handleChange} className={textInputClasses} />
                        <datalist id="closeTypes">{userData?.closeTypes?.map(c => <option key={c} value={c} />)}</datalist>
                    </FormField>
                </div>

                {/* Analysis Section */}
                <div>
                    <h3 className="text-xl font-semibold text-white mb-4">Analysis</h3>
                    <div className="mb-4 border-b border-gray-700/50">
                        <nav className="-mb-px flex space-x-4" aria-label="Tabs">
                            {analysisTimeframes.map(tab => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => setActiveTab(tab)}
                                    className={`${activeTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'} whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors focus:outline-none`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <div>
                        {analysisTimeframes.map(tab => {
                            const fieldName = timeframeMap[tab] as keyof TradeFormData;
                            if (!fieldName) return null;
                            return (
                                <div key={tab} className={activeTab === tab ? 'block' : 'hidden'}>
                                    <AnalysisSection
                                        title={tab}
                                        analysis={tradeData[fieldName] as Analysis}
                                        onAnalysisChange={(newAnalysis) => handleAnalysisChange(fieldName, newAnalysis)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 pt-4">
                    <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                    <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{tradeToEdit ? 'Update Trade' : 'Save Trade'}</button>
                </div>
            </form>
        </div>
    );
};

export default TradeForm;
