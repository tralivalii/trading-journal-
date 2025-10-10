import React, { useState, useMemo } from 'react';
import { useAppContext } from '../services/appState';
import { Account, Currency, UserData, DefaultSettings } from '../types';
import Modal from './ui/Modal';
import { supabase } from '../services/supabase';
import { ICONS } from '../constants';
import AccountForm from './AccountForm';

interface DataViewProps {
    onInitiateDeleteAccount: () => void;
    showToast: (message: string, type?: 'success' | 'error') => void;
}

// --- Local UI Components ---

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
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');

    const handleAddItem = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedItem = newItem.toString().trim();
        if (!trimmedItem) return;

        const valueToAdd = inputType === 'number' ? parseFloat(trimmedItem) : trimmedItem;
        if (inputType === 'number' && isNaN(valueToAdd as number)) return;
        if (items.map(String).includes(String(valueToAdd))) {
             setNewItem('');
             return;
        }

        const updatedItems = [...items, valueToAdd];
        onSave(updatedItems);
        setNewItem('');
    };

    const handleRemoveItem = (itemToRemove: string | number) => {
        const updatedItems = items.filter(item => item !== itemToRemove);
        onSave(updatedItems);
    };

    const handleEditStart = (index: number, value: string | number) => {
        setEditingIndex(index);
        setEditingValue(String(value));
    };

    const handleEditSave = () => {
        if (editingIndex === null) return;

        const trimmedValue = editingValue.trim();
        const originalValue = items[editingIndex];

        if (trimmedValue === '' || String(originalValue) === trimmedValue) {
            setEditingIndex(null);
            return;
        }

        const finalValue = inputType === 'number' ? parseFloat(trimmedValue) : trimmedValue;
        
        if (items.filter((_, i) => i !== editingIndex).map(String).includes(String(finalValue))) {
            setEditingIndex(null);
            return;
        }

        const updatedItems = items.map((item, index) => index === editingIndex ? finalValue : item);
        onSave(updatedItems);
        setEditingIndex(null);
    };
    
    const handleEditCancel = () => {
        setEditingIndex(null);
    };

    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleEditSave();
        } else if (e.key === 'Escape') {
            handleEditCancel();
        }
    };

    return (
        <div>
            <h3 className="text-base font-semibold text-[#8A91A8] mb-2">{title}</h3>
            <div className="flex flex-wrap gap-2 mb-3 min-h-[34px] items-center">
                {items.map((item, index) => (
                    <div key={index}>
                        {editingIndex === index ? (
                            <div className="flex items-center bg-gray-700 text-white text-sm font-medium pl-3 pr-2 py-1 rounded-full ring-2 ring-blue-500 min-w-16 justify-center">
                                <input
                                    type={inputType}
                                    value={editingValue}
                                    onChange={(e) => setEditingValue(e.target.value)}
                                    onKeyDown={handleEditKeyDown}
                                    className="bg-transparent focus:outline-none w-auto text-sm p-0"
                                    style={{ width: `${Math.max(String(editingValue).length, 5)}ch` }}
                                    autoFocus
                                />
                                <button 
                                    onClick={handleEditSave} 
                                    className="ml-2 text-green-400 hover:text-green-300 transition-colors"
                                    aria-label="Save changes"
                                >
                                    <span className="w-5 h-5 block">{ICONS.save}</span>
                                </button>
                            </div>
                        ) : (
                            <div
                                tabIndex={0}
                                className="group relative bg-gray-600 text-white text-sm font-medium px-3 py-1 rounded-full cursor-pointer transition-colors min-w-16 flex justify-center items-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                                onClick={() => handleEditStart(index, item)}
                            >
                                {/* The actual text, always present for sizing */}
                                <span className="whitespace-nowrap">{item}</span>

                                {/* The hover overlay, covers the whole tag */}
                                <div
                                    className="absolute inset-0 flex items-center justify-center gap-2 rounded-full bg-gray-500/90 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity"
                                >
                                    <span className="text-xs font-semibold uppercase tracking-wider">Edit</span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleRemoveItem(item); }}
                                        className="text-white hover:text-red-400 transition-colors"
                                        aria-label={`Remove ${item}`}
                                    >
                                        <span className="text-lg leading-none select-none font-bold">&times;</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
                {items.length === 0 && <p className="text-sm text-gray-500 italic">No items added yet.</p>}
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


// --- Main DataView Component ---

const DataView: React.FC<DataViewProps> = ({ onInitiateDeleteAccount, showToast }) => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser, isGuest } = state;
    const { accounts, pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings } = userData!;

    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
    const [currentDefaults, setCurrentDefaults] = useState(defaultSettings);

    const handleOpenAccountModal = (account: Account | null = null) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        setAccountToEdit(account);
        setIsAccountModalOpen(true);
    };

    const handleSaveAccount = async (accountData: Omit<Account, 'id'>) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            setIsAccountModalOpen(false);
            return;
        }
        if (!currentUser) return;
        
        try {
            // Map to snake_case for DB
            const dbPayload = {
                name: accountData.name,
                initial_balance: accountData.initialBalance,
                currency: accountData.currency,
            };

            let response;
            if (accountToEdit) {
                response = await supabase
                    .from('accounts')
                    .update(dbPayload)
                    .eq('id', accountToEdit.id)
                    .select()
                    .single();
            } else {
                response = await supabase
                    .from('accounts')
                    .insert({ ...dbPayload, user_id: currentUser.id })
                    .select()
                    .single();
            }

            const { data: savedData, error } = response;
            if (error) throw error;
            
            // Map from snake_case from DB to camelCase for app state
            const appAccount: Account = {
                id: savedData.id,
                name: savedData.name,
                initialBalance: savedData.initial_balance,
                currency: savedData.currency,
                isArchived: savedData.is_archived
            };

            if (accountToEdit) {
                const updatedAccounts = accounts.map(a => a.id === appAccount.id ? appAccount : a);
                dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
                showToast('Account updated successfully.', 'success');
            } else {
                dispatch({ type: 'UPDATE_ACCOUNTS', payload: [...accounts, appAccount] });
                showToast('Account added successfully.', 'success');
            }
            
            setIsAccountModalOpen(false);
            setAccountToEdit(null);
        } catch (error: any) {
            console.error('Failed to save account:', error);
            showToast(`Failed to save account: ${error.message}`, 'error');
        }
    };
    
    const handleToggleArchiveAccount = async (account: Account) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        if (!currentUser) return;

        try {
            const { data, error } = await supabase
                .from('accounts')
                .update({ is_archived: !account.isArchived })
                .eq('id', account.id)
                .select()
                .single();

            if (error) throw error;
            const updatedAccounts = accounts.map(a => a.id === data.id ? {...a, isArchived: data.is_archived} : a);
            dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
            showToast(`Account ${data.is_archived ? 'archived' : 'unarchived'}.`, 'success');
        } catch (error) {
            console.error('Failed to update account status:', error);
            showToast('Failed to update account status.', 'error');
        }
    };

    const handleSaveSettings = async (field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>, value: any) => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        if (!currentUser || !userData) return;
        
        const allSettingsData = { pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings };
        const updatedData = { ...allSettingsData, [field]: value };

        const { error } = await supabase
            .from('user_data')
            .upsert({ user_id: currentUser.id, data: updatedData })
            .select();

        if (error) {
            showToast(`Error saving settings: ${error.message}`, 'error');
            console.error(error);
        } else {
            dispatch({ type: 'UPDATE_USER_DATA_FIELD', payload: { field, value }});
            const friendlyFieldName = (field as string).charAt(0).toUpperCase() + (field as string).slice(1);
            showToast(`${friendlyFieldName} updated successfully.`, 'success');
        }
    };

    const handleDefaultSettingsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setCurrentDefaults(prev => ({
            ...prev,
            [name]: name === 'risk' ? Number(value) : value,
        }));
    };

    const handleSaveDefaults = () => {
        handleSaveSettings('defaultSettings', currentDefaults);
    };

    const sortedAccounts = useMemo(() => 
        [...accounts].sort((a, b) => (a.isArchived ? 1 : -1) - (b.isArchived ? 1 : -1) || a.name.localeCompare(b.name)), 
    [accounts]);

    const handleInitiateDelete = () => {
        if (isGuest) {
            showToast("This feature is disabled in guest mode.", 'error');
            return;
        }
        onInitiateDeleteAccount();
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Data & Settings</h1>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Column */}
                <div className="space-y-8">
                    <DataCard 
                        title="Trading Accounts" 
                        action={<button onClick={() => handleOpenAccountModal()} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">Add Account</button>}
                    >
                        <div className="space-y-3">
                            {sortedAccounts.length > 0 ? sortedAccounts.map(acc => (
                                <div key={acc.id} className={`flex justify-between items-center p-3 rounded-lg border border-gray-700/80 ${acc.isArchived ? 'bg-gray-800/50 text-gray-500' : 'bg-gray-900/50'}`}>
                                    <div>
                                        <p className={`font-semibold ${!acc.isArchived && 'text-white'}`}>{acc.name}</p>
                                        <p className="text-xs">Initial Balance: {acc.initialBalance.toLocaleString('en-US', { style: 'currency', currency: acc.currency || 'USD' })}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => handleOpenAccountModal(acc)} 
                                            className="px-3 py-1 text-xs font-medium rounded-full transition-colors bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed" 
                                            disabled={acc.isArchived}
                                        >
                                            Edit
                                        </button>
                                        <button 
                                            onClick={() => handleToggleArchiveAccount(acc)} 
                                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                                acc.isArchived 
                                                    ? 'bg-green-600/20 text-green-300 hover:bg-green-600/40' 
                                                    : 'bg-yellow-600/20 text-yellow-300 hover:bg-yellow-600/40'
                                            }`}
                                        >
                                            {acc.isArchived ? 'Unarchive' : 'Archive'}
                                        </button>
                                    </div>
                                </div>
                            )) : <p className="text-center text-gray-500 py-4">No accounts created yet.</p>}
                        </div>
                    </DataCard>

                    <DataCard title="Default Trade Settings">
                        <div className="space-y-4">
                            <FormField label="Default Account">
                                <select name="accountId" value={currentDefaults.accountId} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    <option value="">None</option>
                                    {accounts.filter(a => !a.isArchived).map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </FormField>
                             <FormField label="Default Pair">
                                <select name="pair" value={currentDefaults.pair} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    <option value="">None</option>
                                    {pairs.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </FormField>
                             <FormField label="Default Entry Type">
                                <select name="entry" value={currentDefaults.entry} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    <option value="">None</option>
                                    {entries.map(e => <option key={e} value={e}>{e}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Default Risk (%)">
                                <select name="risk" value={currentDefaults.risk} onChange={handleDefaultSettingsChange} className={selectClasses}>
                                    {risks.map(r => <option key={r} value={r}>{r}</option>)}
                                </select>
                            </FormField>
                            <div className="text-right pt-2">
                                <button onClick={handleSaveDefaults} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-sm font-medium">Save Defaults</button>
                            </div>
                        </div>
                    </DataCard>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                    <DataCard title="Journal Options">
                        <div className="space-y-6">
                            <EditableTagList title="Pairs" items={pairs} onSave={(newItems) => handleSaveSettings('pairs', newItems)} />
                            <EditableTagList title="Entry Types" items={entries} onSave={(newItems) => handleSaveSettings('entries', newItems)} />
                            <EditableTagList title="Risk Presets (%)" items={risks} onSave={(newItems) => handleSaveSettings('risks', newItems.map(Number).sort((a,b) => a-b))} inputType="number" placeholder="Add risk %..." />
                            <EditableTagList title="Stoploss Types" items={stoplosses} onSave={(newItems) => handleSaveSettings('stoplosses', newItems)} />
                            <EditableTagList title="Takeprofit Types" items={takeprofits} onSave={(newItems) => handleSaveSettings('takeprofits', newItems)} />
                            <EditableTagList title="Close Types" items={closeTypes} onSave={(newItems) => handleSaveSettings('closeTypes', newItems)} />
                        </div>
                    </DataCard>

                    <DataCard title="Danger Zone">
                        <p className="text-sm text-gray-400 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                        <button onClick={handleInitiateDelete} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors self-start text-sm">Delete My Account</button>
                    </DataCard>
                </div>
            </div>

            {isAccountModalOpen && (
                <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={accountToEdit ? 'Edit Account' : 'Add New Account'}>
                    <AccountForm onSave={handleSaveAccount} onCancel={() => setIsAccountModalOpen(false)} accountToEdit={accountToEdit} />
                </Modal>
            )}
        </div>
    );
};

export default DataView;
