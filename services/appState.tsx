// services/appState.tsx

import React, { createContext, useReducer, useContext, useEffect, Dispatch } from 'react';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { Account, Note, Result, Trade, UserData } from '../types';
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
  hasMoreTrades: boolean;
  isFetchingMore: boolean;
  hasMoreNotes: boolean;
  isFetchingMoreNotes: boolean;
  toasts: Toast[];
}

type Action =
  | { type: 'SET_SESSION'; payload: Session | null }
  | { type: 'SET_USER_DATA'; payload: UserData | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'UPDATE_TRADES'; payload: Trade[] }
  | { type: 'UPDATE_ACCOUNTS'; payload: Account[] }
  | { type: 'UPDATE_NOTES'; payload: Note[] }
  | { type: 'UPDATE_USER_DATA_FIELD'; payload: { field: keyof Omit<UserData, 'trades' | 'accounts' | 'notes'>; value: any } }
  | { type: 'FETCH_MORE_TRADES_START' }
  | { type: 'FETCH_MORE_TRADES_SUCCESS'; payload: { trades: Trade[]; hasMore: boolean } }
  | { type: 'FETCH_MORE_NOTES_START' }
  | { type: 'FETCH_MORE_NOTES_SUCCESS'; payload: { notes: Note[]; hasMore: boolean } }
  | { type: 'SHOW_TOAST'; payload: Omit<Toast, 'id'> }
  | { type: 'HIDE_TOAST'; payload: number };

// --- REDUCER ---

const defaultTimeframes = ['1D', '1h', '5m', 'Result'];

const initialState: AppState = {
  session: null,
  currentUser: null,
  userData: null,
  isLoading: true,
  hasMoreTrades: false,
  isFetchingMore: false,
  hasMoreNotes: false,
  isFetchingMoreNotes: false,
  toasts: [],
};

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_SESSION':
      return {
        ...state,
        session: action.payload,
        currentUser: action.payload?.user ?? null,
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

export const saveSettingsAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    settings: Partial<Omit<UserData, 'trades' | 'accounts' | 'notes'>>
) => {
    const { userData, currentUser } = state;
    if (!userData || !currentUser) return;

    const allSettingsData = { ...userData, ...settings };
    delete (allSettingsData as any).trades;
    delete (allSettingsData as any).accounts;
    delete (allSettingsData as any).notes;

    const { error } = await supabase
        .from('user_data')
        .upsert({ user_id: currentUser.id, data: allSettingsData });

    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error saving settings: ${error.message}`, type: 'error' } });
        throw error;
    }
    
    for (const [key, value] of Object.entries(settings)) {
        dispatch({ type: 'UPDATE_USER_DATA_FIELD', payload: { field: key as any, value }});
    }
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Settings saved.', type: 'success' } });
};


export const saveTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeData: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string },
  isEditing: boolean
): Promise<Trade> => {
    const { userData, currentUser } = state;
    if (!userData || !currentUser) throw new Error('User data not available');
    
    const account = userData.accounts.find(acc => acc.id === tradeData.accountId);
    if (!account) throw new Error("Account not found");

    const riskAmount = (account.initialBalance * tradeData.risk) / 100;
    let pnl = 0;
    if(tradeData.result === Result.Win) pnl = riskAmount * tradeData.rr;
    if(tradeData.result === Result.Loss) pnl = -riskAmount;
    pnl -= (tradeData.commission || 0);

    const tradeId = isEditing ? tradeData.id! : crypto.randomUUID();
    const finalTrade: Trade = { ...tradeData, id: tradeId, pnl, riskAmount };
    
    const { accountId, closeType, analysisD1, analysis1h, analysis5m, analysisResult, aiAnalysis, ...rest } = finalTrade;
    const supabasePayload = {
        ...rest,
        user_id: currentUser.id,
        account_id: accountId,
        close_type: closeType,
        analysis_d1: analysisD1,
        analysis_1h: analysis1h,
        analysis_5m: analysis5m,
        analysis_result: analysisResult,
        ai_analysis: aiAnalysis
    };

    const { error } = await supabase.from('trades').upsert(supabasePayload);

    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error saving trade: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedTrades = isEditing
        ? userData.trades.map(t => t.id === tradeId ? finalTrade : t)
        : [finalTrade, ...userData.trades];
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Trade ${isEditing ? 'updated' : 'added'}.`, type: 'success' } });
    return finalTrade;
};

export const deleteTradeAction = async (
  dispatch: Dispatch<Action>,
  state: AppState,
  tradeId: string
) => {
    const { userData } = state;
    if (!userData) throw new Error('User data not available');
    
    const tradeToDelete = userData.trades.find(t => t.id === tradeId);
    if (tradeToDelete) {
        const imagePaths = [
            tradeToDelete.analysisD1.image,
            tradeToDelete.analysis1h.image,
            tradeToDelete.analysis5m.image,
            tradeToDelete.analysisResult.image
        ].filter(Boolean) as string[];

        if (imagePaths.length > 0) {
            const { error: storageError } = await supabase.storage.from('trade-attachments').remove(imagePaths);
            if (storageError) {
                console.error("Failed to delete images from storage:", storageError);
                // Non-blocking error, we still want to delete the trade record.
            }
        }
    }

    const { error } = await supabase.from('trades').delete().eq('id', tradeId);
    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error deleting trade: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedTrades = userData.trades.filter(t => t.id !== tradeId);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Trade deleted.', type: 'success' } });
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
    
    const { error } = await supabase.from('trades').update({ ai_analysis: analysisText }).eq('id', tradeId);
    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error saving AI analysis: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedTrade: Trade = { ...tradeToUpdate, aiAnalysis: analysisText };
    const updatedTrades = userData.trades.map(t => t.id === tradeId ? updatedTrade : t);
    dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
};

export const saveAccountAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    accountData: Omit<Account, 'id'> & { id?: string },
    isEditing: boolean
) => {
    const { userData, currentUser } = state;
    if (!userData || !currentUser) throw new Error('User data not available');

    const accountId = isEditing ? accountData.id! : crypto.randomUUID();
    const finalAccount: Account = { ...accountData, id: accountId };
    
    const { initialBalance, isArchived, ...rest } = finalAccount;
    const supabasePayload = { ...rest, user_id: currentUser.id, initial_balance: initialBalance, is_archived: isArchived };
    const { error } = await supabase.from('accounts').upsert(supabasePayload);
    
    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error saving account: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedAccounts = isEditing
        ? userData.accounts.map(a => a.id === accountId ? finalAccount : a)
        : [...userData.accounts, finalAccount];
    
    dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Account ${isEditing ? 'updated' : 'saved'}.`, type: 'success' } });
};

export const deleteAccountAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    accountId: string
) => {
    const { userData } = state;
    if (!userData) throw new Error('User data not available');

    const { error } = await supabase.from('accounts').delete().eq('id', accountId);

    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error deleting account: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedAccounts = userData.accounts.filter(a => a.id !== accountId);
    dispatch({ type: 'UPDATE_ACCOUNTS', payload: updatedAccounts });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Account deleted.', type: 'success' } });
};

export const saveNoteAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    noteData: Omit<Note, 'id'> & { id?: string },
    isEditing: boolean
): Promise<Note> => {
    const { userData, currentUser } = state;
    if (!userData || !currentUser) throw new Error('User data not available');

    const noteId = isEditing ? noteData.id! : crypto.randomUUID();
    const finalNote: Note = { ...noteData, id: noteId };

    const supabasePayload = { ...finalNote, user_id: currentUser.id };
    const { error } = await supabase.from('notes').upsert(supabasePayload);
    
    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error saving note: ${error.message}`, type: 'error' } });
        throw error;
    }

    const updatedNotes = isEditing
        ? userData.notes.map(n => n.id === noteId ? finalNote : n)
        : [finalNote, ...userData.notes];
    
    dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
    dispatch({ type: 'SHOW_TOAST', payload: { message: `Note ${isEditing ? 'updated' : 'saved'}.`, type: 'success' } });
    return finalNote;
};

export const deleteNoteAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    noteId: string
) => {
    const { userData } = state;
    if (!userData) throw new Error('User data not available');
    
    const { error } = await supabase.from('notes').delete().eq('id', noteId);

    if (error) {
        dispatch({ type: 'SHOW_TOAST', payload: { message: `Error deleting note: ${error.message}`, type: 'error' } });
        throw error;
    }
    
    const updatedNotes = userData.notes.filter(n => n.id !== noteId);
    dispatch({ type: 'UPDATE_NOTES', payload: updatedNotes });
    dispatch({ type: 'SHOW_TOAST', payload: { message: 'Note deleted.', type: 'success' } });
};

export const fetchMoreNotesAction = async (
    dispatch: Dispatch<Action>,
    state: AppState,
    pageSize: number
) => {
    const { currentUser, userData } = state;
    if (!currentUser || !userData) return;

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
        dispatch({ type: 'FETCH_MORE_NOTES_SUCCESS', payload: { notes: newNotes, hasMore: newNotes.length === pageSize } });

    } catch (error) {
        console.error("Failed to fetch more notes:", error);
        dispatch({ type: 'FETCH_MORE_NOTES_START' }); // Reset loading state on error
        dispatch({ type: 'SHOW_TOAST', payload: { message: 'Could not load more notes.', type: 'error' } });
    }
};