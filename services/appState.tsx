// services/appState.tsx

import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
// FIX: Added 'Currency' to import to resolve type error.
import { Account, Note, Result, Trade, UserData, Currency } from '../types';
import { supabase } from './supabase';

// --- STATE AND ACTION TYPES ---

interface Toast {
    message: string;
    type: 'success' | 'error';
    id: number;
}

interface AppState {
  session: Session | null;
  currentUser: SupabaseUser | null;
  userData: UserData | null;
  isLoading: boolean;
  isGuest: boolean;
  hasMoreTrades: boolean;
  isFetchingMore: boolean;
  toast: Toast | null;
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
  | { type: 'HIDE_TOAST' };


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
      // Create some default guest data so the app is usable
      const guestData: UserData = {
        trades: [],
        // FIX: Corrected currency assignment to use the Currency enum instead of a string literal.
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
        currentUser: { id: 'guest', email: 'guest@example.com' } as any, // Mock user for guest mode
        userData: guestData,
        hasMoreTrades: false,
        isFetchingMore: false,
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
                // Append new trades, avoiding duplicates
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
      (_event, session) => {
        dispatch({ type: 'SET_SESSION', payload: session });
         if (!session) {
          dispatch({ type: 'SET_IS_LOADING', payload: false });
        }
      }
    );

    return () => {
      authListener.subscription.unsubscribe();
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

export const saveTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string },
  isEditing: boolean
) => {
    const { userData, currentUser, isGuest } = state;
    if (!userData || !currentUser) throw new Error('User data not available');
    
    // Server logic will handle calculations, so we can stub this for guest mode
    if (isGuest) {
        const account = userData.accounts.find(acc => acc.id === tradeData.accountId);
        if (!account) throw new Error("Guest account not found");
        const riskAmount = (account.initialBalance * tradeData.risk) / 100;
        let pnl = 0;
        if(tradeData.result === Result.Win) pnl = riskAmount * tradeData.rr;
        if(tradeData.result === Result.Loss) pnl = -riskAmount;
        pnl -= (tradeData.commission || 0);

        const finalTradeData = { ...tradeData, pnl, riskAmount };
        const updatedTrades = isEditing
            ? userData.trades.map(t => t.id === tradeData.id ? { ...finalTradeData, id: tradeData.id! } : t)
            : [...userData.trades, { ...finalTradeData, id: `guest-${crypto.randomUUID()}` }];
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
        dispatch({ type: 'SHOW_TOAST', payload: { message: isEditing ? 'Trade updated (Guest Mode).' : 'Trade added (Guest Mode).', type: 'success' } });
        return;
    }

    const { id, ...dbPayload } = tradeData;

    // Map to snake_case for Supabase
    const supabasePayload = {
      ...dbPayload,
      user_id: currentUser.id,
      account_id: dbPayload.accountId,
      close_type: dbPayload.closeType,
      analysis_d1: dbPayload.analysisD1,
      analysis_1h: dbPayload.analysis1h,
      analysis_5m: dbPayload.analysis5m,
      analysis_result: dbPayload.analysisResult,
      // pnl and risk_amount are calculated by the DB trigger, so we don't send them
    };
    // remove camelCase keys from the root object to avoid inserting them as columns
    delete (supabasePayload as any).accountId;
    delete (supabasePayload as any).closeType;
    delete (supabasePayload as any).analysisD1;
    delete (supabasePayload as any).analysis1h;
    delete (supabasePayload as any).analysis5m;
    delete (supabasePayload as any).analysisResult;


    if (isEditing) {
        const { data, error } = await supabase.from('trades').update(supabasePayload).eq('id', id!).select().single();
        if (error) throw error;
        // The returned `data` will have the server-calculated pnl and risk_amount
        const updatedTrade = { ...data, accountId: data.account_id, riskAmount: data.risk_amount, closeType: data.close_type, analysisD1: data.analysis_d1, analysis1h: data.analysis_1h, analysis5m: data.analysis_5m, analysisResult: data.analysis_result };
        const updatedTrades = userData.trades.map(t => t.id === id ? updatedTrade : t);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    } else {
        const { data, error } = await supabase.from('trades').insert(supabasePayload).select().single();
        if (error) throw error;
        const newTrade = { ...data, accountId: data.account_id, riskAmount: data.risk_amount, closeType: data.close_type, analysisD1: data.analysis_d1, analysis1h: data.analysis_1h, analysis5m: data.analysis_5m, analysisResult: data.analysis_result };
        // Prepend the new trade to show it at the top of the list immediately
        const updatedTrades = [newTrade, ...userData.trades];
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    }
};

export const deleteTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string
) => {
    const { userData, isGuest } = state;
    if (!userData) throw new Error('User data not available');
    
    if (isGuest) {
        const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted (Guest Mode).', type: 'success' } });
        return;
    }

    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) throw error;

    const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
};