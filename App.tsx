import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext, saveTradeAction, deleteTradeAction } from './services/appState';
import { Trade } from './types';
import Auth from './components/Auth';
import TradesList from './components/TradesList';
import TradeForm from './components/TradeForm';
import TradeDetail from './components/TradeDetail';
import Modal from './components/ui/Modal';
import DataView from './components/DataView';
import AnalysisView from './components/AnalysisView';
import NotesView from './components/NotesView';
import { ICONS } from './constants';
import { supabase } from './services/supabase';
import { clearAllData, getTable, bulkPut } from './services/offlineService';

type View = 'journal' | 'analysis' | 'notes' | 'settings';

const NavItem: React.FC<{
    view: View;
    currentView: View;
    setView: (view: View) => void;
    children: React.ReactNode;
    label: string;
}> = ({ view, currentView, setView, children, label }) => (
    <button
        onClick={() => setView(view)}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
            currentView === view
                ? 'bg-blue-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
        }`}
        aria-current={currentView === view ? 'page' : undefined}
    >
        {children}
        <span className="hidden lg:inline">{label}</span>
    </button>
);

const App: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { session, currentUser, userData, isLoading, isGuest, toasts, syncStatus } = state;
    const [view, setView] = useState<View>('journal');

    const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);

    const [isTradeDetailOpen, setIsTradeDetailOpen] = useState(false);
    const [tradeToView, setTradeToView] = useState<Trade | null>(null);

    const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);

    // Initial data loading effect
    useEffect(() => {
        if (!currentUser || userData) return;

        const loadInitialData = async () => {
            dispatch({ type: 'SET_IS_LOADING', payload: true });
            try {
                if (navigator.onLine) {
                    // Fetch from Supabase
                    const { data, error } = await supabase
                        .from('user_data')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .single();

                    if (error && error.code !== 'PGRST116') throw error; // Ignore "exact one row was not found"

                    const fetchedUserData = data ? data.data : {};
                    
                    const { data: trades, error: tradesError } = await supabase
                        .from('trades')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .order('date', { ascending: false })
                        .limit(20);

                    if (tradesError) throw tradesError;
                    
                    const { data: notes, error: notesError } = await supabase
                        .from('notes')
                        .select('*')
                        .eq('user_id', currentUser.id)
                        .order('date', { ascending: false })
                        .limit(20);
                    if(notesError) throw notesError;

                    const finalUserData = {
                        ...{
                            trades: [], accounts: [], pairs: [], entries: [], risks: [],
                            defaultSettings: {}, notes: [], stoplosses: [], takeprofits: [],
                            closeTypes: [], analysisTimeframes: []
                        },
                        ...fetchedUserData,
                        trades: trades || [],
                        notes: notes || [],
                    };

                    dispatch({ type: 'SET_USER_DATA', payload: finalUserData });
                    dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: trades || [], hasMore: (trades || []).length === 20 } });
                    dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: notes || [], hasMore: (notes || []).length === 20 } });

                    // Cache fetched data
                    await bulkPut('trades', trades || []);
                    await bulkPut('notes', notes || []);
                    await bulkPut('settings', [{ id: 'user-settings', data: fetchedUserData }]);
                    await bulkPut('accounts', fetchedUserData.accounts || []);

                } else {
                    // Load from IndexedDB
                    const trades = await getTable('trades');
                    const notes = await getTable('notes');
                    const settingsResult = await getTable('settings');
                    const accounts = await getTable('accounts');

                    const settings = settingsResult[0] || {};
                    const finalUserData = { ...settings.data, trades, notes, accounts };
                    dispatch({ type: 'SET_USER_DATA', payload: finalUserData });
                }
            } catch (error) {
                console.error("Error loading initial data:", error);
                dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load data.', type: 'error' } });
            } finally {
                dispatch({ type: 'SET_IS_LOADING', payload: false });
            }
        };

        if(!isGuest) {
            loadInitialData();
        }
    }, [currentUser, dispatch, isGuest, userData]);

    const handleAddTrade = () => {
        setTradeToEdit(null);
        setIsTradeFormOpen(true);
    };

    const handleEditTrade = (trade: Trade) => {
        setTradeToEdit(trade);
        setIsTradeFormOpen(true);
    };

    const handleViewTrade = (trade: Trade) => {
        setTradeToView(trade);
        setIsTradeDetailOpen(true);
    };

    const handleSaveTrade = async (tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => {
        try {
            await saveTradeAction(dispatch, state, tradeData, !!tradeToEdit);
            setIsTradeFormOpen(false);
            setTradeToEdit(null);
        } catch (error: any) {
            console.error("Failed to save trade:", error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: error.message || 'Could not save trade.', type: 'error' } });
        }
    };
    
    const handleDeleteTrade = async (id: string) => {
        if (window.confirm('Are you sure you want to delete this trade?')) {
            await deleteTradeAction(dispatch, state, id);
        }
    };

    const handleCloseTradeForm = () => {
        // The form has its own dirty check logic, so this can be simpler.
        setIsTradeFormOpen(false);
    };

    const handleLoadMoreTrades = useCallback(async () => {
        if (isGuest || !currentUser || !userData) return;
        dispatch({ type: 'FETCH_MORE_TRADES_START' });
        try {
            const { data, error } = await supabase
                .from('trades')
                .select('*')
                .eq('user_id', currentUser.id)
                .order('date', { ascending: false })
                .range(userData.trades.length, userData.trades.length + 20 - 1);
            
            if (error) throw error;
            await bulkPut('trades', data);
            dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: data, hasMore: data.length === 20 } });
        } catch (error) {
            console.error("Failed to fetch more trades:", error);
            // reset state
        }
    }, [currentUser, dispatch, isGuest, userData]);
    
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        await clearAllData();
        dispatch({ type: 'SET_SESSION', payload: null });
        dispatch({ type: 'SET_USER_DATA', payload: null });
    };

    const handleDeleteAccount = async () => {
        if (!currentUser || isGuest) return;
        if (window.confirm("This will permanently delete your account and all data. This cannot be undone. Are you absolutely sure?")) {
            const { error } = await supabase.rpc('delete_user');
            if (error) {
                dispatch({ type: 'SHOW_TOAST', payload: { message: `Error: ${error.message}`, type: 'error' } });
            } else {
                dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account deleted successfully.', type: 'success' } });
                handleSignOut();
            }
        }
        setIsDeleteAccountModalOpen(false);
    };

    const hideToast = (id: number) => {
        dispatch({ type: 'HIDE_TOAST', payload: id });
    };

    if (isLoading && !isGuest && !userData) {
        return <div className="min-h-screen bg-[#1A1D26] flex items-center justify-center text-white">Loading your journal...</div>;
    }

    if (!session && !isGuest) {
        return <Auth />;
    }

    if (!userData) {
        return <div className="min-h-screen bg-[#1A1D26] flex items-center justify-center text-white">Initializing your data...</div>;
    }

    const accountForDetailView = userData.accounts.find(acc => acc.id === tradeToView?.accountId);
    
    const SyncIndicator: React.FC = () => {
        let bgColor, textColor, text;
        switch (syncStatus) {
            case 'syncing':
                bgColor = 'bg-yellow-500'; textColor = 'text-white'; text = 'Syncing...';
                break;
            case 'offline':
                bgColor = 'bg-red-500'; textColor = 'text-white'; text = 'Offline';
                break;
            default:
                bgColor = 'bg-green-500'; textColor = 'text-white'; text = 'Online';
        }
        return (
            <div className={`text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 ${bgColor} ${textColor}`}>
                <span className={`h-2 w-2 rounded-full ${syncStatus === 'syncing' ? 'animate-pulse' : ''} bg-current`}></span>
                {text}
            </div>
        );
    };

    return (
        <div className="bg-[#1A1D26] text-white min-h-screen flex">
            {/* Sidebar */}
            <nav className="bg-[#232733] p-2 lg:p-4 flex flex-col justify-between border-r border-gray-700/50">
                <div>
                    <div className="mb-8 hidden lg:block">
                        <h1 className="text-xl font-bold text-center">TradeJournal</h1>
                    </div>
                    <div className="space-y-2">
                        <NavItem view="journal" currentView={view} setView={setView} label="Journal">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        </NavItem>
                        <NavItem view="analysis" currentView={view} setView={setView} label="Analysis">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                        </NavItem>
                         <NavItem view="notes" currentView={view} setView={setView} label="Notes">
                           <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </NavItem>
                        <NavItem view="settings" currentView={view} setView={setView} label="Settings">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        </NavItem>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-center p-2">
                        {!isGuest && <SyncIndicator />}
                    </div>
                    {!isGuest && (
                         <button
                            onClick={handleSignOut}
                            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-gray-300 hover:bg-gray-700 hover:text-white w-full"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                            <span className="hidden lg:inline">Sign Out</span>
                        </button>
                    )}
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
                 {view === 'journal' && (
                    <TradesList
                        onEdit={handleEditTrade}
                        onView={handleViewTrade}
                        onDelete={handleDeleteTrade}
                        onAddTrade={handleAddTrade}
                        onLoadMore={handleLoadMoreTrades}
                        hasMore={state.hasMoreTrades}
                        isFetchingMore={state.isFetchingMore}
                    />
                )}
                {view === 'analysis' && <AnalysisView />}
                {view === 'notes' && <NotesView />}
                {view === 'settings' && <DataView onInitiateDeleteAccount={() => setIsDeleteAccountModalOpen(true)} />}

                {/* FAB for mobile */}
                {view === 'journal' && (
                    <button
                        onClick={handleAddTrade}
                        className="lg:hidden fixed bottom-6 right-6 bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-500 transition-colors z-40"
                        aria-label="Add new trade"
                    >
                       <span className="w-6 h-6 block">{ICONS.plus}</span>
                    </button>
                )}
            </main>

            {/* Modals */}
            <Modal
                isOpen={isTradeFormOpen}
                onClose={handleCloseTradeForm}
                onCloseRequest={() => {
                    const formWrapper = document.getElementById('trade-form-wrapper');
                    if(formWrapper) {
                        formWrapper.dispatchEvent(new CustomEvent('closeRequest', { bubbles: true }));
                    }
                }}
                title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'}
                size="4xl"
            >
                <TradeForm
                    onSave={handleSaveTrade}
                    onClose={handleCloseTradeForm}
                    tradeToEdit={tradeToEdit}
                    accounts={userData.accounts.filter(a => !a.isArchived)}
                />
            </Modal>
            <Modal isOpen={isTradeDetailOpen} onClose={() => setIsTradeDetailOpen(false)} title="Trade Details" size="3xl">
                {tradeToView && <TradeDetail trade={tradeToView} account={accountForDetailView} onEdit={handleEditTrade} />}
            </Modal>
             <Modal isOpen={isDeleteAccountModalOpen} onClose={() => setIsDeleteAccountModalOpen(false)} title="Confirm Account Deletion">
                <div className="text-center">
                    <p className="text-gray-300 mb-6">Are you sure you want to permanently delete your account and all associated data? This is irreversible.</p>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => setIsDeleteAccountModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                        <button onClick={handleDeleteAccount} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete My Account</button>
                    </div>
                </div>
            </Modal>
            
             {/* Toast Notifications */}
            <div className="fixed top-5 right-5 z-[100] space-y-2 w-full max-w-sm">
                {toasts.map(toast => (
                    <div key={toast.id} className={`flex items-start justify-between p-4 rounded-lg shadow-lg text-white ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
                        <p className="text-sm font-medium">{toast.message}</p>
                        <button onClick={() => hideToast(toast.id)} className="ml-4 text-white hover:text-gray-200">
                           &times;
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default App;
