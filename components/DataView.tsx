import React, { useState } from 'react';
// FIX: Changed imports to be relative paths
import { Account, DefaultSettings, Trade, Currency } from '../types';
import { ICONS } from '../constants';
import Modal from './ui/Modal';

interface DataViewProps {
    accounts: Account[];
    setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
    pairs: string[];
    setPairs: React.Dispatch<React.SetStateAction<string[]>>;
    setups: string[];
    setSetups: React.Dispatch<React.SetStateAction<string[]>>;
    risks: number[];
    setRisks: React.Dispatch<React.SetStateAction<number[]>>;
    defaultSettings: DefaultSettings;
    setDefaultSettings: React.Dispatch<React.SetStateAction<DefaultSettings>>;
    accountBalances: Map<string, number>;
    setTrades: React.Dispatch<React.SetStateAction<Trade[]>>;
    onInitiateDeleteAccount: () => void;
}

const DataCard: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700/50">
        <h2 className="text-xl font-semibold text-white p-4 border-b border-gray-700">{title}</h2>
        <div className="p-4 space-y-3">{children}</div>
    </div>
);

const DataView: React.FC<DataViewProps> = (props) => {
    const { accounts, setAccounts, pairs, setPairs, setups, setSetups, risks, setRisks, defaultSettings, setDefaultSettings, accountBalances, setTrades, onInitiateDeleteAccount } = props;
    const [isAccountModalOpen, setAccountModalOpen] = useState(false);
    
    const handleAddAccount = (name: string, initialBalance: number, currency: Currency) => {
        if (name && initialBalance >= 0) {
            const newAccount: Account = { id: crypto.randomUUID(), name, initialBalance, currency };
            setAccounts(prev => [...prev, newAccount]);
            setAccountModalOpen(false);
        }
    };
    
    const handleDeleteAccount = (id: string) => {
        if(window.confirm('Are you sure? This will also delete all associated trades.')) {
            setAccounts(prev => prev.filter(a => a.id !== id));
            setTrades(prev => prev.filter(t => t.accountId !== id));
        }
    }

    const createListManager = <T extends string | number>(
        list: T[], 
        setList: React.Dispatch<React.SetStateAction<T[]>>, 
        placeholder: string,
        inputType: 'text' | 'number' = 'text'
    ) => {
        const [newItem, setNewItem] = useState('');
        const handleAdd = () => {
            if (newItem && !list.includes(newItem as T)) {
                setList(prev => [...prev, (inputType === 'number' ? Number(newItem) : newItem) as T]);
                setNewItem('');
            }
        };
        const handleRemove = (itemToRemove: T) => {
             setList(prev => prev.filter(item => item !== itemToRemove));
        };

        return (
            <>
                <div className="flex flex-wrap gap-2">
                    {list.map(item => (
                        <div key={String(item)} className="flex items-center gap-2 bg-gray-700 px-3 py-1 rounded-full text-sm">
                            <span>{item}{inputType === 'number' ? '%' : ''}</span>
                            <button onClick={() => handleRemove(item)} className="text-gray-400 hover:text-white">&times;</button>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2 pt-2">
                    <input 
                        type={inputType}
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        placeholder={placeholder}
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button onClick={handleAdd} className="px-4 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 text-sm transition-colors">Add</button>
                </div>
            </>
        )
    };
    
    const handleDefaultChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const {name, value} = e.target;
        setDefaultSettings(prev => ({...prev, [name]: name === 'risk' ? Number(value) : value}));
    }

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Data Management</h1>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <DataCard title="Accounts">
                         <div className="space-y-2">
                            {accounts.map(acc => (
                                <div key={acc.id} className="grid grid-cols-3 items-center bg-gray-800 hover:bg-gray-700/50 p-3 rounded-lg transition-colors text-sm">
                                    <span className="font-semibold text-white">{acc.name}</span>
                                    <span className="text-gray-300">{(accountBalances.get(acc.id) ?? 0).toLocaleString('en-US', { style: 'currency', currency: acc.currency || 'USD' })}</span>
                                    <div className="text-right">
                                        <button onClick={() => handleDeleteAccount(acc.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                                            <span className="w-5 h-5">{ICONS.trash}</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {accounts.length === 0 && <p className="text-center text-gray-500 col-span-4 py-2 text-sm">No accounts created.</p>}
                        </div>
                        <button onClick={() => setAccountModalOpen(true)} className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">
                           <span className="w-5 h-5">{ICONS.plus}</span> New Account
                        </button>
                    </DataCard>
                    <DataCard title="Trading Pairs">
                        {createListManager(pairs, setPairs, 'e.g., BTC/USDT')}
                    </DataCard>
                     <DataCard title="Setups">
                        {createListManager(setups, setSetups, 'e.g., IDM')}
                    </DataCard>
                </div>
                 <div className="space-y-6">
                     <DataCard title="Risk Profiles (%)">
                        {createListManager(risks, setRisks, 'e.g., 1.5', 'number')}
                    </Data-Card>
                    <DataCard title="Default New Trade Values">
                        <div className="space-y-3">
                             <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Default Account</label>
                                <select name="accountId" value={defaultSettings.accountId} onChange={handleDefaultChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                     <option value="">None</option>
                                     {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Default Pair</label>
                                <select name="pair" value={defaultSettings.pair} onChange={handleDefaultChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                     <option value="">None</option>
                                     {pairs.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Default Setup</label>
                                <select name="setup" value={defaultSettings.setup} onChange={handleDefaultChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                     <option value="">None</option>
                                     {setups.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1 text-gray-400">Default Risk</label>
                                <select name="risk" value={defaultSettings.risk} onChange={handleDefaultChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                                     <option value="">None</option>
                                     {risks.map(r => <option key={r} value={r}>{r}%</option>)}
                                </select>
                            </div>
                        </div>
                    </DataCard>
                    <DataCard title="Delete Account">
                        <div>
                            <p className="text-sm text-gray-400 mb-3">Permanently delete your account and all associated trading data. This action is irreversible.</p>
                            <button
                                onClick={onInitiateDeleteAccount}
                                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
                            >
                                Delete Account
                            </button>
                        </div>
                    </DataCard>
                </div>
            </div>
             <Modal isOpen={isAccountModalOpen} onClose={() => setAccountModalOpen(false)} title="Create New Account">
                <form onSubmit={(e) => {
                    e.preventDefault();
                    const target = e.target as typeof e.target & { name: { value: string }, balance: { value: string }, currency: { value: Currency } };
                    handleAddAccount(target.name.value, parseFloat(target.balance.value), target.currency.value);
                    target.name.value = '';
                    target.balance.value = '';
                }} className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Account Name</label>
                        <input name="name" type="text" required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Balance</label>
                        <input name="balance" type="number" step="0.01" min="0" required className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white" />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Currency</label>
                        <select name="currency" required defaultValue={Currency.USD} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white">
                           <option value={Currency.USD}>USD</option>
                           <option value={Currency.EUR}>EUR</option>
                        </select>
                     </div>
                     <div className="flex justify-end pt-4">
                        <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors">Create Account</button>
                     </div>
                </form>
            </Modal>
        </div>
    );
};

export default DataView;