

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext, saveTradeAction, deleteTradeAction, fetchMoreNotesAction, saveSettingsAction } from './services/appState';
import { supabase } from './services/supabase';
import { bulkPut, getTable } from './services/offlineService';
import Auth from './components/Auth';
import TradesList from './components/TradesList';
import TradeForm from './components/TradeForm';
import TradeDetail from './components/TradeDetail';
import DataView from './components/DataView';
import NotesView from './components/NotesView';
import AnalysisView from './components/AnalysisView';
import Modal from './components/ui/Modal';
import { Trade, Account, UserData, Note } from './types';
import SyncManager from './components/SyncManager';

const TRADES_PAGE_SIZE = 50;

const Sidebar: React.FC<{ activeView: string; onNavigate: (view: string) => void }> = ({ activeView, onNavigate }) => {
    const navItems = [
        { id: 'journal', label: 'Journal', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg> },
        { id: 'analysis', label: 'Analysis', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg> },
        { id: 'notes', label: 'Notes', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg> },
        { id: 'settings', label: 'Settings', icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> },
    ];
    return (
        <nav className="bg-[#1A1D26] w-20 lg:w-56 p-2 lg:p-4 flex flex-col justify-between border-r border-gray-700/50">
            <div>
                <div className="flex items-center gap-3 mb-8 lg:mb-12 px-2 lg:px-0">
                    <img src="/logo.svg" alt="Logo" className="w-8 h-8"/>
                    <h1 className="text-2xl font-bold text-white hidden lg:block">Journal</h1>
                </div>
                <ul className="space-y-2">
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button onClick={() => onNavigate(item.id)} className={`w-full flex items-center gap-4 p-3 rounded-lg text-lg transition-colors ${activeView === item.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'}`}>
                                {item.icon}
                                <span className="hidden lg:block">{item.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </nav>
    );
};

const App = () => {
  const { state, dispatch } = useAppContext();
  const { isLoading, currentUser, isGuest, userData, hasMoreTrades, isFetchingMore } = state;
  const [activeView, setActiveView] = useState('journal');

  const [isTradeFormOpen, setIsTradeFormOpen] = useState(false);
  const [tradeToEdit, setTradeToEdit] = useState<Trade | null>(null);
  const [tradeToView, setTradeToView] = useState<Trade | null>(null);
  const [isDeleteAccountModalOpen, setIsDeleteAccountModalOpen] = useState(false);
  
  // Data Loading Effect
  useEffect(() => {
    if (isGuest || !currentUser) {
        if (!isGuest) dispatch({ type: 'SET_USER_DATA', payload: null });
        return;
    }
    
    const loadInitialData = async () => {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        
        // Try to load from local DB first for speed
        const [localTrades, localAccounts, localNotes, localSettings] = await Promise.all([
            getTable<Trade>('trades'),
            getTable<Account>('accounts'),
            getTable<Note>('notes'),
            getTable<any>('settings'),
        ]);

        if (localTrades.length > 0 || localAccounts.length > 0 || localNotes.length > 0) {
            const settingsData = localSettings.find(s => s.id === 'user-settings')?.data || {};
             dispatch({
                type: 'SET_USER_DATA',
                payload: { trades: localTrades, accounts: localAccounts, notes: localNotes, ...settingsData }
            });
            dispatch({ type: 'SET_IS_LOADING', payload: false });
        }
        
        // Then, fetch from Supabase to sync
        const [tradesRes, accountsRes, notesRes, settingsRes] = await Promise.all([
            supabase.from('trades').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).limit(TRADES_PAGE_SIZE),
            supabase.from('accounts').select('*').eq('user_id', currentUser.id),
            supabase.from('notes').select('*').eq('user_id', currentUser.id).order('date', { ascending: false }).limit(20),
            supabase.from('user_settings').select('settings_data').eq('user_id', currentUser.id).maybeSingle(),
        ]);
        
        if (tradesRes.error || accountsRes.error || notesRes.error || settingsRes.error) {
            console.error("Data loading error:", tradesRes.error || accountsRes.error || notesRes.error || settingsRes.error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: "Could not load cloud data.", type: 'error' } });
            dispatch({ type: 'SET_IS_LOADING', payload: false });
            return;
        }
        
        const fetchedTrades = tradesRes.data as Trade[];
        const fetchedAccounts = accountsRes.data as Account[];
        const fetchedNotes = notesRes.data as Note[];
        const settings = settingsRes.data?.settings_data || {};
        
        await Promise.all([
            bulkPut('trades', fetchedTrades),
            bulkPut('accounts', fetchedAccounts),
            bulkPut('notes', fetchedNotes),
            bulkPut('settings', [{ id: 'user-settings', data: settings }]),
        ]);

        dispatch({ type: 'SET_USER_DATA', payload: { trades: fetchedTrades, accounts: fetchedAccounts, notes: fetchedNotes, ...settings } });
        dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: [], hasMore: fetchedTrades.length === TRADES_PAGE_SIZE }});
        dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: [], hasMore: fetchedNotes.length === 20 }});
        dispatch({ type: 'SET_IS_LOADING', payload: false });
    };

    loadInitialData();
  }, [currentUser, isGuest, dispatch]);


  // Handlers for trade actions
  const handleAddTrade = () => {
    if (isGuest) {
      dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
      return;
    }
    setTradeToEdit(null);
    setIsTradeFormOpen(true);
  };

  const handleEditTrade = (trade: Trade) => {
    setTradeToEdit(trade);
    setIsTradeFormOpen(true);
  };
  
  const handleViewTrade = (trade: Trade) => {
    setTradeToView(trade);
  };

  const handleDeleteTrade = useCallback(async (id: string) => {
    if (isGuest) {
      dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
      return;
    }
    if (window.confirm("Are you sure you want to delete this trade?")) {
        await deleteTradeAction(dispatch, state, id);
    }
  }, [dispatch, state, isGuest]);

  const handleSaveTrade = useCallback(async (tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }) => {
    await saveTradeAction(dispatch, state, tradeData, !!tradeToEdit);
    setIsTradeFormOpen(false);
    setTradeToEdit(null);
  }, [dispatch, state, tradeToEdit]);
  
  const handleLoadMoreTrades = useCallback(async () => {
    if (isGuest || !currentUser) return;
    dispatch({ type: 'FETCH_MORE_TRADES_START' });
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('date', { ascending: false })
      .range(userData!.trades.length, userData!.trades.length + TRADES_PAGE_SIZE - 1);
    
    if (error) {
      console.error("Failed to fetch more trades:", error);
      dispatch({ type: 'SHOW_TOAST', payload: { message: "Could not load more trades.", type: 'error' } });
    } else {
      await bulkPut('trades', data as Trade[]);
      dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: data as Trade[], hasMore: data.length === TRADES_PAGE_SIZE } });
    }
  }, [dispatch, currentUser, userData, isGuest]);


  const handleInitiateDeleteAccount = () => setIsDeleteAccountModalOpen(true);
  
  const handleConfirmDeleteAccount = async () => {
    if (isGuest || !currentUser) return;
    dispatch({ type: 'SHOW_TOAST', payload: { message: "Deleting account...", type: 'success' } });
    const { error } = await supabase.rpc('delete_user_data');
    setIsDeleteAccountModalOpen(false);
    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error: ${error.message}`, type: 'error' } });
    } else {
        await supabase.auth.signOut();
        dispatch({ type: 'SHOW_TOAST', payload: { message: "Account deleted successfully.", type: 'success' } });
    }
  };

  if (isLoading) {
    return <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white text-xl">Loading Journal...</div>;
  }
  
  if (!currentUser && !isGuest) {
    return <Auth />;
  }
  
  return (
    <div className="bg-[#232733] min-h-screen flex text-white">
        <SyncManager />
        <Sidebar activeView={activeView} onNavigate={setActiveView} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
            {activeView === 'journal' && userData && <TradesList onAddTrade={handleAddTrade} onEdit={handleEditTrade} onView={handleViewTrade} onDelete={handleDeleteTrade} onLoadMore={handleLoadMoreTrades} hasMore={hasMoreTrades} isFetchingMore={isFetchingMore} />}
            {activeView === 'analysis' && <AnalysisView />}
            {activeView === 'notes' && <NotesView />}
            {activeView === 'settings' && <DataView onInitiateDeleteAccount={handleInitiateDeleteAccount}/>}
        </main>

        <Modal isOpen={isTradeFormOpen} onClose={() => setIsTradeFormOpen(false)} title={tradeToEdit ? 'Edit Trade' : 'Add New Trade'} size="4xl">
            <TradeForm onSave={handleSaveTrade} onClose={() => setIsTradeFormOpen(false)} tradeToEdit={tradeToEdit} accounts={userData?.accounts || []} />
        </Modal>

        <Modal isOpen={!!tradeToView} onClose={() => setTradeToView(null)} title="Trade Details" size="5xl">
            {tradeToView && <TradeDetail trade={tradeToView} account={userData?.accounts.find(a => a.id === tradeToView.accountId)} onEdit={(trade) => { setTradeToView(null); handleEditTrade(trade); }} />}
        </Modal>
        
        <Modal isOpen={isDeleteAccountModalOpen} onClose={() => setIsDeleteAccountModalOpen(false)} title="Confirm Account Deletion">
            <div className="text-center">
                <p className="text-gray-300 mb-6">Are you sure you want to permanently delete your account and all associated data (trades, notes, images)?<br /><strong>This action cannot be undone.</strong></p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => setIsDeleteAccountModalOpen(false)} className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500 transition-colors">Cancel</button>
                    <button onClick={handleConfirmDeleteAccount} className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">Yes, Delete Everything</button>
                </div>
            </div>
        </Modal>
    </div>
  );
};

export default App;