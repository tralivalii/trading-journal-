import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserData, Trade, Account, Note, DefaultSettings, Result } from '../types';
import * as offlineService from './offlineService';

// --- STATE AND ACTION TYPES ---

interface AppState {
    session: Session | null;
    currentUser: Session['user'] | null;
    isLoading: boolean;
    isGuest: boolean;
    userData: UserData | null;
    toast: { message: string, type: 'success' | 'error' } | null;
    syncStatus: 'online' | 'offline' | 'syncing';
    hasMoreTrades: boolean;
    isFetchingMoreTrades: boolean;
    hasMoreNotes: boolean;
    isFetchingMoreNotes: boolean;
}

type AppAction =
    | { type: 'INITIALIZE_SESSION'; payload: { session: Session | null } }
    | { type: 'SET_GUEST_MODE' }
    | { type: 'SET_USER_DATA'; payload: UserData | null }
    | { type: 'FINISH_LOADING' } // New action to explicitly stop loading
    | { type: 'SHOW_TOAST'; payload: { message: string, type: 'success' | 'error' } }
    | { type: 'HIDE_TOAST' }
    | { type: 'SAVE_TRADE_SUCCESS'; payload: { trade: Trade, isEditing: boolean } }
    | { type: 'DELETE_TRADE_SUCCESS'; payload: string }
    | { type: 'SAVE_ACCOUNT_SUCCESS'; payload: { account: Account, isEditing: boolean } }
    | { type: 'DELETE_ACCOUNT_SUCCESS'; payload: string }
    | { type: 'SAVE_NOTE_SUCCESS'; payload: { note: Note, isEditing: boolean } }
    | { type: 'DELETE_NOTE_SUCCESS'; payload: string }
    | { type: 'SAVE_SETTINGS_SUCCESS'; payload: Partial<UserData> }
    | { type: 'SET_SYNC_STATUS'; payload: AppState['syncStatus'] }
    | { type: 'FETCH_MORE_TRADES_START' }
    | { type: 'FETCH_MORE_TRADES_SUCCESS'; payload: { trades: Trade[], hasMore: boolean } }
    | { type: 'FETCH_MORE_NOTES_START' }
    | { type: 'FETCH_MORE_NOTES_SUCCESS'; payload: { notes: Note[], hasMore: boolean } }
    | { type: 'UPDATE_TRADE_AI_ANALYSIS'; payload: { tradeId: string, analysis: string } };

// --- INITIAL STATE ---

const initialDefaultSettings: DefaultSettings = {
    accountId: '',
    pair: 'EUR/USD',
    entry: 'Break & Retest',
    risk: 1,
    stoploss: 'Structure',
    takeprofit: 'Structure',
};

const initialUserData: UserData = {
    trades: [],
    accounts: [],
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD'],
    entries: ['Break & Retest', 'Continuation', 'Reversal', 'Range'],
    risks: [0.25, 0.5, 1, 1.5, 2],
    defaultSettings: initialDefaultSettings,
    notes: [],
    stoplosses: ['Structure', 'Fibonacci', 'Fixed Pips', 'ATR', 'Fractal'],
    takeprofits: ['Structure', 'Fibonacci', 'Fixed Pips', 'ATR', 'Fractal'],
    closeTypes: ['TP Hit', 'SL Hit', 'Manual', 'Breakeven'],
    analysisTimeframes: ['1D', '1h', '5m', 'Result'],
};

const initialState: AppState = {
    session: null,
    currentUser: null,
    isLoading: true,
    isGuest: false,
    userData: null,
    toast: null,
    syncStatus: navigator.onLine ? 'online' : 'offline',
    hasMoreTrades: true,
    isFetchingMoreTrades: false,
    hasMoreNotes: true,
    isFetchingMoreNotes: false,
};

// --- REDUCER ---

const appReducer = (state: AppState, action: AppAction): AppState => {
    switch (action.type) {
        case 'INITIALIZE_SESSION':
            return {
                ...state,
                session: action.payload.session,
                currentUser: action.payload.session?.user ?? null,
                isGuest: false,
            };
        case 'FINISH_LOADING':
            return { ...state, isLoading: false };
        case 'SET_GUEST_MODE':
            return {
                ...state,
                isLoading: false,
                isGuest: true,
                userData: initialUserData,
            };
        case 'SET_USER_DATA': {
            const incomingUserData = action.payload;

            if (incomingUserData === null) {
                return { ...state, userData: null };
            }

            // If we have user data, merge it safely with defaults
            // This ensures that if a user's saved settings are missing a new field,
            // the app doesn't crash.
            const safeUserData: UserData = {
                ...initialUserData,
                ...incomingUserData,
                defaultSettings: {
                    ...initialUserData.defaultSettings,
                    ...(incomingUserData.defaultSettings || {}),
                },
                // Ensure all arrays exist
                analysisTimeframes: incomingUserData.analysisTimeframes || initialUserData.analysisTimeframes,
                pairs: incomingUserData.pairs || initialUserData.pairs,
                entries: incomingUserData.entries || initialUserData.entries,
                risks: incomingUserData.risks || initialUserData.risks,
                stoplosses: incomingUserData.stoplosses || initialUserData.stoplosses,
                takeprofits: incomingUserData.takeprofits || initialUserData.takeprofits,
                closeTypes: incomingUserData.closeTypes || initialUserData.closeTypes,
                // Ensure top-level arrays also exist
                trades: incomingUserData.trades || [],
                accounts: incomingUserData.accounts || [],
                notes: incomingUserData.notes || [],
            };
            return { ...state, userData: safeUserData };
        }
        case 'SHOW_TOAST':
            return { ...state, toast: action.payload };
        case 'HIDE_TOAST':
            return { ...state, toast: null };
        case 'SET_SYNC_STATUS':
             return { ...state, syncStatus: action.payload };
        
        case 'SAVE_TRADE_SUCCESS': {
            if (!state.userData) return state;
            const { trade, isEditing } = action.payload;
            const trades = isEditing
                ? state.userData.trades.map(t => t.id === trade.id ? trade : t)
                : [trade, ...state.userData.trades];
            return { ...state, userData: { ...state.userData, trades } };
        }
        case 'DELETE_TRADE_SUCCESS': {
             if (!state.userData) return state;
             const trades = state.userData.trades.filter(t => t.id !== action.payload);
             return { ...state, userData: { ...state.userData, trades } };
        }
        
        case 'SAVE_ACCOUNT_SUCCESS': {
            if (!state.userData) return state;
            const { account, isEditing } = action.payload;
            const accounts = isEditing
                ? state.userData.accounts.map(a => a.id === account.id ? account : a)
                : [...state.userData.accounts, account];
            return { ...state, userData: { ...state.userData, accounts } };
        }
        case 'DELETE_ACCOUNT_SUCCESS': {
             if (!state.userData) return state;
             const accounts = state.userData.accounts.filter(a => a.id !== action.payload);
             const trades = state.userData.trades.filter(t => t.accountId !== action.payload);
             return { ...state, userData: { ...state.userData, accounts, trades } };
        }
        case 'SAVE_NOTE_SUCCESS': {
            if (!state.userData) return state;
            const { note, isEditing } = action.payload;
            const notes = isEditing
                ? state.userData.notes.map(n => n.id === note.id ? note : n)
                : [note, ...state.userData.notes];
            return { ...state, userData: { ...state.userData, notes } };
        }
        case 'DELETE_NOTE_SUCCESS': {
            if (!state.userData) return state;
            const notes = state.userData.notes.filter(n => n.id !== action.payload);
            return { ...state, userData: { ...state.userData, notes } };
        }
        case 'SAVE_SETTINGS_SUCCESS': {
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, ...action.payload } };
        }
        case 'FETCH_MORE_TRADES_START':
            return { ...state, isFetchingMoreTrades: true };
        case 'FETCH_MORE_TRADES_SUCCESS': {
            if (!state.userData) return state;
            const newTrades = action.payload.trades.filter(
                nt => !state.userData!.trades.some(et => et.id === nt.id)
            );
            return {
                ...state,
                isFetchingMoreTrades: false,
                hasMoreTrades: action.payload.hasMore,
                userData: {
                    ...state.userData,
                    trades: [...state.userData.trades, ...newTrades],
                }
            };
        }
        case 'FETCH_MORE_NOTES_START':
            return { ...state, isFetchingMoreNotes: true };
        case 'FETCH_MORE_NOTES_SUCCESS': {
             if (!state.userData) return state;
            const newNotes = action.payload.notes.filter(
                nn => !state.userData!.notes.some(en => en.id === nn.id)
            );
            return {
                ...state,
                isFetchingMoreNotes: false,
                hasMoreNotes: action.payload.hasMore,
                userData: {
                    ...state.userData,
                    notes: [...state.userData.notes, ...newNotes],
                }
            };
        }
        case 'UPDATE_TRADE_AI_ANALYSIS': {
            if (!state.userData) return state;
            const { tradeId, analysis } = action.payload;
            const trades = state.userData.trades.map(t =>
                t.id === tradeId ? { ...t, aiAnalysis: analysis } : t
            );
            return { ...state, userData: { ...state.userData, trades } };
        }
        default:
            return state;
    }
};

// --- CONTEXT ---

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction>; }>({ state: initialState, dispatch: () => null });

// --- ACTION CREATORS ---

const calculatePnlAndRisk = (tradeData: Omit<Trade, 'id' | 'pnl' | 'riskAmount'>, accounts: Account[]): { pnl: number, riskAmount: number } => {
    const account = accounts.find(a => a.id === tradeData.accountId);
    if (!account) return { pnl: 0, riskAmount: 0 };
    
    const riskAmount = account.initialBalance * (tradeData.risk / 100);
    let pnl = 0;

    if (tradeData.result === Result.Win) {
        pnl = riskAmount * tradeData.rr;
    } else if (tradeData.result === Result.Loss) {
        pnl = -riskAmount;
    }
    pnl -= tradeData.commission || 0;
    
    return { pnl: parseFloat(pnl.toFixed(2)), riskAmount: parseFloat(riskAmount.toFixed(2)) };
};

export const saveTradeAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, tradeData: Partial<Trade>, isEditing: boolean) => {
    const { userData, currentUser } = state;
    if (!userData || !currentUser) throw new Error("User data not loaded.");

    const { pnl, riskAmount } = calculatePnlAndRisk(tradeData as any, userData.accounts);
    
    const finalTradeData: Trade = {
        ...tradeData,
        pnl,
        riskAmount,
        id: isEditing ? tradeData.id! : crypto.randomUUID(),
    } as Trade;

    const { error } = await supabase.from('trades').upsert({ ...finalTradeData, user_id: currentUser.id });

    if (error) {
        console.error("Supabase error:", error);
        throw new Error("Failed to save trade to the cloud.");
    }
    
    dispatch({ type: 'SAVE_TRADE_SUCCESS', payload: { trade: finalTradeData, isEditing } });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Trade ${isEditing ? 'updated' : 'added'} successfully.`, type: 'success' } });
};

export const deleteTradeAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, tradeId: string) => {
    const { error } = await supabase.from('trades').delete().match({ id: tradeId, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to delete trade.");
    dispatch({ type: 'DELETE_TRADE_SUCCESS', payload: tradeId });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted.', type: 'success' } });
};

export const saveAccountAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, accountData: Partial<Account>, isEditing: boolean) => {
    const finalAccount: Account = {
        ...accountData,
        id: isEditing ? accountData.id! : crypto.randomUUID(),
    } as Account;
    const { error } = await supabase.from('accounts').upsert({ ...finalAccount, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to save account.");
    dispatch({ type: 'SAVE_ACCOUNT_SUCCESS', payload: { account: finalAccount, isEditing } });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Account ${isEditing ? 'updated' : 'created'}.`, type: 'success' } });
};

export const deleteAccountAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, accountId: string) => {
    const { error } = await supabase.from('accounts').delete().match({ id: accountId, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to delete account.");
    dispatch({ type: 'DELETE_ACCOUNT_SUCCESS', payload: accountId });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account deleted.', type: 'success' } });
};

export const saveSettingsAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, settings: Partial<UserData>) => {
    const { error } = await supabase.from('settings').upsert({ id: state.currentUser!.id, ...settings, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to save settings.");
    dispatch({ type: 'SAVE_SETTINGS_SUCCESS', payload: settings });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Settings saved.', type: 'success' } });
};

export const saveNoteAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, noteData: Omit<Note, 'id'>, isEditing: boolean): Promise<Note> => {
    const finalNote: Note = {
        ...noteData,
        id: isEditing ? (noteData as Note).id : crypto.randomUUID(),
    };
    const { error } = await supabase.from('notes').upsert({ ...finalNote, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to save note.");
    dispatch({ type: 'SAVE_NOTE_SUCCESS', payload: { note: finalNote, isEditing } });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Note ${isEditing ? 'updated' : 'created'}.`, type: 'success' } });
    return finalNote;
};

export const deleteNoteAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, noteId: string) => {
    const { error } = await supabase.from('notes').delete().match({ id: noteId, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to delete note.");
    dispatch({ type: 'DELETE_NOTE_SUCCESS', payload: noteId });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted.', type: 'success' } });
};

export const updateTradeWithAIAnalysisAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, tradeId: string, analysis: string) => {
    const { error } = await supabase.from('trades').update({ aiAnalysis: analysis }).match({ id: tradeId, user_id: state.currentUser!.id });
    if (error) throw new Error("Failed to save AI analysis.");
    dispatch({ type: 'UPDATE_TRADE_AI_ANALYSIS', payload: { tradeId, analysis } });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'AI analysis saved.', type: 'success' } });
};

export const fetchMoreTradesAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, pageSize: number) => {
    dispatch({ type: 'FETCH_MORE_TRADES_START' });
    try {
        const { data, error } = await supabase.from('trades')
            .select('*').eq('user_id', state.currentUser!.id)
            .order('date', { ascending: false })
            .range(state.userData!.trades.length, state.userData!.trades.length + pageSize - 1);
        if (error) throw new Error("Failed to fetch more trades.");
        dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: data || [], hasMore: (data || []).length === pageSize } });
    } catch (e) {
        console.error(e);
        dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: [], hasMore: state.hasMoreTrades } });
    }
};

export const fetchMoreNotesAction = async (dispatch: React.Dispatch<AppAction>, state: AppState, pageSize: number) => {
    dispatch({ type: 'FETCH_MORE_NOTES_START' });
    try {
        const { data, error } = await supabase.from('notes')
            .select('*').eq('user_id', state.currentUser!.id)
            .order('date', { ascending: false })
            .range(state.userData!.notes.length, state.userData!.notes.length + pageSize - 1);
        if (error) throw new Error("Failed to fetch more notes.");
        dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: data || [], hasMore: (data || []).length === pageSize } });
    } catch(e) {
        console.error(e);
        dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: [], hasMore: state.hasMoreNotes } });
    }
};


// --- PROVIDER COMPONENT ---

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    const loadInitialData = useCallback(async (userId: string) => {
        try {
            const [
                { data: tradesData, error: tradesError },
                { data: accountsData, error: accountsError },
                { data: notesData, error: notesError },
                { data: settingsData, error: settingsError }
            ] = await Promise.all([
                supabase.from('trades').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(20),
                supabase.from('accounts').select('*').eq('user_id', userId),
                supabase.from('notes').select('*').eq('user_id', userId).order('date', { ascending: false }).limit(20),
                supabase.from('settings').select('*').eq('id', userId).single(),
            ]);

            if (tradesError || accountsError || notesError || (settingsError && settingsError.code !== 'PGRST116')) {
                console.error({tradesError, accountsError, notesError, settingsError});
                throw new Error("Failed to fetch initial data.");
            }

            const userData = {
                ...initialUserData,
                ...(settingsData || {}),
                trades: tradesData || [],
                accounts: accountsData || [],
                notes: notesData || [],
            };
            dispatch({ type: 'SET_USER_DATA', payload: userData as UserData });
            dispatch({ type: 'FETCH_MORE_TRADES_SUCCESS', payload: { trades: [], hasMore: (tradesData?.length || 0) === 20 }});
            dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: [], hasMore: (notesData?.length || 0) === 20 }});
        } catch (error) {
            console.error(error);
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load data.', type: 'error' } });
            // If data loading fails, we still set some default data so the app doesn't crash
            dispatch({ type: 'SET_USER_DATA', payload: initialUserData });
        }
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            dispatch({ type: 'INITIALIZE_SESSION', payload: { session } });
            if (session) {
                await loadInitialData(session.user.id);
            } else {
                // If there's no session, we clear user data.
                dispatch({ type: 'SET_USER_DATA', payload: null });
            }
            // This is the key fix: We finish loading AFTER the session check and data load attempt.
            dispatch({ type: 'FINISH_LOADING' });
        });

        return () => subscription.unsubscribe();
    }, [loadInitialData]);
    
    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

// --- HOOK ---

export const useAppContext = () => useContext(AppContext);