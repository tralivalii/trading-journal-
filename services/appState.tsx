import React, { createContext, useReducer, useContext, Dispatch, ReactNode, useEffect } from 'react';
import { UserData, User, Trade, Note, Account, DefaultSettings, Analysis } from '../types';
import { supabase } from './supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';


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
  | { type: 'UPDATE_TRADES'; payload: Trade[] }
  | { type: 'UPDATE_ACCOUNTS'; payload: Account[] }
  | { type: 'UPDATE_NOTES'; payload: Note[] }
  | { type: 'UPDATE_USER_DATA_FIELD'; payload: { field: keyof UserData, value: any } }
  | { type: 'SET_GUEST_MODE'; payload: boolean };


// --- INITIAL STATE ---

const initialState: AppState = {
    session: null,
    currentUser: null,
    userData: null,
    isLoading: true,
    isGuest: false,
};

// --- REDUCER ---

const appReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'SET_SESSION':
            return {
                ...state,
                session: action.payload,
                currentUser: action.payload?.user ?? null,
                isGuest: false, // Logging in or out exits guest mode
            };
        case 'SET_GUEST_MODE':
            return {
                ...state,
                isGuest: action.payload,
                session: null,
                currentUser: null,
                userData: null, // Force a reload of data for guest/user
                isLoading: true,
            };
        case 'SET_USER_DATA':
             return {
                ...state,
                userData: action.payload
            };
        case 'SET_IS_LOADING':
            return {
                ...state,
                isLoading: action.payload,
            };
        case 'UPDATE_TRADES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: action.payload } };
        case 'UPDATE_ACCOUNTS':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, accounts: action.payload } };
        case 'UPDATE_NOTES':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: action.payload } };
        case 'UPDATE_USER_DATA_FIELD':
            if (!state.userData) return state;
            return {
                ...state,
                userData: {
                    ...state.userData,
                    [action.payload.field]: action.payload.value,
                },
            };
        default:
            return state;
    }
};

// --- CONTEXT AND PROVIDER ---

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> }>({
    state: initialState,
    dispatch: () => null,
});

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const getSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            dispatch({ type: 'SET_SESSION', payload: session });
            if (!session) {
                dispatch({ type: 'SET_IS_LOADING', payload: false });
            }
        }
        
        getSession();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            dispatch({ type: 'SET_SESSION', payload: session });
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
};

// --- CUSTOM HOOK ---

export const useAppContext = () => useContext(AppContext);

// --- HELPER ACTIONS ---
export const saveTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeToSave: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }, isEditing: boolean) => {
    if (!state.userData) return;
    const { accounts, trades } = state.userData;

    const account = accounts.find(a => a.id === tradeToSave.accountId);
    if (!account) throw new Error("Account not found");

    const accountTrades = trades.filter(t => t.accountId === account.id && t.id !== tradeToSave.id);
    const accountPnl = accountTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const currentBalance = account.initialBalance + accountPnl;
    
    const riskAmount = currentBalance * (tradeToSave.risk / 100);
    const commission = tradeToSave.commission || 0;
    let pnl = 0;
    if (tradeToSave.result === 'Win') pnl = riskAmount * tradeToSave.rr;
    else if (tradeToSave.result === 'Loss') pnl = -riskAmount;
    const finalPnl = pnl - commission;

    // --- Guest Mode Logic ---
    if (state.isGuest) {
        if (isEditing && tradeToSave.id) {
            const updatedTrade: Trade = { ...tradeToSave as Trade, id: tradeToSave.id, riskAmount, pnl: finalPnl };
            const updatedTrades = trades.map(t => t.id === tradeToSave.id ? updatedTrade : t);
            dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
        } else {
            const newTrade: Trade = {
                id: crypto.randomUUID(),
                ...tradeToSave,
                riskAmount,
                pnl: finalPnl
            };
            dispatch({ type: 'UPDATE_TRADES', payload: [...trades, newTrade] });
        }
        return;
    }

    // --- Supabase Logic ---
    if (!state.currentUser) return;
    
    const tradeForDb = {
        user_id: state.currentUser.id,
        account_id: tradeToSave.accountId,
        date: tradeToSave.date,
        pair: tradeToSave.pair,
        direction: tradeToSave.direction,
        entry: tradeToSave.entry,
        risk: tradeToSave.risk,
        rr: tradeToSave.rr,
        risk_amount: riskAmount,
        pnl: finalPnl,
        commission: commission,
        stoploss: tradeToSave.stoploss,
        takeprofit: tradeToSave.takeprofit,
        result: tradeToSave.result,
        entry_price: tradeToSave.entryPrice,
        stoploss_price: tradeToSave.stoplossPrice,
        takeprofit_price: tradeToSave.takeprofitPrice,
        close_type: tradeToSave.closeType,
        analysis_d1: tradeToSave.analysisD1,
        analysis_1h: tradeToSave.analysis1h,
        analysis_5m: tradeToSave.analysis5m,
        analysis_result: tradeToSave.analysisResult,
    };

    if (isEditing && tradeToSave.id) {
        const { data, error } = await supabase.from('trades').update(tradeForDb).eq('id', tradeToSave.id).select().single();
        if (error) throw error;
        
        const updatedTrades = trades.map(t => t.id === data.id ? { ...t, ...tradeToSave, riskAmount, pnl: finalPnl } : t);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    } else {
        const { data, error } = await supabase.from('trades').insert(tradeForDb).select().single();
        if (error) throw error;

        const newTrade: Trade = {
            id: data.id,
            ...tradeToSave,
            riskAmount,
            pnl: finalPnl
        };
        dispatch({ type: 'UPDATE_TRADES', payload: [...trades, newTrade] });
    }
};

export const deleteTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeIdToDelete: string) => {
    if (!state.userData) return;
    const { trades } = state.userData;

    // --- Guest Mode Logic ---
    if (state.isGuest) {
        const tradeToDelete = trades.find(t => t.id === tradeIdToDelete);
        if (tradeToDelete) {
             const imageKeys: (string | undefined)[] = [
                tradeToDelete.analysisD1.image,
                tradeToDelete.analysis1h.image,
                tradeToDelete.analysis5m.image,
                tradeToDelete.analysisResult.image,
            ];
            imageKeys.forEach(key => {
                if (key && key.startsWith('blob:')) {
                    URL.revokeObjectURL(key);
                }
            });
        }
        const newTrades = trades.filter(trade => trade.id !== tradeIdToDelete);
        dispatch({ type: 'UPDATE_TRADES', payload: newTrades });
        return;
    }

    // --- Supabase Logic ---
    if (!state.currentUser) return;
    
    const tradeToDelete = trades.find(t => t.id === tradeIdToDelete);
    if (tradeToDelete) {
        const imageKeys: string[] = [
            tradeToDelete.analysisD1.image,
            tradeToDelete.analysis1h.image,
            tradeToDelete.analysis5m.image,
            tradeToDelete.analysisResult.image,
        ].filter((key): key is string => !!key);

        if (imageKeys.length > 0) {
            const filePaths = imageKeys.map(key => `${state.currentUser.id}/${key}`);
            const { error: storageError } = await supabase.storage.from('screenshots').remove(filePaths);
            if (storageError) console.error("Error deleting images from Supabase Storage:", storageError);
        }
    }
    
    const { error } = await supabase.from('trades').delete().eq('id', tradeIdToDelete);
    if (error) throw error;

    const newTrades = trades.filter(trade => trade.id !== tradeIdToDelete);
    dispatch({ type: 'UPDATE_TRADES', payload: newTrades });
};