import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { supabase } from './supabase';
import { Session, User } from '@supabase/supabase-js';
import { UserData, Trade, Note, Toast, Account, Result, Currency, DefaultSettings } from '../types';
import * as db from '../services/offlineService';
import { caseConverter } from '../utils/caseConverter';

const TRADES_PAGE_SIZE = 50;
const NOTES_PAGE_SIZE = 20;

const GUEST_DEFAULTS = {
    userData: {
        riskPerTrade: 1,
        slTypes: ["Session High/Low", "Liquidity", "Structure", "Fibonacci", "Manual", "Fractal"],
        tpTypes: ["Session High/Low", "Liquidity", "Structure", "Fibonacci", "Manual", "Fractal"],
        entryTypes: ["Limit", "Market"],
        closeTypes: ["Full TP", "Partial", "Breakeven", "Manual Close"],
        defaultSettings: {
            pair: "EURUSD",
            direction: 'Long' as 'Long' | 'Short',
            risk: 1,
            rr: 2,
            entryType: "Limit",
            slType: "Session High/Low",
            tpType: "Fractal",
            closeType: "Full TP",
        },
        analysisTimeframes: ["1D", "1h", "5m", "Result"],
    },
    accounts: [{
        id: 'guest-account-1',
        userId: 'guest',
        name: 'Demo Account',
        initialBalance: 100000,
        currency: Currency.USD,
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
    }],
    trades: [],
    notes: [],
};


interface AppState {
    isLoading: boolean;
    session: Session | null;
    currentUser: User | null;
    isGuest: boolean;
    userData: {
        trades: Trade[];
        accounts: Account[];
        notes: Note[];
        settings: UserData;
    } | null;
    toast: Toast | null;
    isOnline: boolean;
    syncQueue: any[];
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
    | { type: 'SET_USER_DATA'; payload: { trades: Trade[], accounts: Account[], notes: Note[], settings: UserData | null } }
    | { type: 'SAVE_TRADE_LOCAL'; payload: Trade }
    | { type: 'DELETE_TRADE_LOCAL'; payload: string }
    | { type: 'ADD_MORE_TRADES'; payload: { trades: Trade[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_TRADES'; payload: boolean }
    | { type: 'SAVE_NOTE_LOCAL'; payload: Note }
    | { type: 'DELETE_NOTE_LOCAL'; payload: string }
    | { type: 'ADD_MORE_NOTES'; payload: { notes: Note[], hasMore: boolean } }
    | { type: 'SET_FETCHING_MORE_NOTES'; payload: boolean }
    | { type: 'SAVE_ACCOUNT_LOCAL', payload: Account }
    | { type: 'DELETE_ACCOUNT_LOCAL', payload: string }
    | { type: 'SAVE_SETTINGS_LOCAL', payload: UserData }
    | { type: 'SHOW_TOAST', payload: { message: string, type: 'success' | 'error' | 'info' } }
    | { type: 'HIDE_TOAST' }
    | { type: 'SET_ONLINE_STATUS'; payload: boolean }
    | { type: 'SET_SYNC_QUEUE'; payload: any[] }
    | { type: 'ADD_TO_SYNC_QUEUE'; payload: any }
    | { type: 'CLEAR_SYNC_QUEUE' };


const initialState: AppState = {
    isLoading: true,
    session: null,
    currentUser: null,
    isGuest: false,
    userData: null,
    toast: null,
    isOnline: navigator.onLine,
    syncQueue: [],
    hasMoreTrades: true,
    isFetchingMoreTrades: false,
    hasMoreNotes: true,
    isFetchingMoreNotes: false,
};

const appReducer = (state: AppState, action: Action): AppState => {
    switch(action.type) {
        case 'SET_LOADING': return { ...state, isLoading: action.payload };
        case 'SET_SESSION': return { ...state, session: action.payload.session, currentUser: action.payload.user, isGuest: false };
        case 'SET_GUEST_MODE': 
             return { 
                ...state, 
                isGuest: true, 
                isLoading: false, 
                userData: {
                    settings: { userId: 'guest', ...GUEST_DEFAULTS.userData },
                    accounts: GUEST_DEFAULTS.accounts,
                    trades: GUEST_DEFAULTS.trades,
                    notes: GUEST_DEFAULTS.notes,
                }
            };
        case 'LOGOUT': return { ...initialState, isLoading: false, isOnline: navigator.onLine };
        case 'SET_USER_DATA':
            const settings = action.payload.settings;
            const defaults = GUEST_DEFAULTS.userData;
            const mergedSettings = {
                ...defaults,
                ...settings,
                defaultSettings: {
                    ...defaults.defaultSettings,
                    ...settings?.defaultSettings,
                },
                analysisTimeframes: settings?.analysisTimeframes && settings.analysisTimeframes.length > 0 ? settings.analysisTimeframes : defaults.analysisTimeframes,
            };
            return { 
                ...state, 
                userData: { ...action.payload, settings: mergedSettings } 
            };
        case 'SAVE_TRADE_LOCAL': {
            const trades = state.userData?.trades || [];
            const index = trades.findIndex(t => t.id === action.payload.id);
            const newTrades = index > -1 ? [...trades.slice(0, index), action.payload, ...trades.slice(index + 1)] : [action.payload, ...trades];
            return { ...state, userData: { ...state.userData!, trades: newTrades }};
        }
        case 'DELETE_TRADE_LOCAL': {
            const trades = state.userData?.trades.filter(t => t.id !== action.payload) || [];
            return { ...state, userData: { ...state.userData!, trades } };
        }
        case 'ADD_MORE_TRADES': return { ...state, userData: { ...state.userData!, trades: [...state.userData!.trades, ...action.payload.trades]}, hasMoreTrades: action.payload.hasMore };
        case 'SET_FETCHING_MORE_TRADES': return { ...state, isFetchingMoreTrades: action.payload };
        
        case 'SAVE_NOTE_LOCAL': {
            const notes = state.userData?.notes || [];
            const index = notes.findIndex(n => n.id === action.payload.id);
            const newNotes = index > -1 ? [...notes.slice(0, index), action.payload, ...notes.slice(index + 1)] : [action.payload, ...notes];
            return { ...state, userData: { ...state.userData!, notes: newNotes }};
        }
        case 'DELETE_NOTE_LOCAL': {
            const notes = state.userData?.notes.filter(n => n.id !== action.payload) || [];
            return { ...state, userData: { ...state.userData!, notes } };
        }
        case 'ADD_MORE_NOTES': return { ...state, userData: { ...state.userData!, notes: [...state.userData!.notes, ...action.payload.notes]}, hasMoreNotes: action.payload.hasMore };
        case 'SET_FETCHING_MORE_NOTES': return { ...state, isFetchingMoreNotes: action.payload };

        case 'SAVE_ACCOUNT_LOCAL': {
            const accounts = state.userData?.accounts || [];
            const index = accounts.findIndex(a => a.id === action.payload.id);
            const newAccounts = index > -1 ? [...accounts.slice(0, index), action.payload, ...accounts.slice(index + 1)] : [action.payload, ...accounts];
            return { ...state, userData: { ...state.userData!, accounts: newAccounts }};
        }
        case 'DELETE_ACCOUNT_LOCAL': {
            const accounts = state.userData?.accounts.filter(a => a.id !== action.payload) || [];
            return { ...state, userData: { ...state.userData!, accounts }};
        }
        case 'SAVE_SETTINGS_LOCAL': {
            return { ...state, userData: { ...state.userData!, settings: action.payload }};
        }
        
        case 'SHOW_TOAST': return { ...state, toast: { ...action.payload, id: crypto.randomUUID() }};
        case 'HIDE_TOAST': return { ...state, toast: null };
        case 'SET_ONLINE_STATUS': return { ...state, isOnline: action.payload };
        case 'SET_SYNC_QUEUE': return { ...state, syncQueue: action.payload };
        case 'ADD_TO_SYNC_QUEUE': return { ...state, syncQueue: [...state.syncQueue, action.payload] };
        case 'CLEAR_SYNC_QUEUE': return { ...state, syncQueue: [] };
        default: return state;
    }
};

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> }>({ state: initialState, dispatch: () => null });

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(appReducer, initialState);

    useEffect(() => {
        const fetchInitialUserData = async (user: User) => {
            if (state.isGuest) return;
            try {
                // 1. Fetch from local DB first for instant UI
                const [localTrades, localAccounts, localNotes, localSettings, syncQueue] = await Promise.all([
                    db.getTable<Trade>('trades'),
                    db.getTable<Account>('accounts'),
                    db.getTable<Note>('notes'),
                    db.getTable<UserData>('settings'),
                    db.getSyncQueue(),
                ]);

                dispatch({ type: 'SET_USER_DATA', payload: { trades: localTrades, accounts: localAccounts, notes: localNotes, settings: localSettings[0] || null }});
                dispatch({ type: 'SET_SYNC_QUEUE', payload: syncQueue });
                dispatch({ type: 'SET_LOADING', payload: false });
                
                // 2. Then, trigger a sync if online
                if (navigator.onLine) {
                    window.dispatchEvent(new CustomEvent('sync-request'));
                }

            } catch (error) {
                console.error("Error fetching initial offline data:", error);
                dispatch({ type: 'SET_LOADING', payload: false });
            }
        };
        
        const handleAuth = () => {
            supabase.auth.getSession().then(({ data: { session } }) => {
                if (session) {
                    dispatch({ type: 'SET_SESSION', payload: { session, user: session.user } });
                    fetchInitialUserData(session.user);
                } else {
                    dispatch({ type: 'SET_LOADING', payload: false });
                }
            });
            
            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
                if (_event === 'SIGNED_OUT' || !session) {
                    await db.clearAllData();
                    dispatch({ type: 'LOGOUT' });
                } else if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED' || _event === 'USER_UPDATED') {
                    if (session?.user && session.user.id !== state.currentUser?.id) {
                        await db.clearAllData();
                        dispatch({ type: 'SET_SESSION', payload: { session, user: session.user } });
                        fetchInitialUserData(session.user);
                    }
                }
            });
    
            return () => subscription.unsubscribe();
        }

        handleAuth();
    }, []);


    useEffect(() => {
        const handleOnline = () => {
            dispatch({ type: 'SET_ONLINE_STATUS', payload: true });
            dispatch({ type: 'SHOW_TOAST', payload: { message: 'You are back online!', type: 'info' } });
            window.dispatchEvent(new CustomEvent('sync-request'));
        };
        const handleOffline = () => {
            dispatch({ type: 'SET_ONLINE_STATUS', payload: false });
             dispatch({ type: 'SHOW_TOAST', payload: { message: 'You are offline. Changes will be saved locally.', type: 'info' } });
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
};

export const useAppContext = () => useContext(AppContext);

// --- OFFLINE-FIRST ACTION CREATORS ---

const createSyncItem = (type: 'trade' | 'account' | 'note' | 'settings', action: 'create' | 'update' | 'delete', payload: any) => ({
    id: crypto.randomUUID(),
    type,
    action,
    payload,
    timestamp: Date.now()
});

const handleOfflineAction = async (dispatch: Dispatch<Action>, state: AppState, syncItem: any, localAction: Action) => {
    dispatch(localAction);
    await db.putSyncQueue(syncItem);
    dispatch({ type: 'ADD_TO_SYNC_QUEUE', payload: syncItem });
    if (state.isOnline) {
        window.dispatchEvent(new CustomEvent('sync-request'));
    }
};

// Generic Save Action
async function saveEntityAction<T extends {id: string, userId: string}>(
    dispatch: Dispatch<Action>,
    state: AppState,
    entity: Partial<T>,
    type: 'trade' | 'account' | 'note' | 'settings',
    isUpdate: boolean
) {
    const { currentUser, isGuest } = state;
    if (isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' }});
        throw new Error("Guest mode");
    }
    if (!currentUser) throw new Error("User not authenticated");

    const fullEntity: T = {
        ...entity,
        id: isUpdate ? entity.id! : crypto.randomUUID(),
        userId: currentUser.id,
        updatedAt: new Date().toISOString(),
        ...(!isUpdate && { createdAt: new Date().toISOString() })
    // FIX: Changed type assertion to 'as unknown as T' to resolve complex type conversion error.
    } as unknown as T;

    const actionType = isUpdate ? 'update' : 'create';
    const localActionType = `SAVE_${type.toUpperCase()}_LOCAL` as any;

    await db.bulkPut(type === 'settings' ? 'settings' : `${type}s` as any, [caseConverter.toCamel(fullEntity)]);
    
    const syncItem = createSyncItem(type, actionType, fullEntity);
    handleOfflineAction(dispatch, state, syncItem, { type: localActionType, payload: caseConverter.toCamel(fullEntity) });
    
    dispatch({ type: 'SHOW_TOAST', payload: { message: `${type.charAt(0).toUpperCase() + type.slice(1)} saved locally.`, type: 'info' } });
    return caseConverter.toCamel(fullEntity) as T;
}

// Generic Delete Action
async function deleteEntityAction(
    dispatch: Dispatch<Action>,
    state: AppState,
    id: string,
    type: 'trade' | 'account' | 'note'
) {
    const { currentUser, isGuest } = state;
    if (isGuest) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: "This feature is disabled in guest mode.", type: 'error' }});
        return;
    }
    if (!currentUser) throw new Error("User not authenticated");
    
    await db.deleteItem(`${type}s`, id);
    const syncItem = createSyncItem(type, 'delete', { id });
    handleOfflineAction(dispatch, state, syncItem, { type: `DELETE_${type.toUpperCase()}_LOCAL` as any, payload: id });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `${type.charAt(0).toUpperCase() + type.slice(1)} deleted locally.`, type: 'info' } });
}


export const saveTradeAction = (dispatch: Dispatch<Action>, state: AppState, tradeData: Partial<Trade>, isUpdate: boolean) => saveEntityAction(dispatch, state, tradeData, 'trade', isUpdate);
export const deleteTradeAction = (dispatch: Dispatch<Action>, state: AppState, id: string) => deleteEntityAction(dispatch, state, id, 'trade');

export const saveAccountAction = (dispatch: Dispatch<Action>, state: AppState, accountData: Partial<Account>, isUpdate: boolean) => saveEntityAction(dispatch, state, accountData, 'account', isUpdate);
export const deleteAccountAction = (dispatch: Dispatch<Action>, state: AppState, id: string) => deleteEntityAction(dispatch, state, id, 'account');

export const saveNoteAction = (dispatch: Dispatch<Action>, state: AppState, noteData: Partial<Note>, isUpdate: boolean) => saveEntityAction(dispatch, state, noteData, 'note', isUpdate);
export const deleteNoteAction = (dispatch: Dispatch<Action>, state: AppState, id: string) => deleteEntityAction(dispatch, state, id, 'note');

export const saveSettingsAction = (dispatch: Dispatch<Action>, state: AppState, settingsData: UserData) => saveEntityAction(dispatch, state, { ...settingsData, id: state.currentUser!.id }, 'settings', true);

// ... fetchMore actions remain mostly the same as they are network-only
export const fetchMoreTradesAction = async (dispatch: Dispatch<Action>, state: AppState) => {
    // This action should probably be removed or rethought in an offline-first world,
    // as local data should be primary. It could be used for the initial sync.
};
export const fetchMoreNotesAction = async (dispatch: Dispatch<Action>, state: AppState) => {};