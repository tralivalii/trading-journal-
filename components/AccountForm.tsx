import React, { useState } from 'react';
import { Account, Currency } from '../types';

// A reusable form field component for consistency.
const FormField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div>
        <label className="block text-sm text-[#8A91A8] uppercase tracking-wider mb-2">{label}</label>
        {children}
    </div>
);

// Shared styles for form controls.
const baseControlClasses = "w-full bg-[#1A1D26] border border-gray-600 rounded-md text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors";
const textInputClasses = `${baseControlClasses} px-3 py-2`;
const numberInputClasses = `${textInputClasses} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;
const selectClasses = `${textInputClasses} pl-3 pr-10 py-2 appearance-none bg-no-repeat bg-right [background-position-x:calc(100%-0.75rem)] [background-image:url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3e%3cpath stroke='%239ca3af' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m8 9 4 4 4-4M8 15l4-4 4 4'/%3e%3c/svg%3e")]`;

const AccountForm: React.FC<{ onSave: (data: Omit<Account, 'id'>) => void; onCancel: () => void; accountToEdit: Account | null }> = ({ onSave, onCancel, accountToEdit }) => {
    const [name, setName] = useState(accountToEdit?.name || '');
    const [initialBalance, setInitialBalance] = useState(accountToEdit?.initialBalance || 10000);
    const [currency, setCurrency] = useState(accountToEdit?.currency || Currency.USD);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || initialBalance <= 0) {
            alert("Please provide a valid name and initial balance.");
            return;
        }
        onSave({ name: name.trim(), initialBalance, currency });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Account Name">
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={textInputClasses} placeholder="e.g., Main Account" />
            </FormField>
            <FormField label="Initial Balance">
                <input type="number" value={initialBalance} onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)} required className={numberInputClasses} />
            </FormField>
             <FormField label="Currency">
                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={selectClasses}>
                    {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </FormField>
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{accountToEdit ? 'Update' : 'Create Account'}</button>
            </div>
        </form>
    );
};

export default AccountForm;
