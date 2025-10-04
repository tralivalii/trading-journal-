import React, { useState, useMemo } from 'react';
import { useAppContext } from '../services/appState';
import { Account, Currency, UserData } from '../types';
import Modal from './ui/Modal';
import { supabase } from '../services/supabase';

interface DataViewProps {
    onInitiateDeleteAccount: () => void;
    showToast: (message: string) => void;
}

const DataCard: React.FC<{ title: string, children: React.ReactNode, action?: React.ReactNode }> = ({ title, children, action }) => (
    <div className="bg-[#232733] rounded-lg border border-gray-700/50">
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


const DataView: React.FC<DataViewProps> = ({ onInitiateDeleteAccount, showToast }) => {
    const { state, dispatch } = useAppContext();
    const { userData, currentUser } = state;
    const { accounts, pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings } = userData!;

    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);
    const [activeTab, setActiveTab] = useState<'accounts' | 'settings'>('accounts');

    const handleOpenAccountModal = (account: Account | null = null) => {
        setAccountToEdit(account);
        setIsAccountModalOpen(true);
    };

    const handleSaveAccount = async (accountData: Omit<Account, 'id'>) => {
        if (!currentUser) return;
        
        try {
            if (accountToEdit) {
                const { data, error } = await supabase
                    .from('accounts')
                    .update({ ...accountData })
                    .eq('id', accountToEdit.id)
                    .select()
                    .single();
                
                if (error) throw error;
                const updatedAccounts = accounts.map(a => a.id === data.id ? data : a);
                dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
                showToast('Account updated successfully.');
            } else {
                const { data, error } = await supabase
                    .from('accounts')
                    .insert({ ...accountData, user_id: currentUser.id })
                    .select()
                    .single();

                if (error) throw error;
                dispatch({ type: 'UPDATE_ACCOUNTS', payload: [...accounts, data] });
                showToast('Account added successfully.');
            }
            setIsAccountModalOpen(false);
            setAccountToEdit(null);
        } catch (error) {
            console.error('Failed to save account:', error);
            showToast('Failed to save account.');
        }
    };
    
    const handleToggleArchiveAccount = async (account: Account) => {
        if (!currentUser) return;

        try {
            const { data, error } = await supabase
                .from('accounts')
                .update({ isArchived: !account.isArchived })
                .eq('id', account.id)
                .select()
                .single();

            if (error) throw error;
            const updatedAccounts = accounts.map(a => a.id === data.id ? data : a);
            dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
            showToast(`Account ${data.isArchived ? 'archived' : 'unarchived'}.`);
        } catch (error) {
            console.error('Failed to update account status:', error);
            showToast('Failed to update account status.');
        }
    };

    const handleSaveSettings = async (field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>, value: any) => {
        if (!currentUser || !userData) return;
        
        const allSettingsData = { pairs, entries, risks, stoplosses, takeprofits, closeTypes, defaultSettings };

        const { error } = await supabase
            .from('user_data')
            .update({ data: { ...allSettingsData, [field]: value } })
            .eq('user_id', currentUser.id);

        if (error) {
            showToast(`Error saving settings.`);
            console.error(error);
        } else {
            dispatch({ type: 'UPDATE_USER_DATA_FIELD', payload: { field, value }});
            showToast('Settings updated successfully.');
        }
    };

    const sortedAccounts = useMemo(() => 
        [...accounts].sort((a, b) => (a.isArchived ? 1 : -1) - (b.isArchived ? 1 : -1) || a.name.localeCompare(b.name)), 
    [accounts]);

    const handleExportData = () => {
        const dataStr = JSON.stringify(userData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'trade_journal_data.json';
    
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        showToast("Data exported.");
    };

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Data & Settings</h1>
            
            <div className="border-b border-gray-700 mb-6">
                <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button onClick={() => setActiveTab('accounts')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'accounts' ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>
                        Accounts
                    </button>
                    <button onClick={() => setActiveTab('settings')} className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${activeTab === 'settings' ? 'border-[#3B82F6] text-[#3B82F6]' : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-500'}`}>
                        Journal Settings
                    </button>
                </nav>
            </div>
            
            {activeTab === 'accounts' && (
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
                                <div className="flex items-center gap-3">
                                    <button onClick={() => handleOpenAccountModal(acc)} className="text-blue-400 hover:text-blue-300 transition-colors" disabled={acc.isArchived}>Edit</button>
                                    <button onClick={() => handleToggleArchiveAccount(acc)} className="text-yellow-400 hover:text-yellow-300 transition-colors">{acc.isArchived ? 'Unarchive' : 'Archive'}</button>
                                </div>
                            </div>
                        )) : <p className="text-center text-gray-500 py-4">No accounts created yet.</p>}
                    </div>
                </DataCard>
            )}

            {activeTab === 'settings' && (
                <SettingsForm 
                    initialData={{ pairs, entries, risks, stoplosses, takeprofits, closeTypes }}
                    onSave={handleSaveSettings}
                />
            )}

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                 <DataCard title="Data Management">
                    <div className="flex gap-4">
                        <button onClick={handleExportData} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm">Export Data</button>
                        <button onClick={() => alert("Import functionality is not yet implemented.")} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors text-sm disabled:opacity-50" disabled>Import Data</button>
                    </div>
                 </DataCard>
                 <DataCard title="Danger Zone">
                    <p className="text-sm text-gray-400 mb-4">Permanently delete your account and all associated data. This action cannot be undone.</p>
                    <button onClick={onInitiateDeleteAccount} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors self-start text-sm">Delete My Account</button>
                 </DataCard>
            </div>

            {isAccountModalOpen && (
                <Modal isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} title={accountToEdit ? 'Edit Account' : 'Add New Account'}>
                    <AccountForm onSave={handleSaveAccount} onCancel={() => setIsAccountModalOpen(false)} accountToEdit={accountToEdit} />
                </Modal>
            )}
        </div>
    );
};

const AccountForm: React.FC<{ onSave: (data: Omit<Account, 'id'>) => void; onCancel: () => void; accountToEdit: Account | null }> = ({ onSave, onCancel, accountToEdit }) => {
    const [name, setName] = useState(accountToEdit?.name || '');
    const [initialBalance, setInitialBalance] = useState(accountToEdit?.initialBalance || 10000);
    const [currency, setCurrency] = useState(accountToEdit?.currency || Currency.USD);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || initialBalance <= 0) {
            alert("Please provide a valid name and initial balance.");
            return;
        }
        onSave({ name, initialBalance, currency });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Account Name">
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={textInputClasses} />
            </FormField>
            <FormField label="Initial Balance">
                <input type="number" value={initialBalance} onChange={e => setInitialBalance(parseFloat(e.target.value) || 0)} required className={numberInputClasses} />
            </FormField>
             <FormField label="Currency">
                <select value={currency} onChange={e => setCurrency(e.target.value as Currency)} className={textInputClasses}>
                    {Object.values(Currency).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
            </FormField>
            <div className="flex justify-end gap-4 pt-4">
                <button type="button" onClick={onCancel} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">{accountToEdit ? 'Update' : 'Save'}</button>
            </div>
        </form>
    );
};

const SettingsForm: React.FC<{
    initialData: {
        pairs: string[],
        entries: string[],
        risks: number[],
        stoplosses: string[],
        takeprofits: string[],
        closeTypes: string[],
    },
    onSave: (field: any, value: any) => void,
}> = ({ initialData, onSave }) => {

    const [settings, setSettings] = useState({
        pairs: initialData.pairs.join(', '),
        entries: initialData.entries.join(', '),
        risks: initialData.risks.join(', '),
        stoplosses: initialData.stoplosses.join(', '),
        takeprofits: initialData.takeprofits.join(', '),
        closeTypes: initialData.closeTypes.join(', '),
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setSettings(prev => ({...prev, [name]: value}));
    };

    const handleSave = (field: keyof typeof settings) => {
        const value = settings[field];
        const arr = value.split(',').map(item => item.trim()).filter(Boolean);

        if(field === 'risks') {
            onSave(field, arr.map(Number).filter(n => !isNaN(n)));
        } else {
            onSave(field, arr);
        }
    };
    
    const fields: (keyof typeof settings)[] = ['pairs', 'entries', 'risks', 'stoplosses', 'takeprofits', 'closeTypes'];

    return (
        <DataCard title="Manage Journal Options">
            <div className="space-y-6">
            {fields.map(field => (
                <div key={field}>
                    <FormField label={field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}>
                        <textarea
                            name={field}
                            value={settings[field]}
                            onChange={handleChange}
                            rows={2}
                            className={`${textInputClasses} resize-y`}
                            placeholder="Comma-separated values"
                        />
                    </FormField>
                    <div className="text-right mt-2">
                         <button onClick={() => handleSave(field)} className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors text-xs font-medium">Save</button>
                    </div>
                </div>
            ))}
            </div>
        </DataCard>
    )
}

export default DataView;
