
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../services/appState';
import { Account, Currency } from '../types';
import Modal from './ui/Modal';
import AccountForm from './AccountForm';
import { ICONS } from '../constants';
import { supabase } from '../services/supabase';

const SettingsView: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { accounts, settings } = state.userData!;
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

    const handleOpenAccountModal = (account: Account | null = null) => {
        if (state.isGuest) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
            return;
        }
        setAccountToEdit(account);
        setIsAccountModalOpen(true);
    };

    const handleSaveAccount = async (accountData: Omit<Account, 'id'>) => {
        const isUpdate = !!accountToEdit;
        const dataToSave = { ...accountData, user_id: state.currentUser!.id };
        
        try {
            if (isUpdate) {
                const { data, error } = await supabase.from('accounts').update(dataToSave).eq('id', accountToEdit!.id).select().single();
                if (error) throw error;
                dispatch({ type: 'UPDATE_ACCOUNT', payload: data as Account });
                dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account updated successfully.', type: 'success' } });
            } else {
                const { data, error } = await supabase.from('accounts').insert(dataToSave).select().single();
                if (error) throw error;
                dispatch({ type: 'ADD_ACCOUNT', payload: data as Account });
                dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account created successfully.', type: 'success' } });
            }
            setIsAccountModalOpen(false);
        } catch (error) {
            console.error("Error saving account:", error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to save account.', type: 'error' } });
        }
    };

    const handleToggleArchive = async (account: Account) => {
        if (state.isGuest) {
            dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
            return;
        }
         try {
            const { data, error } = await supabase.from('accounts').update({ is_archived: !account.isArchived }).eq('id', account.id).select().single();
            if (error) throw error;
            dispatch({ type: 'UPDATE_ACCOUNT', payload: data as Account });
            dispatch({ type: 'SHOW_TOAST', payload: { message: `Account ${data.isArchived ? 'archived' : 'restored'}.`, type: 'success' } });
        } catch (error) {
            console.error("Error archiving account:", error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to update account status.', type: 'error' } });
        }
    };
    
    const { activeAccounts, archivedAccounts } = useMemo(() => {
        return accounts.reduce((acc, account) => {
            if (account.isArchived) {
                acc.archivedAccounts.push(account);
            } else {
                acc.activeAccounts.push(account);
            }
            return acc;
        }, { activeAccounts: [] as Account[], archivedAccounts: [] as Account[] });
    }, [accounts]);

    const AccountRow: React.FC<{ account: Account }> = ({ account }) => (
        <tr className="bg-[#2A2F3B] border-b border-gray-700/50">
            <td className="px-6 py-4 font-medium text-white">{account.name}</td>
            <td className="px-6 py-4">{account.initialBalance.toLocaleString('en-US', { style: 'currency', currency: account.currency })}</td>
            <td className="px-6 py-4">{account.currency}</td>
            <td className="px-6 py-4">
                 <button onClick={() => handleOpenAccountModal(account)} className="font-medium text-blue-400 hover:underline mr-4">Edit</button>
                 <button onClick={() => handleToggleArchive(account)} className="font-medium text-yellow-400 hover:underline">
                    {account.isArchived ? 'Restore' : 'Archive'}
                </button>
            </td>
        </tr>
    );

    return (
        <div>
            <h1 className="text-3xl font-bold text-white mb-6">Settings</h1>

            <div className="bg-[#232733] rounded-lg border border-gray-700/50">
                <div className="p-4 flex justify-between items-center border-b border-gray-700/50">
                    <h2 className="text-xl font-semibold text-white">Accounts</h2>
                    <button onClick={() => handleOpenAccountModal()} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm">
                        <span className="w-5 h-5">{ICONS.plus}</span> Add Account
                    </button>
                </div>
                
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-300">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-3">Name</th>
                                <th scope="col" className="px-6 py-3">Initial Balance</th>
                                <th scope="col" className="px-6 py-3">Currency</th>
                                <th scope="col" className="px-6 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeAccounts.length > 0 ? activeAccounts.map(acc => <AccountRow key={acc.id} account={acc} />) : (
                                <tr><td colSpan={4} className="text-center py-8 text-gray-500">No active accounts.</td></tr>
                            )}
                            
                            {archivedAccounts.length > 0 && (
                                <>
                                    <tr className="bg-gray-800"><td colSpan={4} className="px-6 py-2 text-xs uppercase text-gray-400 font-semibold">Archived</td></tr>
                                    {archivedAccounts.map(acc => <AccountRow key={acc.id} account={acc} />)}
                                </>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Other settings can be added here in other cards, e.g., for default risk */}

            <Modal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                title={accountToEdit ? 'Edit Account' : 'Create New Account'}
            >
                <AccountForm 
                    onSave={handleSaveAccount} 
                    onCancel={() => setIsAccountModalOpen(false)} 
                    accountToEdit={accountToEdit} 
                />
            </Modal>
        </div>
    );
};

export default SettingsView;
