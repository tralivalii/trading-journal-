
import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { 
    getTrades, 
    getAccounts, 
    getNotes, 
    getSettings, 
    saveTrade as dbSaveTrade, 
    deleteTrade as dbDeleteTrade, 
    saveNote as dbSaveNote, 
    deleteNote as dbDeleteNote,
} from './databaseService';
import { Trade, Account, Note, UserData, Toast, Currency } from '../types';

const TRADES_PAGE_SIZE = 20;
const NOTES_PAGE_SIZE = 20;

// State and Actions
export interface AppState {
    session: Session | null;
    currentUser: User | null;
    isGuest: boolean;
    isLoading: boolean;
    userData: {
        trades: Trade[];
        accounts: Account[];
        notes: Note[];
        settings: UserData | null;
        hasMoreTrades: boolean;
        isFetchingMoreTrades: boolean;
        hasMoreNotes: boolean;
        isFetchingMoreNotes: boolean;
    } | null;
    toast: Toast | null;
}

export type Action =
    | { type: 'SET_SESSION'; payload: { session: Session | null; user: User | null } }
    | { type: 'SET_GUEST_MODE' }
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_USER_DATA'; payload: AppState['userData'] }
    | { type: 'ADD_TRADE'; payload: Trade }
    | { type: 'UPDATE_TRADE'; payload: Trade }
    | { type: 'DELETE_TRADE'; payload: string }
    | { type: 'SET_TRADES'; payload: { trades: Trade[], hasMore: boolean } }
    | { type: 'ADD_TRADES'; payload: { trades: Trade[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_TRADES'; payload: boolean }
    | { type: 'ADD_NOTE'; payload: Note }
    | { type: 'UPDATE_NOTE'; payload: Note }
    | { type: 'DELETE_NOTE'; payload: string }
    | { type: 'SET_NOTES'; payload: { notes: Note[], hasMore: boolean } }
    | { type: 'ADD_NOTES'; payload: { notes: Note[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_NOTES'; payload: boolean }
    | { type: 'UPDATE_ACCOUNT'; payload: Account }
    | { type: 'ADD_ACCOUNT'; payload: Account }
    | { type: 'SET_SETTINGS'; payload: UserData }
    | { type: 'SHOW_TOAST'; payload: Omit<Toast, 'id'> }
    | { type: 'HIDE_TOAST' }
    | { type: 'LOGOUT' };


// Reducer
const initialState: AppState = {
    session: null,
    currentUser: null,
    isGuest: false,
    isLoading: true,
    userData: null,
    toast: null,
};

const reducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'SET_SESSION':
            return { ...state, session: action.payload.session, currentUser: action.payload.user, isGuest: false };
        case 'SET_GUEST_MODE':
            return {
                ...state,
                isGuest: true,
                isLoading: false,
                currentUser: { id: 'guest' } as User,
                userData: {
                    trades: [],
                    accounts: [{ id: 'guest-account', userId: 'guest', name: 'Guest Account', initialBalance: 10000, currency: Currency.USD, isArchived: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
                    notes: [],
                    settings: { userId: 'guest', riskPerTrade: 1, slTypes: [], tpTypes: [], entryTypes: [], closeTypes: [], defaultSettings: { pair: 'EURUSD', direction: 'Long', risk: 1, rr: 2, entryType: 'Default', slType: 'Default', tpType: 'Default', closeType: 'Default' }, analysisTimeframes: [] },
                    hasMoreTrades: false,
                    isFetchingMoreTrades: false,
                    hasMoreNotes: false,
                    isFetchingMoreNotes: false,
                },
            };
        case 'SET_LOADING':
            return { ...state, isLoading: action.payload };
        case 'SET_USER_DATA':
            return { ...state, userData: action.payload, isLoading: false };
        case 'ADD_TRADE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: [action.payload, ...state.userData.trades] } };
        case 'UPDATE_TRADE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: state.userData.trades.map(t => t.id === action.payload.id ? action.payload : t) } };
        case 'DELETE_TRADE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: state.userData.trades.filter(t => t.id !== action.payload) } };
        case 'SET_TRADES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: action.payload.trades, hasMoreTrades: action.payload.hasMore } };
        case 'ADD_TRADES':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, trades: [...state.userData.trades, ...action.payload.trades], hasMoreTrades: action.payload.hasMore } };
        case 'SET_FETCHING_MORE_TRADES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, isFetchingMoreTrades: action.payload } };
        case 'ADD_NOTE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: [action.payload, ...state.userData.notes] } };
        case 'UPDATE_NOTE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: state.userData.notes.map(n => n.id === action.payload.id ? action.payload : n) } };
        case 'DELETE_NOTE':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: state.userData.notes.filter(n => n.id !== action.payload) } };
        case 'SET_NOTES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: action.payload.notes, hasMoreNotes: action.payload.hasMore } };
        case 'ADD_NOTES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, notes: [...state.userData.notes, ...action.payload.notes], hasMoreNotes: action.payload.hasMore } };
        case 'SET_FETCHING_MORE_NOTES':
             if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, isFetchingMoreNotes: action.payload } };
        case 'ADD_ACCOUNT':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, accounts: [...state.userData.accounts, action.payload] } };
        case 'UPDATE_ACCOUNT':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, accounts: state.userData.accounts.map(a => a.id === action.payload.id ? action.payload : a) } };
        case 'SET_SETTINGS':
            if (!state.userData) return state;
            return { ...state, userData: { ...state.userData, settings: action.payload } };
        case 'SHOW_TOAST':
            return { ...state, toast: { ...action.payload, id: new Date().toISOString() } };
        case 'HIDE_TOAST':
            return { ...state, toast: null };
        case 'LOGOUT':
            return { ...initialState, isLoading: false };
        default:
            return state;
    }
};

// Context
const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<Action> }>({
    state: initialState,
    dispatch: () => null,
});

// Provider
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, initialState);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            dispatch({ type: 'SET_SESSION', payload: { session, user: session?.user || null } });
            if (event === 'SIGNED_IN') {
                await fetchInitialDataAction(dispatch, session!.user!.id);
            } else if (event === 'SIGNED_OUT') {
                dispatch({ type: 'LOGOUT' });
            }
        });
        
        const checkInitialSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            dispatch({ type: 'SET_SESSION', payload: { session, user: session?.user || null } });
            if (session) {
                await fetchInitialDataAction(dispatch, session.user.id);
            } else {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        };

        checkInitialSession();

        return () => subscription.unsubscribe();
    }, []);

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
};

// Hook
export const useAppContext = () => useContext(AppContext);

// Action Creators (async functions)
export const fetchInitialDataAction = async (dispatch: React.Dispatch<Action>, userId: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
        const [
            { data: trades, count: tradesCount }, 
            accounts,
            { data: notes, count: notesCount },
            settings
        ] = await Promise.all([
            getTrades(userId, 0, TRADES_PAGE_SIZE),
            getAccounts(userId),
            getNotes(userId, 0, NOTES_PAGE_SIZE),
            getSettings(userId),
        ]);
        
        dispatch({ type: 'SET_USER_DATA', payload: {
            trades,
            accounts,
            notes,
            settings,
            hasMoreTrades: (tradesCount ?? 0) > TRADES_PAGE_SIZE,
            isFetchingMoreTrades: false,
            hasMoreNotes: (notesCount ?? 0) > NOTES_PAGE_SIZE,
            isFetchingMoreNotes: false,
        }});
    } catch (error) {
        console.error("Failed to fetch initial data", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load data.', type: 'error' } });
        dispatch({ type: 'SET_LOADING', payload: false });
    }
};

export const saveTradeAction = async (dispatch: React.Dispatch<Action>, state: AppState, tradeData: Partial<Trade>, isUpdate: boolean) => {
    if (state.isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
        return;
    }
    try {
        const savedTrade = await dbSaveTrade(tradeData, state.currentUser!.id, isUpdate ? (tradeData.id!) : undefined);
        dispatch({ type: isUpdate ? 'UPDATE_TRADE' : 'ADD_TRADE', payload: savedTrade });
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Trade ${isUpdate ? 'updated' : 'added'} successfully.`, type: 'success' } });
        return savedTrade;
    } catch (error) {
        console.error("Failed to save trade:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to save trade.', type: 'error' } });
        throw error;
    }
};

export const deleteTradeAction = async (dispatch: React.Dispatch<Action>, state: AppState, tradeId: string) => {
    if (state.isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
        return;
    }
    try {
        await dbDeleteTrade(tradeId);
        dispatch({ type: 'DELETE_TRADE', payload: tradeId });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted.', type: 'success' } });
    } catch (error) {
        console.error("Failed to delete trade:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to delete trade.', type: 'error' } });
    }
};

export const fetchMoreTradesAction = async (dispatch: React.Dispatch<Action>, state: AppState) => {
    if (state.isGuest || !state.userData || state.userData.isFetchingMoreTrades || !state.userData.hasMoreTrades) return;

    dispatch({ type: 'SET_FETCHING_MORE_TRADES', payload: true });
    try {
        const currentPage = Math.floor(state.userData.trades.length / TRADES_PAGE_SIZE);
        const { data, count } = await getTrades(state.currentUser!.id, currentPage + 1, TRADES_PAGE_SIZE);
        dispatch({ type: 'ADD_TRADES', payload: { trades: data, hasMore: (count ?? 0) > state.userData.trades.length + data.length } });
    } catch (error) {
        console.error("Failed to fetch more trades:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load more trades.', type: 'error' } });
    } finally {
        dispatch({ type: 'SET_FETCHING_MORE_TRADES', payload: false });
    }
};

export const saveNoteAction = async (dispatch: React.Dispatch<Action>, state: AppState, noteData: Partial<Note>, isUpdate: boolean) => {
    if (state.isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
        return;
    }
    try {
        const savedNote = await dbSaveNote(noteData, state.currentUser!.id, isUpdate ? noteData.id! : undefined);
        dispatch({ type: isUpdate ? 'UPDATE_NOTE' : 'ADD_NOTE', payload: savedNote });
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Note ${isUpdate ? 'updated' : 'created'} successfully.`, type: 'success' } });
        return savedNote;
    } catch (error) {
        console.error("Failed to save note:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to save note.', type: 'error' } });
        throw error;
    }
};

export const deleteNoteAction = async (dispatch: React.Dispatch<Action>, state: AppState, noteId: string) => {
    if (state.isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' } });
        return;
    }
    try {
        await dbDeleteNote(noteId);
        dispatch({ type: 'DELETE_NOTE', payload: noteId });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted.', type: 'success' } });
    } catch (error) {
        console.error("Failed to delete note:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to delete note.', type: 'error' } });
    }
};

export const fetchMoreNotesAction = async (dispatch: React.Dispatch<Action>, state: AppState) => {
    if (state.isGuest || !state.userData || state.userData.isFetchingMoreNotes || !state.userData.hasMoreNotes) return;
    dispatch({ type: 'SET_FETCHING_MORE_NOTES', payload: true });
    try {
        const currentPage = Math.floor(state.userData.notes.length / NOTES_PAGE_SIZE);
        const { data, count } = await getNotes(state.currentUser!.id, currentPage + 1, NOTES_PAGE_SIZE);
        dispatch({ type: 'ADD_NOTES', payload: { notes: data, hasMore: (count ?? 0) > state.userData.notes.length + data.length } });
    } catch (error) {
        console.error("Failed to fetch more notes:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to load more notes.', type: 'error' } });
    } finally {
        dispatch({ type: 'SET_FETCHING_MORE_NOTES', payload: false });
    }
};
