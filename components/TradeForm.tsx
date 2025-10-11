
import React, { useState, useEffect, useRef } from 'react';
import { Trade, Account, Direction, Result, Analysis } from '../types';
import { useAppContext, saveTradeAction } from '../services/appState';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';

interface TradeFormProps {
    tradeToEdit?: Trade | null;
    onSave: () => void;
    onCancel: () => void;
}

// Reusable components from DataView.tsx
const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
    </div>
);

const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const selectClasses = `${textInputClasses} pl-3 pr-10 py-2 appearance-none bg-no-repeat bg-right [background-position-x:calc(100%-0.75rem)] [background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m8 9 4 4 4-4M8 15l4-4 4 4'/%3e%3c/svg%3e")]`;
const textareaClasses = `${textInputClasses} min-h-[80px]`;

const AnalysisInputSection: React.FC<{
    title: string;
    analysis: Analysis;
    onAnalysisChange: (analysis: Analysis) => void;
    userId: string | undefined;
    isGuest: boolean;
    onToast: (message: string, type: 'success' | 'error') => void;
}> = ({ title, analysis, onAnalysisChange, userId, isGuest, onToast }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);

    const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onAnalysisChange({ ...analysis, notes: e.target.value });
    };

    const handleImageUpload = async (file: File) => {
        if (isGuest || !userId) {
            onToast("Image uploads are disabled in guest mode.", "error");
            return;
        }
        setIsUploading(true);
        const fileExtension = file.name.split('.').pop();
        const imageKey = `${crypto.randomUUID()}.${fileExtension}`;
        
        try {
            const { error: uploadError } = await supabase.storage
                .from('screenshots')
                .upload(`${userId}/${imageKey}`, file, {
                    cacheControl: '3600',
                    upsert: false,
                    contentType: file.type,
                });
            
            if (uploadError) throw uploadError;

            onAnalysisChange({ ...analysis, image: imageKey });
            onToast("Image uploaded successfully.", "success");
        } catch (error: any) {
            console.error("Upload error:", error);
            onToast(error.message || "Failed to upload image.", "error");
        } finally {
            setIsUploading(false);
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleImageUpload(file);
        }
    };
    
    return (
        <div className="space-y-2">
            <h4 className="text-base font-semibold text-white">{title}</h4>
            <textarea
                value={analysis.notes || ''}
                onChange={handleNotesChange}
                placeholder={`Notes for ${title}...`}
                className={textareaClasses}
            />
            <div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" hidden />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors disabled:bg-gray-700 disabled:cursor-wait">
                    {isUploading ? 'Uploading...' : (analysis.image ? 'Replace Image' : 'Upload Image')}
                </button>
                {analysis.image && <span className="ml-3 text-xs text-gray-400 truncate">Image uploaded.</span>}
            </div>
        </div>
    );
};


const TradeForm: React.FC<TradeFormProps> = ({ tradeToEdit, onSave, onCancel }) => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser, isGuest } = state;
    const { accounts, pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings, analysisTimeframes } = userData!;
    const isEditing = !!tradeToEdit;

    const [formState, setFormState] = useState<Omit<Trade, 'id' | 'pnl' | 'riskAmount'>>(() => {
        const defaults = isEditing ? tradeToEdit : {
            date: new Date().toISOString().substring(0, 16),
            accountId: defaultSettings.accountId,
            pair: defaultSettings.pair,
            direction: Direction.Long,
            result: Result.InProgress,
            risk: Number(defaultSettings.risk) || 1,
            rr: 2,
            entry: defaultSettings.entry,
            stoploss: defaultSettings.stoploss,
            takeprofit: defaultSettings.takeprofit,
            analysisD1: { notes: '', image: undefined },
            analysis1h: { notes: '', image: undefined },
            analysis5m: { notes: '', image: undefined },
            analysisResult: { notes: '', image: undefined },
        };
        return defaults as Omit<Trade, 'id' | 'pnl' | 'riskAmount'>;
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormState(prev => ({
            ...prev,
            [name]: e.target.type === 'number' ? parseFloat(value) || 0 : value,
        }));
    };
    
    const handleAnalysisChange = (fieldName: keyof Trade, analysis: Analysis) => {
        setFormState(prev => ({ ...prev, [fieldName]: analysis }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await saveTradeAction(dispatch, state, { ...formState, id: tradeToEdit?.id }, isEditing);
            onSave();
        } catch (error: any) {
            console.error("Failed to save trade:", error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: error.message, type: 'error' } });
        }
    };
    
    const showToast = (message: string, type: 'success' | 'error') => {
        dispatch({ type: 'SHOW_TOAST', payload: { message, type } });
    };
    
    const timeframeMap: Record<string, { key: keyof Trade }> = {
        '1D': { key: 'analysisD1' },
        '1h': { key: 'analysis1h' },
        '5m': { key: 'analysis5m' },
        'Result': { key: 'analysisResult' },
    };
    
    const activeTimeframes = (analysisTimeframes || []).filter(tf => timeframeMap[tf]);

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <FormField label="Date & Time">
                    <input type="datetime-local" name="date" value={formState.date?.substring(0, 16) || ''} onChange={handleInputChange} required className={textInputClasses} />
                </FormField>
                <FormField label="Account">
                    <select name="accountId" value={formState.accountId} onChange={handleInputChange} required className={selectClasses}>
                        <option value="" disabled>Select Account</option>
                        {accounts.filter(a => !a.isArchived).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                </FormField>
                <FormField label="Pair">
                    <select name="pair" value={formState.pair} onChange={handleInputChange} required className={selectClasses}>
                        <option value="" disabled>Select Pair</option>
                        {pairs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </FormField>
                <FormField label="Direction">
                     <select name="direction" value={formState.direction} onChange={handleInputChange} required className={selectClasses}>
                        {Object.values(Direction).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                </FormField>
                 <FormField label="Entry Type">
                    <select name="entry" value={formState.entry} onChange={handleInputChange} className={selectClasses}>
                         <option value="">Select Entry Type</option>
                        {entries.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                </FormField>
                <FormField label="Result">
                    <select name="result" value={formState.result} onChange={handleInputChange} required className={selectClasses}>
                        {Object.values(Result).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </FormField>
                <FormField label="Risk (%)">
                    <select name="risk" value={String(formState.risk)} onChange={handleInputChange} required className={selectClasses}>
                        {risks.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                </FormField>
                 <FormField label="R:R Ratio">
                    <input type="number" name="rr" value={formState.rr} onChange={handleInputChange} required step="0.1" min="0" className={numberInputClasses} />
                </FormField>
                <FormField label="Stoploss Type">
                    <select name="stoploss" value={formState.stoploss} onChange={handleInputChange} className={selectClasses}>
                         <option value="">Select SL Type</option>
                        {stoplosses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </FormField>
                <FormField label="Takeprofit Type">
                    <select name="takeprofit" value={formState.takeprofit} onChange={handleInputChange} className={selectClasses}>
                         <option value="">Select TP Type</option>
                        {takeprofits.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </FormField>
                 <FormField label="Commission ($)">
                    <input type="number" name="commission" value={formState.commission || ''} onChange={handleInputChange} step="0.01" min="0" className={numberInputClasses} placeholder="Optional"/>
                </FormField>
                <FormField label="Close Type">
                    <select name="closeType" value={formState.closeType || ''} onChange={handleInputChange} className={selectClasses}>
                         <option value="">Select Close Type</option>
                        {closeTypes.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </FormField>
            </div>
            
            <div className="pt-4 border-t border-gray-700/50">
                <h3 className="text-xl font-semibold text-white mb-4">Trade Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeTimeframes.map(tf => (
                         <AnalysisInputSection
                            key={tf}
                            title={`${tf} Analysis`}
                            analysis={formState[timeframeMap[tf].key as keyof typeof formState] as Analysis}
                            onAnalysisChange={(newAnalysis) => handleAnalysisChange(timeframeMap[tf].key, newAnalysis)}
                            userId={currentUser?.id}
                            isGuest={isGuest}
                            onToast={showToast}
                        />
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{isEditing ? 'Update Trade' : 'Add Trade'}</button>
            </div>
        </form>
    );
};

export default TradeForm;
