// services/appState.tsx

import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Account, Note, Result, Trade, UserData, Currency } from '../types';
import { supabase } from './supabase';
import { bulkPut, clearAllData, getSyncQueue, getTable, putSyncQueue } from './offlineService';

// --- STATE AND ACTION TYPES ---

interface Toast {
    message: string;
    type: 'success' | 'error';
    id: number;
}

export type SyncStatus = 'online' | 'offline' | 'syncing';

interface AppState {
  session: Session | null;
  currentUser: SupabaseUser | null;
  userData: UserData | null;
  isLoading: boolean;
  isGuest: boolean;
  hasMoreTrades: boolean;
  isFetchingMore: boolean;
  hasMoreNotes: boolean;
  isFetchingMoreNotes: boolean;
  toasts: Toast[];
  syncStatus: SyncStatus;
}

type Action =
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_USER_DATA'; payload: UserData | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_GUEST_MODE' }
  | { type: 'UPDATE_TRADES'; payload: Trade[] }
  | { type: 'UPDATE_ACCOUNTS'; payload: Account[] }
  | { type: 'UPDATE_NOTES'; payload: Note[] }
  | { type: 'UPDATE_USER_DATA_FIELD'; payload: { field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>; value: any } }
  | { type: 'FETCH_MORE_TRADES_START' }
  | { type: 'FETCH_MORE_TRADES_SUCCESS'; payload: { trades: Trade[]; hasMore: boolean } }
  | { type: 'FETCH_MORE_NOTES_START' }
  | { type: 'FETCH_MORE_NOTES_SUCCESS'; payload: { notes: Note[]; hasMore: boolean } }
  | { type: 'SHOW_TOAST'; payload: Omit<Toast, 'id'> }
  | { type: 'HIDE_TOAST'; payload: number }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus };


// --- REDUCER ---

const defaultTimeframes = ['1D', '1h', '5m', 'Result'];

const initialState: AppState = {
  session: null,
  currentUser: null,
  userData: null,
  isLoading: true,
  isGuest: false,
  hasMoreTrades: false,
  isFetchingMore: false,
  hasMoreNotes: false,
  isFetchingMoreNotes: false,
  toasts: [],
  syncStatus: navigator.onLine ? 'online' : 'offline',
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        session: action.payload,
        currentUser: action.payload?.user ?? null,
        isGuest: false, // Reset guest mode on session change
      };
    case 'SET_USER_DATA':
      const userData = action.payload;
      if (userData) {
          // Ensure defaults for existing users to prevent crashes
          userData.analysisTimeframes = userData.analysisTimeframes || [...defaultTimeframes];
          userData.defaultSettings = {
              ...{ accountId: '', pair: '', entry: '', risk: 1, stoploss: 'Sessions High/Low', takeprofit: 'Fractal' },
              ...userData.defaultSettings,
          };
      }
      return { ...state, userData };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_GUEST_MODE':
      const guestData: UserData = {
        trades: [],
        accounts: [{ id: 'guest-acc', name: 'Guest Account', initialBalance: 100000, currency: Currency.USD, isArchived: false }],
        pairs: ['EUR/USD', 'GBP/USD', 'XAU/USD', 'BTC/USDT'],
        entries: ['Market', 'Order Block', 'FVG'],
        risks: [0.5, 1, 1.5, 2],
        defaultSettings: { accountId: 'guest-acc', pair: 'EUR/USD', entry: 'Market', risk: 1, stoploss: 'Sessions High/Low', takeprofit: 'Fractal' },
        notes: [],
        stoplosses: ['Session High/Low', 'FVG', 'Fractal'],
        takeprofits: ['Session High/Low', 'FVG', 'Fractal'],
        closeTypes: ['SL Hit', 'TP Hit', 'Manual'],
        analysisTimeframes: [...defaultTimeframes],
      };
      return { 
        ...state, 
        isGuest: true, 
        isLoading: false,
        currentUser: { id: 'guest', email: 'guest@example.com' } as any, 
        userData: guestData,
        hasMoreTrades: false,
        isFetchingMore: false,
        hasMoreNotes: false,
        isFetchingMoreNotes: false,
        syncStatus: 'online', // Guest mode is always online
      };
    case 'UPDATE_TRADES':
      return state.userData ? { ...state, userData: { ...state.userData, trades: action.payload } } : state;
    case 'UPDATE_ACCOUNTS':
      return state.userData ? { ...state, userData: { ...state.userData, accounts: action.payload } } : state;
    case 'UPDATE_NOTES':
      return state.userData ? { ...state, userData: { ...state.userData, notes: action.payload } } : state;
    case 'UPDATE_USER_DATA_FIELD':
        if (!state.userData) return state;
        return {
            ...state,
            userData: {
                ...state.userData,
                [action.payload.field]: action.payload.value
            }
        };
    case 'FETCH_MORE_TRADES_START':
        return { ...state, isFetchingMore: true };
    case 'FETCH_MORE_TRADES_SUCCESS':
        if (!state.userData) return state;
        return {
            ...state,
            userData: {
                ...state.userData,
                trades: [
                    ...state.userData.trades,
                    ...action.payload.trades.filter(
                        (newTrade) => !state.userData!.trades.some((existing) => existing.id === newTrade.id)
                    ),
                ],
            },
            isFetchingMore: false,
            hasMoreTrades: action.payload.hasMore,
        };
    case 'FETCH_MORE_NOTES_START':
        return { ...state, isFetchingMoreNotes: true };
    case 'FETCH_MORE_NOTES_SUCCESS':
        if (!state.userData) return state;
        return {
            ...state,
            userData: {
                ...state.userData,
                notes: [
                    ...state.userData.notes,
                    ...action.payload.notes.filter(
                        (newNote) => !state.userData!.notes.some((existing) => existing.id === newNote.id)
                    ),
                ],
            },
            isFetchingMoreNotes: false,
            hasMoreNotes: action.payload.hasMore,
        };
    case 'SHOW_TOAST':
        const newToast = { ...action.payload, id: Date.now() };
        const updatedToasts = [newToast, ...state.toasts].slice(0, 5); // Keep a max of 5 toasts
        return { ...state, toasts: updatedToasts };
    case 'HIDE_TOAST':
        return { 
            ...state, 
            toasts: state.toasts.filter(toast => toast.id !== action.payload) 
        };
    case 'SET_SYNC_STATUS':
        return { ...state, syncStatus: action.payload };
    default:
      return state;
  }
};

// --- CONTEXT AND PROVIDER ---

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      dispatch({ type: 'SET_SESSION', payload: session });
      // This is the key fix: only stop loading after the initial check is complete.
      if (!session) {
          dispatch({ type: 'SET_IS_LOADING', payload: false });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentSession = state.session;
        if (session?.user.id !== currentSession?.user.id) {
            await clearAllData();
        }
        dispatch({ type: 'SET_SESSION', payload: session });
        if (!session) {
          dispatch({ type: 'SET_IS_LOADING', payload: false });
        }
      }
    );

    // Online/Offline listeners
    const handleOnline = () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'online' });
    const handleOffline = () => dispatch({ type: 'SET_SYNC_STATUS', payload: 'offline' });

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// --- HOOK ---

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// --- ASYNC ACTIONS ---

export const saveSettingsAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    settings: Partial<Omit<UserData, 'trades' | 'accounts' | 'notes'>>
) => {
    const { userData, currentUser, syncStatus, isGuest } = state;
    if (!userData || !currentUser || isGuest) return;

    // Optimistically update UI
    for (const [key, value] of Object.entries(settings)) {
        dispatch({ type: 'UPDATE_USER_DATA_FIELD', payload: { field: key as any, value }});
    }

    const allSettingsData = { ...userData, ...settings };
    // Remove data that is not part of settings
    delete (allSettingsData as any).trades;
    delete (allSettingsData as any).accounts;
    delete (allSettingsData as any).notes;

    // Update local DB
    await bulkPut('settings', [{ id: 'user-settings', data: allSettingsData }]);
    
    // Add to sync queue
    await putSyncQueue({
        id: crypto.randomUUID(),
        type: 'settings',
        action: 'update',
        payload: allSettingsData,
        timestamp: Date.now()
    });

    if (syncStatus === 'online') {
        window.dispatchEvent(new CustomEvent('sync-request'));
    }
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Settings saved locally.', type: 'success' } });
};


export const saveTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string },
  isEditing: boolean
) => {
    const { userData, currentUser, isGuest, syncStatus } = state;
    if (!userData || !currentUser) throw new Error('User data not available');
    
    if (isGuest) {
      // Guest logic:
      const account = userData.accounts.find(acc => acc.id === tradeData.accountId);
      if (!account) throw new Error("Account not found");
      const riskAmount = (account.initialBalance * tradeData.risk) / 100;
      let pnl = 0;
      if(tradeData.result === Result.Win) pnl = riskAmount * tradeData.rr;
      if(tradeData.result === Result.Loss) pnl = -riskAmount;
      pnl -= (tradeData.commission || 0);

      const tradeId = isEditing ? tradeData.id! : crypto.randomUUID();
      const finalTrade: Trade = { ...tradeData, id: tradeId, pnl, riskAmount };
      const updatedTrades = isEditing
        ? userData.trades.map(t => t.id === tradeId ? finalTrade : t)
        : [finalTrade, ...userData.trades];
      dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
      dispatch({ type: 'SHOW_TOAST', payload: { message: `Trade ${isEditing ? 'updated' : 'added'} in guest mode.`, type: 'success' } });
      return;
    }
    
    // --- Offline-First Logic ---
    const account = userData.accounts.find(acc => acc.id === tradeData.accountId);
    if (!account) throw new Error("Account not found");

    const riskAmount = (account.initialBalance * tradeData.risk) / 100;
    let pnl = 0;
    if(tradeData.result === Result.Win) pnl = riskAmount * tradeData.rr;
    if(tradeData.result === Result.Loss) pnl = -riskAmount;
    pnl -= (tradeData.commission || 0);

    const tradeId = isEditing ? tradeData.id! : crypto.randomUUID();
    const finalTrade: Trade = { ...tradeData, id: tradeId, pnl, riskAmount };

    const updatedTrades = isEditing
        ? userData.trades.map(t => t.id === tradeId ? finalTrade : t)
        : [finalTrade, ...userData.trades];
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    await bulkPut('trades', [finalTrade]);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'trade', action: isEditing ? 'update' : 'create', payload: finalTrade, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Trade ${isEditing ? 'updated' : 'added'} locally.`, type: 'success' } });
};

export const deleteTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string
) => {
    const { userData, isGuest, syncStatus } = state;
    if (!userData) throw new Error('User data not available');
    
    if (isGuest) {
      const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
      dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
      dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted in guest mode.', type: 'success' } });
      return;
    }

    const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    await bulkPut('trades', updatedTrades); // This re-saves the whole array, effectively deleting the item
    await putSyncQueue({ id: crypto.randomUUID(), type: 'trade', action: 'delete', payload: { id: tradeId }, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted locally.', type: 'success' } });
};

export const updateTradeWithAIAnalysisAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string,
  analysisText: string
) => {
    const { userData, syncStatus } = state;
    if (!userData) throw new Error('User data not available');
    
    const tradeToUpdate = userData.trades.find(t => t.id === tradeId);
    if (!tradeToUpdate) throw new Error("Trade not found");
    
    const updatedTrade: Trade = { ...tradeToUpdate, aiAnalysis: analysisText };
    const updatedTrades = userData.trades.map(t => t.id === tradeId ? updatedTrade : t);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    await bulkPut('trades', [updatedTrade]);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'trade', action: 'update', payload: updatedTrade, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
};

// --- ACCOUNT ACTIONS ---
export const saveAccountAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    accountData: Omit<Account, 'id'> & { id?: string },
    isEditing: boolean
) => {
    const { userData, syncStatus } = state;
    if (!userData) throw new Error('User data not available');

    const accountId = isEditing ? accountData.id! : crypto.randomUUID();
    const finalAccount: Account = { ...accountData, id: accountId };

    const updatedAccounts = isEditing
        ? userData.accounts.map(a => a.id === accountId ? finalAccount : a)
        : [...userData.accounts, finalAccount];
    
    dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
    await bulkPut('accounts', [finalAccount]);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'account', action: isEditing ? 'update' : 'create', payload: finalAccount, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Account ${isEditing ? 'updated' : 'saved'} locally.`, type: 'success' } });
};

export const deleteAccountAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    accountId: string
) => {
    const { userData, syncStatus } = state;
    if (!userData) throw new Error('User data not available');

    const updatedAccounts = userData.accounts.filter(a => a.id !== accountId);
    dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
    await bulkPut('accounts', updatedAccounts);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'account', action: 'delete', payload: { id: accountId }, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account deleted locally.', type: 'success' } });
};

// --- NOTE ACTIONS ---
export const saveNoteAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    noteData: Omit<Note, 'id'> & { id?: string },
    isEditing: boolean
) => {
    const { userData, syncStatus } = state;
    if (!userData) throw new Error('User data not available');

    const noteId = isEditing ? noteData.id! : crypto.randomUUID();
    const finalNote: Note = { ...noteData, id: noteId };

    const updatedNotes = isEditing
        ? userData.notes.map(n => n.id === noteId ? finalNote : n)
        : [finalNote, ...userData.notes];
    
    dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
    await bulkPut('notes', [finalNote]);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'note', action: isEditing ? 'update' : 'create', payload: finalNote, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Note ${isEditing ? 'updated' : 'saved'} locally.`, type: 'success' } });
    return finalNote;
};

export const deleteNoteAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    noteId: string
) => {
    const { userData, syncStatus } = state;
    if (!userData) throw new Error('User data not available');
    
    const updatedNotes = userData.notes.filter(n => n.id !== noteId);
    dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
    await bulkPut('notes', updatedNotes);
    await putSyncQueue({ id: crypto.randomUUID(), type: 'note', action: 'delete', payload: { id: noteId }, timestamp: Date.now() });

    if (syncStatus === 'online') { window.dispatchEvent(new CustomEvent('sync-request')); }
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted locally.', type: 'success' } });
};

// --- PAGINATION ACTIONS ---
export const fetchMoreNotesAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    pageSize: number
) => {
    const { currentUser, userData, isGuest, syncStatus } = state;
    if (isGuest || !currentUser || !userData || syncStatus === 'offline') return;

    dispatch({ type: 'FETCH_MORE_NOTES_START' });
    try {
        const { data, error } = await supabase
            .from('notes')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('date', { ascending: false })
            .range(userData.notes.length, userData.notes.length + pageSize - 1);
        
        if (error) throw error;

        const newNotes = data as Note[];
        await bulkPut('notes', newNotes);
        dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: newNotes, hasMore: newNotes.length === pageSize } });

    } catch (error) {
        console.error("Failed to fetch more notes:", error);
        dispatch({ type: 'FETCH_MORE_NOTES_START' }); // Reset loading state on error
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Could not load more notes.', type: 'error' } });
    }
};