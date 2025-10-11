import React, { useState, useMemo } from 'react';
import { useAppContext, saveSettingsAction, saveAccountAction, deleteAccountAction } from '../services/appState';
import { Account, UserData } from '../types';
import Modal from './ui/Modal';
import { ICONS } from '../constants';
import AccountForm from './AccountForm';

interface SettingsViewProps {
    onOpenAccountForm: (account: Account | null) => void;
}

const DataCard: React.FC<{ title: string, children: React.ReactNode, action?: React.ReactNode }> = ({ title, children, action }) => (
    <div className="bg-[#232733] rounded-lg border border-gray-700/50 flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-700/50">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            {action && <div>{action}</div>}
        </div>
        <div className="p-4">{children}</div>
    </div>
);

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

const EditableTagList: React.FC<{
    title: string;
    items: (string | number)[];
    onSave: (newItems: (string | number)[]) => void;
    inputType?: 'text' | 'number';
    placeholder?: string;
}> = ({ title, items, onSave, inputType = 'text', placeholder }) => {
    const [newItem, setNewItem] = useState('');

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedItem = newItem.toString().trim();
        if (!trimmedItem) return;
        const valueToAdd = inputType === 'number' ? parseFloat(trimmedItem) : trimmedItem;
        if (items.map(String).includes(String(valueToAdd))) return;
        onSave([...items, valueToAdd]);
        setNewItem('');
    };

    const handleRemoveItem = (itemToRemove: string | number) => {
        onSave(items.filter(item => item !== itemToRemove));
    };

    return (
        <div>
            <h3 className="text-base font-semibold text-[#8A91A8] mb-2">{title}</h3>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[34px]">
                {(items || []).map((item, index) => (
                    <div key={index} className="flex items-center bg-gray-600 text-white text-sm font-medium pl-3 pr-2 py-1 rounded-full">
                        <span>{item}</span>
                        <button onClick={() => handleRemoveItem(item)} className="ml-2 text-gray-400 hover:text-white">&times;</button>
                    </div>
                ))}
            </div>
            <form onSubmit={handleAddItem} className="flex gap-2">
                <input
                    type={inputType}
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    className={inputType === 'number' ? numberInputClasses : textInputClasses + " flex-grow"}
                    placeholder={placeholder || `Add new ${title.toLowerCase().slice(0, -1)}...`}
                />
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">Add</button>
            </form>
        </div>
    );
};

const SettingsView: React.FC<SettingsViewProps> = ({ onOpenAccountForm }) => {
    const { state, dispatch } = useAppContext();
    const { userData, isGuest } = state;
    const { accounts, pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings, trades, analysisTimeframes } = userData!;

    const [accountToDelete, setAccountToDelete] = useState<Account | null>(null);
    const [currentDefaults, setCurrentDefaults] = useState(defaultSettings);
    
    const handleSaveSettings = (field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>, value: any) => {
       saveSettingsAction(dispatch, state, { [field]: value });
    };

    const handleDefaultSettingsChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentDefaults(prev => ({
            ...prev,
            [name]: name === 'risk' ? Number(value) : value,
        }));
    };

    const handleSaveDefaults = () => {
        handleSaveSettings('defaultSettings', currentDefaults);
    };

    const handleToggleArchiveAccount = async (account: Account) => {
        if (isGuest) return;
        const updatedAccount = { ...account, isArchived: !account.isArchived };
        await saveAccountAction(dispatch, state, updatedAccount, true);
    };

    const handleConfirmDeleteAccount = async () => {
        if (!accountToDelete || isGuest) return;
        await deleteAccountAction(dispatch, state, accountToDelete.id);
        setAccountToDelete(null); 
    };
    
    const sortedAccounts = useMemo(() => 
        [...accounts].sort((a, b) => (a.isArchived ? 1 : -1) - (b.isArchived ? 1 : -1) || a.name.localeCompare(b.name)), 
    [accounts]);

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-8">
                    <DataCard 
                        title="Trading Accounts" 
                        action={<button onClick={() => onOpenAccountForm(null)} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">Add Account</button>}
                    >
                        <div className="space-y-3">
                            {sortedAccounts.map(acc => (
                                <div key={acc.id} className={`flex justify-between items-center p-3 rounded-lg border border-gray-700/80 ${acc.isArchived ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-900/50'}`}>
                                    <div>
                                        <p className={`font-semibold ${!acc.isArchived && 'text-white'}`}>{acc.name}</p>
                                        <p className="text-xs">Balance: {acc.initialBalance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => onOpenAccountForm(acc)} className="px-3 py-1 text-xs font-medium rounded-full transition-colors bg-blue-600/20 text-blue-300 hover:bg-blue-600/40" disabled={acc.isArchived}>Edit</button>
                                        <button onClick={() => handleToggleArchiveAccount(acc)} className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${acc.isArchived ? 'bg-green-600/20 text-green-300' : 'bg-yellow-600/20 text-yellow-300'}`}>{acc.isArchived ? 'Unarchive' : 'Archive'}</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </DataCard>

                    <DataCard title="Default Trade Settings">
                        <div className="space-y-4">
                            <FormField label="Default Account">
                                <select name="accountId" value={currentDefaults.accountId} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    {accounts.filter(a => !a.isArchived).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </FormField>
                             <FormField label="Default SL Type">
                                <select name="stoploss" value={currentDefaults.stoploss} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    {stoplosses.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </FormField>
                             <FormField label="Default TP Type">
                                <select name="takeprofit" value={currentDefaults.takeprofit} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    {takeprofits.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </FormField>
                            <div className="text-right pt-2">
                                <button onClick={handleSaveDefaults} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">Save Defaults</button>
                            </div>
                        </div>
                    </DataCard>
                </div>

                <div className="space-y-8">
                    <DataCard title="Journal Options">
                        <div className="space-y-6">
                            <EditableTagList title="Pairs" items={pairs} onSave={(newItems) => handleSaveSettings('pairs', newItems)} />
                            <EditableTagList title="Entry Types" items={entries} onSave={(newItems) => handleSaveSettings('entries', newItems)} />
                            <EditableTagList title="Risk Presets (%)" items={risks} onSave={(newItems) => handleSaveSettings('risks', newItems.map(Number).sort((a,b) => a-b))} inputType="number" />
                            <EditableTagList title="SL Types" items={stoplosses} onSave={(newItems) => handleSaveSettings('stoplosses', newItems)} />
                            <EditableTagList title="TP Types" items={takeprofits} onSave={(newItems) => handleSaveSettings('takeprofits', newItems)} />
                            <EditableTagList title="Close Types" items={closeTypes} onSave={(newItems) => handleSaveSettings('closeTypes', newItems)} />
                             <EditableTagList title="Analysis Timeframes" items={analysisTimeframes} onSave={(newItems) => handleSaveSettings('analysisTimeframes', newItems)} placeholder="Add new timeframe..."/>
                        </div>
                    </DataCard>
                </div>
            </div>
            
             {accountToDelete && (
                <Modal isOpen={!!accountToDelete} onClose={() => setAccountToDelete(null)} title="Confirm Account Deletion">
                    <p>Are you sure you want to delete "{accountToDelete.name}"?</p>
                    <div className="flex justify-end gap-4 mt-4">
                        <button onClick={() => setAccountToDelete(null)}>Cancel</button>
                        <button onClick={handleConfirmDeleteAccount}>Delete</button>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default SettingsView;