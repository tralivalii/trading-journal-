import React, { createContext, useReducer, useContext, Dispatch, ReactNode } from 'react';
import { UserData, User, Trade, Note, Account, DefaultSettings } from '../types';
import * as db from './databaseService';
import * as imageDB from './imageDB';

// --- STATE AND ACTION TYPES ---

interface AppState {
    currentUser: User | null;
    userData: UserData | null;
    isLoading: boolean;
}

type Action =
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; data: UserData } }
  | { type: 'LOGOUT' }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_TRADES'; payload: Trade[] }
  | { type: 'SET_ACCOUNTS'; payload: Account[] }
  | { type: 'SET_PAIRS'; payload: string[] }
  | { type: 'SET_ENTRIES'; payload: string[] }
  | { type: 'SET_RISKS'; payload: number[] }
  | { type: 'SET_DEFAULT_SETTINGS'; payload: DefaultSettings }
  | { type: 'SET_NOTES'; payload: Note[] }
  | { type: 'SET_STOPLOSSES'; payload: string[] }
  | { type: 'SET_TAKEPROFITS'; payload: string[] }
  | { type: 'SET_CLOSETYPES'; payload: string[] };
  
// --- INITIAL STATE ---

const initialState: AppState = {
    currentUser: null,
    userData: null,
    isLoading: true,
};

// --- REDUCER ---

const appReducer = (state: AppState, action: Action): AppState => {
    switch (action.type) {
        case 'LOGIN_SUCCESS':
            return {
                ...state,
                currentUser: action.payload.user,
                userData: action.payload.data,
                isLoading: false,
            };
        case 'LOGOUT':
            return {
                ...state,
                currentUser: null,
                userData: null,
            };
        case 'SET_IS_LOADING':
            return {
                ...state,
                isLoading: action.payload,
            };
        case 'SET_TRADES':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { trades: action.payload });
            return { ...state, userData: { ...state.userData, trades: action.payload } };
        case 'SET_ACCOUNTS':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { accounts: action.payload });
            return { ...state, userData: { ...state.userData, accounts: action.payload } };
        case 'SET_PAIRS':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { pairs: action.payload });
            return { ...state, userData: { ...state.userData, pairs: action.payload } };
        case 'SET_ENTRIES':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { entries: action.payload });
            return { ...state, userData: { ...state.userData, entries: action.payload } };
        case 'SET_RISKS':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { risks: action.payload });
            return { ...state, userData: { ...state.userData, risks: action.payload } };
        case 'SET_DEFAULT_SETTINGS':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { defaultSettings: action.payload });
            return { ...state, userData: { ...state.userData, defaultSettings: action.payload } };
        case 'SET_NOTES':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { notes: action.payload });
            return { ...state, userData: { ...state.userData, notes: action.payload } };
        case 'SET_STOPLOSSES':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { stoplosses: action.payload });
            return { ...state, userData: { ...state.userData, stoplosses: action.payload } };
        case 'SET_TAKEPROFITS':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { takeprofits: action.payload });
            return { ...state, userData: { ...state.userData, takeprofits: action.payload } };
        case 'SET_CLOSETYPES':
            if (!state.currentUser || !state.userData) return state;
            db.updateUserData(state.currentUser.email, { closeTypes: action.payload });
            return { ...state, userData: { ...state.userData, closeTypes: action.payload } };
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

    return (
        <AppContext.Provider value={{ state, dispatch }}>
            {children}
        </AppContext.Provider>
    );
};

// --- CUSTOM HOOK ---

export const useAppContext = () => useContext(AppContext);

// --- HELPER ACTIONS ---
export const deleteTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeIdToDelete: string) => {
    if (!state.currentUser || !state.userData) return;

    const { email } = state.currentUser;
    const { trades } = state.userData;
    
    const tradeToDelete = trades.find(t => t.id === tradeIdToDelete);
    if (tradeToDelete) {
        const imageKeys = [
            tradeToDelete.analysisD1.image,
            tradeToDelete.analysis1h.image,
            tradeToDelete.analysis5m.image,
            tradeToDelete.analysisResult.image,
        ].filter((key): key is string => !!key);

        try {
            await Promise.all(imageKeys.map(key => imageDB.deleteImage(key)));
        } catch (error) {
            console.error("Failed to delete one or more images from IndexedDB:", error);
        }
    }
    
    const newTrades = trades.filter(trade => trade.id !== tradeIdToDelete);
    dispatch({ type: 'SET_TRADES', payload: newTrades });
};

export const saveTradeAction = (dispatch: Dispatch<Action>, state: AppState, tradeToSave: Trade, isEditing: boolean) => {
    if (!state.currentUser || !state.userData) return;
    
    const { accounts, trades } = state.userData;
    const account = accounts.find(a => a.id === tradeToSave.accountId);
    if (!account) return;

    const accountTrades = trades.filter(t => t.accountId === account.id && t.id !== tradeToSave.id);
    const accountPnl = accountTrades.reduce((sum, trade) => sum + trade.pnl, 0);
    const currentBalance = account.initialBalance + accountPnl;
    
    const riskAmount = currentBalance * (tradeToSave.risk / 100);
    const commission = tradeToSave.commission || 0;
    let pnl = 0;
    if (tradeToSave.result === 'Win') pnl = riskAmount * tradeToSave.rr;
    else if (tradeToSave.result === 'Loss') pnl = -riskAmount;

    const finalTrade: Trade = { ...tradeToSave, id: tradeToSave.id || crypto.randomUUID(), riskAmount, pnl: pnl - commission, commission };

    let newTrades: Trade[];
    if(isEditing) {
        const existingIndex = trades.findIndex(t => t.id === finalTrade.id);
        newTrades = [...trades];
        if (existingIndex > -1) {
            newTrades[existingIndex] = finalTrade;
        }
    } else {
        newTrades = [...trades, finalTrade];
    }
    dispatch({ type: 'SET_TRADES', payload: newTrades });
};
