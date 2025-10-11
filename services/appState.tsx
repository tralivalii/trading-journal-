// FIX: Provided full content for missing appState.tsx file.
import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { UserData, Trade, Note, Toast } from '../types';
import * as dbService from './databaseService';

interface AppState {
    isLoading: boolean;
    session: Session | null;
    currentUser: User | null;
    isGuest: boolean;
    userData: UserData | null;
    toasts: Toast[];
    hasMoreTrades: boolean;
    isFetchingMoreTrades: boolean;
    hasMoreNotes: boolean;
    isFetchingMoreNotes: boolean;
}

type Action =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_SESSION'; payload: { session: Session | null, user: User | null } }
    | { type: 'SET_GUEST_MODE' }
    | { type: 'LOGOUT' }
    | { type: 'SET_USER_DATA'; payload: UserData }
    | { type: 'SAVE_TRADE'; payload: Trade }
    | { type: 'DELETE_TRADE'; payload: string }
    | { type: 'ADD_MORE_TRADES'; payload: { trades: Trade[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_TRADES'; payload: boolean }
    | { type: 'SAVE_NOTE'; payload: Note }
    | { type: 'DELETE_NOTE'; payload: string }
    | { type: 'ADD_MORE_NOTES'; payload: { notes: Note[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_NOTES'; payload: boolean }
    | { type: 'SHOW_TOAST', payload: { message: string, type: 'success' | 'error' | 'info' } }
    | { type: 'DISMISS_TOAST', payload: string };


const initialState: AppState = {
    isLoading: true,
    session: null,
    currentUser: null,
    isGuest: false,
    userData: null,
    toasts: [],
    hasMoreTrades: true,
    isFetchingMoreTrades: false,
    hasMoreNotes: true,
    isFetchingMoreNotes: false,
};

const appReducer = (state: AppState, action: Action): AppState => {
    switch(action.type) {
        case 'SET_LOADING': return { ...state, isLoading: action.payload };
        case 'SET_SESSION': return { ...state, session: action.payload.session, currentUser: action.payload.user, isGuest: false };
        case 'SET_GUEST_MODE': return { ...state, isGuest: true, isLoading: false, userData: { trades: [], accounts: [], notes: [], settings: { userId: 'guest', riskPerTrade: 1 } } };
        case 'LOGOUT': return { ...initialState, isLoading: false };
        case 'SET_USER_DATA': return { ...state, userData: action.payload };
        case 'SAVE_TRADE': {
            const trades = state.userData?.trades || [];
            const index = trades.findIndex(t => t.id === action.payload.id);
            const newTrades = index > -1 ? [...trades.slice(0, index), action.payload, ...trades.slice(index + 1)] : [action.payload, ...trades];
            return { ...state, userData: { ...state.userData!, trades: newTrades }};
        }
        case 'DELETE_TRADE': {
            const trades = state.userData?.trades.filter(t => t.id !== action.payload) || [];
            return { ...state, userData: { ...state.userData!, trades } };
        }
        case 'ADD_MORE_TRADES': return { ...state, userData: { ...state.userData!, trades: [...state.userData!.trades, ...action.payload.trades]}, hasMoreTrades: action.payload.hasMore };
        case 'SET_FETCHING_MORE_TRADES': return { ...state, isFetchingMoreTrades: action.payload };
        case 'SAVE_NOTE': {
            const notes = state.userData?.notes || [];
            const index = notes.findIndex(n => n.id === action.payload.id);
            const newNotes = index > -1 ? [...notes.slice(0, index), action.payload, ...notes.slice(index + 1)] : [action.payload, ...notes];
            return { ...state, userData: { ...state.userData!, notes: newNotes }};
        }
        case 'DELETE_NOTE': {
            const notes = state.userData?.notes.filter(n => n.id !== action.payload) || [];
            return { ...state, userData: { ...state.userData!, notes } };
        }
        case 'ADD_MORE_NOTES': return { ...state, userData: { ...state.userData!, notes: [...state.userData!.notes, ...action.payload.notes]}, hasMoreNotes: action.payload.hasMore };
        case 'SET_FETCHING_MORE_NOTES': return { ...state, isFetchingMoreNotes: action.payload };
        case 'SHOW_TOAST': return { ...state, toasts: [...state.toasts, { ...action.payload, id: crypto.randomUUID() }] };
        case 'DISMISS_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        default: return state;
    }
};

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> }>({ state: initialState, dispatch: () => null });

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const fetchInitialData = async (user: User) => {
            dispatch({ type: 'SET_LOADING', payload: true });
            try {
                const [
                    { data: trades, count: tradesCount },
                    accounts,
                    { data: notes, count: notesCount },
                    settings
                ] = await Promise.all([
                    dbService.getTrades(user.id, 0, 50),
                    dbService.getAccounts(user.id),
                    dbService.getNotes(user.id, 0, 20),
                    dbService.getSettings(user.id)
                ]);
                dispatch({ type: 'SET_USER_DATA', payload: { trades, accounts, notes, settings: settings || { userId: user.id, riskPerTrade: 1 } } });
                dispatch({ type: 'ADD_MORE_TRADES', payload: { trades, hasMore: trades.length < (tradesCount ?? 0) } });
                dispatch({ type: 'ADD_MORE_NOTES', payload: { notes, hasMore: notes.length < (notesCount ?? 0) } });
            } catch (error) {
                console.error("Error fetching initial data:", error);
            } finally {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        };
        
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                dispatch({ type: 'SET_SESSION', payload: { session, user: session.user } });
                fetchInitialData(session.user);
            } else {
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        });
        
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                dispatch({ type: 'SET_SESSION', payload: { session, user: session.user } });
                fetchInitialData(session.user);
            } else {
                dispatch({ type: 'LOGOUT' });
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
};

export const useAppContext = () => useContext(AppContext);

// Action Creators
export const saveTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeData: Omit<Trade, 'id' | 'userId'>, id?: string) => {
    if (!state.currentUser) return;
    try {
        const savedTrade = await dbService.saveTrade(tradeData, state.currentUser.id, id);
        dispatch({ type: 'SAVE_TRADE', payload: savedTrade });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade saved successfully!', type: 'success' } });
    } catch (error) {
        console.error("Error saving trade:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to save trade.', type: 'error' } });
    }
};

export const deleteTradeAction = async (dispatch: Dispatch<Action>, state: AppState, id: string) => {
    if (!state.currentUser) return;
    try {
        await dbService.deleteTrade(id);
        dispatch({ type: 'DELETE_TRADE', payload: id });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted.', type: 'success' } });
    } catch (error) {
        console.error("Error deleting trade:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to delete trade.', type: 'error' } });
    }
};

export const fetchMoreTradesAction = async (dispatch: Dispatch<Action>, state: AppState, pageSize: number) => {
    if (!state.currentUser || state.isFetchingMoreTrades || !state.hasMoreTrades) return;
    dispatch({ type: 'SET_FETCHING_MORE_TRADES', payload: true });
    try {
        const page = Math.ceil(state.userData!.trades.length / pageSize);
        const { data, count } = await dbService.getTrades(state.currentUser.id, page, pageSize);
        dispatch({ type: 'ADD_MORE_TRADES', payload: { trades: data, hasMore: (state.userData!.trades.length + data.length) < (count ?? 0) } });
    } catch (error) {
        console.error("Error fetching more trades:", error);
    } finally {
        dispatch({ type: 'SET_FETCHING_MORE_TRADES', payload: false });
    }
};

export const saveNoteAction = async (dispatch: Dispatch<Action>, state: AppState, noteData: Partial<Note>, isUpdate: boolean) => {
    if (!state.currentUser) throw new Error("User not logged in");
    try {
        const savedNote = await dbService.saveNote(noteData, state.currentUser.id, isUpdate ? noteData.id : undefined);
        dispatch({ type: 'SAVE_NOTE', payload: savedNote });
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Note ${isUpdate ? 'updated' : 'created'}!`, type: 'success' } });
        return savedNote;
    } catch (error) {
        console.error("Error saving note:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to save note.', type: 'error' } });
        throw error;
    }
};

export const deleteNoteAction = async (dispatch: Dispatch<Action>, state: AppState, id: string) => {
    if (!state.currentUser) return;
    try {
        await dbService.deleteNote(id);
        dispatch({ type: 'DELETE_NOTE', payload: id });
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted.', type: 'success' } });
    } catch (error) {
        console.error("Error deleting note:", error);
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Failed to delete note.', type: 'error' } });
    }
};

export const fetchMoreNotesAction = async (dispatch: Dispatch<Action>, state: AppState, pageSize: number) => {
    if (!state.currentUser || state.isFetchingMoreNotes || !state.hasMoreNotes) return;
    dispatch({ type: 'SET_FETCHING_MORE_NOTES', payload: true });
    try {
        const page = Math.ceil(state.userData!.notes.length / pageSize);
        const { data, count } = await dbService.getNotes(state.currentUser.id, page, pageSize);
        dispatch({ type: 'ADD_MORE_NOTES', payload: { notes: data, hasMore: (state.userData!.notes.length + data.length) < (count ?? 0) } });
    } catch (error) {
        console.error("Error fetching more notes:", error);
    } finally {
        dispatch({ type: 'SET_FETCHING_MORE_NOTES', payload: false });
    }
};
