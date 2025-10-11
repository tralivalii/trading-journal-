import React, { useState, useEffect, useCallback } from 'react';
import { 
    useAppContext, 
    saveTradeAction, 
    deleteTradeAction,
    saveAccountAction,
    deleteAccountAction,
    saveNoteAction,
    deleteNoteAction,
    saveSettingsAction
} from './services/appState';
import Auth from './components/Auth';
import DataView from './components/DataView';
import TradesList from './components/TradesList';
import Modal from './components/ui/Modal';
import TradeForm from './components/TradeForm';
import { Trade, Account, Note, UserData } from './types';
import TradeDetail from './components/TradeDetail';
import AnalysisView from './components/AnalysisView';
import NotesView from './components/NotesView';
import { supabase } from './services/supabase';
import * as db from './services/offlineService';
import { caseConverter } from './utils/caseConverter';
// FIX: Imported AccountForm to resolve 'Cannot find name' error.
import AccountForm from './components/AccountForm';

type View = 'journal' | 'dashboard' | 'analysis' | 'notes' | 'data';

const TRADES_PAGE_SIZE = 50;
const NOTES_PAGE_SIZE = 20;

const App: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const [activeView, setActiveView] = useState<View>('dashboard');
    const [isSyncing, setIsSyncing] = useState(false);

    const [isTradeFormOpen, setTradeFormOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);

    const [isTradeDetailOpen, setTradeDetailOpen] = useState(false);
    const [tradeToView, setTradeToView] = useState<Trade | null>(null);

    const [isAccountFormOpen, setAccountFormOpen] = useState(false);
    const [accountToEdit, setAccountToEdit] = useState<Account | null>(null);

    const processSyncQueue = useCallback(async () => {
        if (isSyncing || !state.isOnline || !state.currentUser) return;

        const queue = await db.getSyncQueue();
        if (queue.length === 0) return;

        setIsSyncing(true);
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Syncing ${queue.length} items...`, type: 'info' } });

        try {
            for (const item of queue) {
                const payloadInSnake = caseConverter.toSnake(item.payload);
                switch(item.type) {
                    case 'trade':
                        if (item.action === 'delete') {
                            await supabase.from('trades').delete().eq('id', item.payload.id);
                        } else {
                            await supabase.from('trades').upsert(payloadInSnake);
                        }
                        break;
                    case 'account':
                        if (item.action === 'delete') {
                            await supabase.from('accounts').delete().eq('id', item.payload.id);
                        } else {
                            await supabase.from('accounts').upsert(payloadInSnake);
                        }
                        break;
                    case 'note':
                        if (item.action === 'delete') {
                            await supabase.from('notes').delete().eq('id', item.payload.id);
                        } else {
                            await supabase.from('notes').upsert(payloadInSnake);
                        }
                        break;
                    case 'settings':
                         await supabase.from('user_data').upsert(payloadInSnake).eq('user_id', state.currentUser.id);
                         break;
                }
            }
            await db.clearSyncQueue();
            dispatch({ type: 'CLEAR_SYNC_QUEUE' });
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Sync successful!', type: 'success' } });

            // After successful sync, refresh all data from server
            const { data: tradesData } = await supabase.from('trades').select('*').eq('user_id', state.currentUser.id).order('date', { ascending: false }).limit(TRADES_PAGE_SIZE);
            const { data: accountsData } = await supabase.from('accounts').select('*').eq('user_id', state.currentUser.id);
            const { data: notesData } = await supabase.from('notes').select('*').eq('user_id', state.currentUser.id).order('date', { ascending: false }).limit(NOTES_PAGE_SIZE);
            const { data: settingsData } = await supabase.from('user_data').select('*').eq('user_id', state.currentUser.id).maybeSingle();
            
            await Promise.all([
                db.bulkPut('trades', tradesData || []),
                db.bulkPut('accounts', accountsData || []),
                db.bulkPut('notes', notesData || []),
                db.bulkPut('settings', settingsData ? [settingsData] : []),
            ]);

            dispatch({ type: 'SET_USER_DATA', payload: { trades: tradesData || [], accounts: accountsData || [], notes: notesData || [], settings: settingsData }});

        } catch (error: any) {
            console.error('Sync failed:', error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: `Sync failed. Your changes are still saved locally. Error: ${error.message}`, type: 'error' } });
        } finally {
            setIsSyncing(false);
        }
    }, [isSyncing, state.isOnline, state.currentUser, dispatch]);
    
    useEffect(() => {
        window.addEventListener('sync-request', processSyncQueue);
        return () => window.removeEventListener('sync-request', processSyncQueue);
    }, [processSyncQueue]);
    
    useEffect(() => {
        if (state.isOnline) {
             processSyncQueue();
        }
    }, [state.isOnline, processSyncQueue]);

    // This effect handles closing modals if user logs out
    useEffect(() => {
        if (state.session === null && !state.isGuest) {
            setTradeFormOpen(false);
            setTradeDetailOpen(false);
            setAccountFormOpen(false);
        }
    }, [state.session, state.isGuest]);

    if (state.isLoading) {
        return (
            <div className="min-h-screen bg-[#1A1D26] flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!state.session && !state.isGuest) {
        return <Auth />;
    }
    
    // This is a safeguard. If loading is false but we still don't have user data for a logged-in user, show loading.
    if (!state.isGuest && !state.userData) {
         return (
            <div className="min-h-screen bg-[#1A1D26] flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
                 <p className="ml-4 text-gray-400">Loading user data...</p>
            </div>
        );
    }
    
    // HANDLERS
    const handleSaveTrade = async (tradeData: Partial<Trade>, isUpdate: boolean) => {
        await saveTradeAction(dispatch, state, tradeData, isUpdate);
        setTradeFormOpen(false);
    };
    const handleDeleteTrade = (id: string) => {
        if (confirm('Are you sure you want to delete this trade?')) {
            deleteTradeAction(dispatch, state, id);
            if(tradeToView?.id === id) setTradeDetailOpen(false);
        }
    };
    const handleSaveAccount = (accountData: Partial<Account>, isUpdate: boolean) => {
        saveAccountAction(dispatch, state, accountData, isUpdate);
        setAccountFormOpen(false);
    };
    const handleDeleteAccount = (id: string) => deleteAccountAction(dispatch, state, id);
    const handleSaveNote = (noteData: Partial<Note>, isUpdate: boolean) => saveNoteAction(dispatch, state, noteData, isUpdate);
    const handleDeleteNote = (id: string) => deleteNoteAction(dispatch, state, id);
    const handleSaveSettings = (settings: UserData) => saveSettingsAction(dispatch, state, settings);
    
    const handleFormClose = useCallback(() => {
        setTradeFormOpen(false);
        setTradeToEdit(null);
    }, []);

    const NavButton: React.FC<{view: View, label: string}> = ({ view, label }) => (
        <button 
            onClick={() => setActiveView(view)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeView === view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`}
        >
        {label}
        </button>
    );
    
    const SyncIndicator: React.FC = () => {
        let statusText = 'Online';
        let bgColor = 'bg-green-500';

        if (!state.isOnline) {
            statusText = 'Offline';
            bgColor = 'bg-yellow-500';
        } else if (isSyncing) {
            statusText = 'Syncing';
            bgColor = 'bg-blue-500 animate-pulse';
        } else if (state.syncQueue.length > 0) {
            statusText = `Pending (${state.syncQueue.length})`;
            bgColor = 'bg-orange-500';
        }

        return (
            <div className={`fixed bottom-4 right-4 text-xs text-white px-3 py-1 rounded-full flex items-center gap-2 ${bgColor} z-50`}>
                <span className="block w-2 h-2 rounded-full bg-white"></span>
                {statusText}
            </div>
        );
    }
    
    const Toast: React.FC<{toast: any}> = ({ toast }) => {
        const [visible, setVisible] = useState(false);

        useEffect(() => {
            if (toast) {
                setVisible(true);
                const timer = setTimeout(() => {
                    setVisible(false);
                    setTimeout(() => dispatch({ type: 'HIDE_TOAST' }), 300);
                }, 4000);
                return () => clearTimeout(timer);
            }
        }, [toast]);
        
        if (!toast) return null;
        
        const typeClasses = {
            success: 'bg-green-600/80 border-green-500',
            error: 'bg-red-600/80 border-red-500',
            info: 'bg-blue-600/80 border-blue-500',
        };

        return (
             <div className={`fixed top-5 left-1/2 -translate-x-1/2 min-w-[250px] text-center p-3 rounded-lg border text-white text-sm backdrop-blur-sm shadow-lg transition-all duration-300 z-50 ${typeClasses[toast.type]} ${visible ? 'translate-y-0 opacity-100' : '-translate-y-16 opacity-0'}`}>
                {toast.message}
            </div>
        );
    }

    return (
        <div className="bg-[#1A1D26] text-white min-h-screen">
            <header className="bg-[#1A1D26]/80 backdrop-blur-sm sticky top-0 z-40 border-b border-gray-700/50">
                <nav className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold">Trading Journal</h1>
                            <div className="hidden md:flex items-center gap-2">
                                <NavButton view="dashboard" label="Dashboard" />
                                <NavButton view="journal" label="Journal" />
                                <NavButton view="analysis" label="Analysis" />
                                <NavButton view="notes" label="Notes" />
                                <NavButton view="data" label="Data & Settings" />
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => { setTradeToEdit(null); setTradeFormOpen(true); }}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-500 transition-colors"
                            >
                                Add Trade
                            </button>
                            <button onClick={() => supabase.auth.signOut()} className="text-sm text-gray-400 hover:text-white">
                                Logout
                            </button>
                        </div>
                    </div>
                    <div className="md:hidden flex items-center gap-2 pb-3 justify-center border-t border-gray-700/50 mt-1 pt-3">
                         <NavButton view="dashboard" label="Dashboard" />
                         <NavButton view="journal" label="Journal" />
                         <NavButton view="analysis" label="Analysis" />
                         <NavButton view="notes" label="Notes" />
                         <NavButton view="data" label="Data" />
                    </div>
                </nav>
            </header>

            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {activeView === 'dashboard' && <DataView />}
                {activeView === 'journal' && (
                <TradesList
                    onAddTrade={() => { setTradeToEdit(null); setTradeFormOpen(true); }}
                    onEdit={(trade) => { setTradeToEdit(trade); setTradeFormOpen(true); }}
                    onView={(trade) => { setTradeToView(trade); setTradeDetailOpen(true); }}
                    onDelete={handleDeleteTrade}
                />
                )}
                {activeView === 'analysis' && <AnalysisView />}
                {activeView === 'notes' && <NotesView />}
                {activeView === 'data' && <DataView onOpenAccountForm={(acc) => { setAccountToEdit(acc); setAccountFormOpen(true); }} onDeleteAccount={handleDeleteAccount} onSaveSettings={handleSaveSettings} />}
            </main>

            <Modal isOpen={isTradeFormOpen} onCloseRequest={handleFormClose} onClose={handleFormClose} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} size="4xl">
                <TradeForm
                    onSave={handleSaveTrade}
                    onCancel={handleFormClose}
                    tradeToEdit={tradeToEdit}
                />
            </Modal>
            
            <Modal isOpen={isAccountFormOpen} onClose={() => setAccountFormOpen(false)} title={accountToEdit ? 'Edit Account' : 'Add Account'}>
                <AccountForm onSave={(acc, isUpdate) => { handleSaveAccount(acc, isUpdate); }} onCancel={() => setAccountFormOpen(false)} accountToEdit={accountToEdit} />
            </Modal>

            <Modal isOpen={isTradeDetailOpen} onClose={() => setTradeDetailOpen(false)} title="Trade Details" size="5xl">
                {tradeToView && <TradeDetail trade={tradeToView} onEdit={(trade) => { setTradeDetailOpen(false); setTradeToEdit(trade); setTradeFormOpen(true); }} onDelete={handleDeleteTrade} />}
            </Modal>

            <SyncIndicator />
            <Toast toast={state.toast} />
        </div>
    );
};

export default App;