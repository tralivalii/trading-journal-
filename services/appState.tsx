// services/appState.tsx

import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Account, Note, Result, Trade, UserData } from '../types';
import { supabase } from './supabase';

// --- STATE AND ACTION TYPES ---

interface AppState {
  session: Session | null;
  currentUser: SupabaseUser | null;
  userData: UserData | null;
  isLoading: boolean;
  isGuest: boolean;
}

type Action =
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_USER_DATA'; payload: UserData | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_GUEST_MODE' }
  | { type: 'UPDATE_TRADES'; payload: Trade[] }
  | { type: 'UPDATE_ACCOUNTS'; payload: Account[] }
  | { type: 'UPDATE_NOTES'; payload: Note[] }
  | { type: 'UPDATE_USER_DATA_FIELD'; payload: { field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>; value: any } };

// --- REDUCER ---

const initialState: AppState = {
  session: null,
  currentUser: null,
  userData: null,
  isLoading: true,
  isGuest: false,
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
        accounts: [{ id: 'guest-acc', name: 'Guest Account', initialBalance: 100000, currency: 'USD', isArchived: false }],
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
        userData: guestData
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
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        dispatch({ type: 'SET_SESSION', payload: session });
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

const calculatePnl = (trade: Omit<Trade, 'id' | 'pnl' | 'riskAmount'>, account: Account): { pnl: number, riskAmount: number } => {
    const accountBalance = account.initialBalance; // Simplified to use initial balance for risk calculation.
    
    if (trade.result === Result.InProgress || trade.result === Result.Missed) {
        return { pnl: 0, riskAmount: (accountBalance * trade.risk) / 100 };
    }

    const riskAmount = (accountBalance * trade.risk) / 100;
    let pnl = 0;

    switch (trade.result) {
        case Result.Win:
            pnl = riskAmount * trade.rr;
            break;
        case Result.Loss:
            pnl = -riskAmount;
            break;
        case Result.Breakeven:
            pnl = 0;
            break;
    }
    
    // Subtract commission
    pnl -= (trade.commission || 0);

    return { pnl, riskAmount };
};


export const saveTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string },
  isEditing: boolean,
  showToast: (message: string, type?: 'success' | 'error') => void,
) => {
    const { userData, currentUser, isGuest } = state;
    if (!userData || !currentUser) throw new Error('User data not available');

    const account = userData.accounts.find(acc => acc.id === tradeData.accountId);
    if (!account) {
        showToast('Selected account not found.', 'error');
        throw new Error('Account not found');
    }

    const { pnl, riskAmount } = calculatePnl(tradeData, account);
    
    const finalTradeData = { ...tradeData, pnl, riskAmount };

    if (isGuest) {
        const updatedTrades = isEditing
            ? userData.trades.map(t => t.id === tradeData.id ? { ...finalTradeData, id: tradeData.id! } : t)
            : [...userData.trades, { ...finalTradeData, id: `guest-${crypto.randomUUID()}` }];
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
        showToast(isEditing ? 'Trade updated (Guest Mode).' : 'Trade added (Guest Mode).', 'success');
        return;
    }

    const { id, ...dbPayload } = finalTradeData;

    // Map to snake_case for Supabase
    const supabasePayload = {
      ...dbPayload,
      user_id: currentUser.id,
      account_id: dbPayload.accountId,
      risk_amount: dbPayload.riskAmount,
      close_type: dbPayload.closeType,
      analysis_d1: dbPayload.analysisD1,
      analysis_1h: dbPayload.analysis1h,
      analysis_5m: dbPayload.analysis5m,
      analysis_result: dbPayload.analysisResult,
    };
    // remove camelCase keys from the root object to avoid inserting them as columns
    delete (supabasePayload as any).accountId;
    delete (supabasePayload as any).riskAmount;
    delete (supabasePayload as any).closeType;
    delete (supabasePayload as any).analysisD1;
    delete (supabasePayload as any).analysis1h;
    delete (supabasePayload as any).analysis5m;
    delete (supabasePayload as any).analysisResult;


    if (isEditing) {
        const { data, error } = await supabase.from('trades').update(supabasePayload).eq('id', id!).select().single();
        if (error) throw error;
        const updatedTrade = { ...data, accountId: data.account_id, riskAmount: data.risk_amount, closeType: data.close_type, analysisD1: data.analysis_d1, analysis1h: data.analysis_1h, analysis5m: data.analysis_5m, analysisResult: data.analysis_result };
        const updatedTrades = userData.trades.map(t => t.id === id ? updatedTrade : t);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    } else {
        const { data, error } = await supabase.from('trades').insert(supabasePayload).select().single();
        if (error) throw error;
        const newTrade = { ...data, accountId: data.account_id, riskAmount: data.risk_amount, closeType: data.close_type, analysisD1: data.analysis_d1, analysis1h: data.analysis_1h, analysis5m: data.analysis_5m, analysisResult: data.analysis_result };
        const updatedTrades = [...userData.trades, newTrade];
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    }
};

export const deleteTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string,
  showToast: (message: string, type?: 'success' | 'error') => void,
) => {
    const { userData, isGuest } = state;
    if (!userData) throw new Error('User data not available');
    
    if (isGuest) {
        const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
        showToast('Trade deleted (Guest Mode).', 'success');
        return;
    }

    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) throw error;

    const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
};
