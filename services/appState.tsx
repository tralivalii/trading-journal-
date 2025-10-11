// services/appState.tsx

import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Account, Note, Result, Trade, UserData, Currency } from '../types';
import { supabase } from './supabase';
import { bulkGet, bulkPut, clearAllData, getSyncQueue, getTable, putSyncQueue } from './offlineService';

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
  toast: Toast | null;
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
  | { type: 'SHOW_TOAST'; payload: Omit<Toast, 'id'> }
  | { type: 'HIDE_TOAST' }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus };


// --- REDUCER ---

const initialState: AppState = {
  session: null,
  currentUser: null,
  userData: null,
  isLoading: true,
  isGuest: false,
  hasMoreTrades: false,
  isFetchingMore: false,
  toast: null,
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
      return { ...state, userData: action.payload };
    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_GUEST_MODE':
      const guestData: UserData = {
        trades: [],
        accounts: [{ id: 'guest-acc', name: 'Guest Account', initialBalance: 100000, currency: Currency.USD, isArchived: false }],
        pairs: ['EUR/USD', 'GBP/USD', 'XAU/USD', 'BTC/USDT'],
        entries: ['Market', 'Order Block', 'FVG'],
        risks: [0.5, 1, 1.5, 2],
        defaultSettings: { accountId: 'guest-acc', pair: 'EUR/USD', entry: 'Market', risk: 1 },
        notes: [],
        stoplosses: ['Session High/Low', 'FVG'],
        takeprofits: ['Session High/Low', 'FVG'],
        closeTypes: ['SL Hit', 'TP Hit', 'Manual'],
      };
      return { 
        ...state, 
        isGuest: true, 
        isLoading: false,
        currentUser: { id: 'guest', email: 'guest@example.com' } as any, 
        userData: guestData,
        hasMoreTrades: false,
        isFetchingMore: false,
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
    case 'SHOW_TOAST':
        return { ...state, toast: { ...action.payload, id: Date.now() } };
    case 'HIDE_TOAST':
        return { ...state, toast: null };
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
      if (!session) {
          dispatch({ type: 'SET_IS_LOADING', payload: false });
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
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

const mapTradeFromDb = (t: any): Trade => ({
    ...t,
    accountId: t.account_id,
    riskAmount: t.risk_amount,
    closeType: t.close_type,
    analysisD1: t.analysis_d1,
    analysis1h: t.analysis_1h,
    analysis5m: t.analysis_5m,
    analysisResult: t.analysis_result,
    aiAnalysis: t.ai_analysis,
});

export const saveTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string },
  isEditing: boolean
) => {
    const { userData, currentUser, isGuest, syncStatus } = state;
    if (!userData || !currentUser) throw new Error('User data not available');
    
    // Server logic will handle calculations, so we can stub this for guest mode
    if (isGuest) {
        // ... (Guest mode logic remains the same)
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

    // 1. Immediately update UI state
    const updatedTrades = isEditing
        ? userData.trades.map(t => t.id === tradeId ? finalTrade : t)
        : [finalTrade, ...userData.trades];
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });

    // 2. Save to IndexedDB
    await bulkPut('trades', [finalTrade]);
    
    // 3. Add to sync queue
    await putSyncQueue({
        id: crypto.randomUUID(),
        type: 'trade',
        action: isEditing ? 'update' : 'create',
        payload: finalTrade,
        timestamp: Date.now(),
    });

    if (syncStatus === 'online') {
        // Trigger sync in background
        window.dispatchEvent(new CustomEvent('sync-request'));
    }
    
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
        // ... (Guest mode logic remains the same)
        return;
    }

    // 1. Immediately update UI state
    const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });

    // 2. Delete from IndexedDB (or mark as deleted)
    await bulkPut('trades', updatedTrades);

    // 3. Add to sync queue
    await putSyncQueue({
        id: crypto.randomUUID(),
        type: 'trade',
        action: 'delete',
        payload: { id: tradeId },
        timestamp: Date.now(),
    });

    if (syncStatus === 'online') {
        window.dispatchEvent(new CustomEvent('sync-request'));
    }
    
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted locally.', type: 'success' } });
};

export const updateTradeWithAIAnalysisAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string,
  analysisText: string
) => {
    const { userData } = state;
    if (!userData) throw new Error('User data not available');
    
    const tradeToUpdate = userData.trades.find(t => t.id === tradeId);
    if (!tradeToUpdate) throw new Error("Trade not found");
    
    const updatedTrade: Trade = { ...tradeToUpdate, aiAnalysis: analysisText };

    // 1. Update UI
    const updatedTrades = userData.trades.map(t => t.id === tradeId ? updatedTrade : t);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    
    // 2. Update IndexedDB
    await bulkPut('trades', [updatedTrade]);
    
    // 3. Add to sync queue
     await putSyncQueue({
        id: crypto.randomUUID(),
        type: 'trade',
        action: 'update',
        payload: updatedTrade,
        timestamp: Date.now(),
    });

    if (state.syncStatus === 'online') {
        window.dispatchEvent(new CustomEvent('sync-request'));
    }
};