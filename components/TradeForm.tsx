// FIX: Provided full content for missing TradeForm.tsx file.
import React, { useState, useEffect, useMemo } from 'react';
import { Trade, Result, Account } from '../types';
import { useAppContext } from '../services/appState';
import CustomSelect from './ui/CustomSelect';

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

const FormField: React.FC<{ label: string; children: React.ReactNode; className?: string }> = ({ label, children, className }) => (
    <div className={className}>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
    </div>
);

const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const textareaClasses = `${textInputClasses} min-h-[120px]`;

const TradeForm: React.FC<{ onSave: (trade: Omit<Trade, 'id' | 'userId'>, id?: string) => void; onCancel: () => void; tradeToEdit: Trade | null; }> = ({ onSave, onCancel, tradeToEdit }) => {
    const { state } = useAppContext();
    const { accounts } = state.userData!;
    const activeAccounts = useMemo(() => accounts.filter(acc => !acc.isArchived), [accounts]);
    
    const [trade, setTrade] = useState<Omit<Trade, 'id' | 'userId'>>(() => {
        const defaults = {
            date: new Date().toISOString().slice(0, 16),
            pair: '',
            direction: 'Long' as 'Long' | 'Short',
            result: Result.InProgress,
            rr: 1,
            pnl: 0,
            risk: state.userData?.settings.riskPerTrade || 1,
            accountId: activeAccounts[0]?.id || '',
            entryPrice: 0,
            stopLoss: 0,
            takeProfit: 0,
            setup: '',
            execution: '',
            outcome: '',
            screenshotBeforeKey: null,
            screenshotAfterKey: null,
        };
        return tradeToEdit ? { ...tradeToEdit } : defaults;
    });

    useEffect(() => {
        if (trade.entryPrice && trade.stopLoss && trade.takeProfit) {
            const riskAmount = Math.abs(trade.entryPrice - trade.stopLoss);
            const rewardAmount = Math.abs(trade.takeProfit - trade.entryPrice);
            if (riskAmount > 0) {
                const newRR = rewardAmount / riskAmount;
                setTrade(t => ({...t, rr: newRR}));
            }
        }
    }, [trade.entryPrice, trade.stopLoss, trade.takeProfit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setTrade(prev => ({ ...prev, [name]: (e.target.type === 'number' && value) ? parseFloat(value) : value }));
    };
    
    const handleResultChange = (newResult: Result) => {
        setTrade(prev => ({ ...prev, result: newResult }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(trade, tradeToEdit?.id);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField label="Account" className="md:col-span-2">
                    <select name="accountId" value={trade.accountId} onChange={handleChange} className={`${baseControlClasses} px-3 py-2`} required>
                        {activeAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                    </select>
                </FormField>
                <FormField label="Date">
                    <input type="datetime-local" name="date" value={trade.date} onChange={handleChange} className={textInputClasses} required />
                </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormField label="Pair" className="md:col-span-2">
                    <input type="text" name="pair" value={trade.pair} onChange={handleChange} placeholder="e.g., EURUSD" className={textInputClasses} required />
                </FormField>
                <FormField label="Direction">
                    <select name="direction" value={trade.direction} onChange={handleChange} className={`${baseControlClasses} px-3 py-2`}>
                        <option value="Long">Long</option>
                        <option value="Short">Short</option>
                    </select>
                </FormField>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <FormField label="Entry Price">
                    <input type="number" step="any" name="entryPrice" value={trade.entryPrice} onChange={handleChange} className={numberInputClasses} />
                </FormField>
                <FormField label="Stop Loss">
                    <input type="number" step="any" name="stopLoss" value={trade.stopLoss} onChange={handleChange} className={numberInputClasses} />
                </FormField>
                <FormField label="Take Profit">
                    <input type="number" step="any" name="takeProfit" value={trade.takeProfit} onChange={handleChange} className={numberInputClasses} />
                </FormField>
            </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-6 items-end">
                <FormField label="R:R Ratio">
                    <input type="number" step="any" name="rr" value={trade.rr} onChange={handleChange} className={numberInputClasses} required />
                </FormField>
                <FormField label="Risk %">
                    <input type="number" step="any" name="risk" value={trade.risk} onChange={handleChange} className={numberInputClasses} required />
                </FormField>
                <FormField label="PnL">
                    <input type="number" step="any" name="pnl" value={trade.pnl} onChange={handleChange} className={numberInputClasses} required />
                </FormField>
                <FormField label="Result">
                    <CustomSelect<Result>
                        value={trade.result}
                        options={Object.values(Result)}
                        onChange={handleResultChange}
                        getDisplayClasses={getResultClasses}
                    />
                </FormField>
            </div>
            
            <div className="space-y-4">
                <FormField label="Setup"><textarea name="setup" value={trade.setup} onChange={handleChange} placeholder="Why did you take this trade?" className={textareaClasses} /></FormField>
                <FormField label="Execution"><textarea name="execution" value={trade.execution} onChange={handleChange} placeholder="How was the entry and trade management?" className={textareaClasses} /></FormField>
                <FormField label="Outcome"><textarea name="outcome" value={trade.outcome} onChange={handleChange} placeholder="What was the result and what did you learn?" className={textareaClasses} /></FormField>
            </div>

            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{tradeToEdit ? 'Update Trade' : 'Add Trade'}</button>
            </div>
        </form>
    );
};

export default TradeForm;
