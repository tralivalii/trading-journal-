import React, { createContext, useReducer, useContext, Dispatch, ReactNode, useEffect } from 'react';
import { UserData, User, Trade, Note, Account, DefaultSettings, Analysis, Currency, Direction, Result } from '../types';
import { supabase } from './supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';


// --- GUEST MODE SAMPLE DATA ---

const GUEST_ACCOUNTS: Account[] = [
  { id: 'guest-acc-1', name: 'Main Account (Sample)', initialBalance: 50000, currency: Currency.USD, isArchived: false },
  { id: 'guest-acc-2', name: 'FTMO Challenge (Sample)', initialBalance: 100000, currency: Currency.USD, isArchived: false },
  { id: 'guest-acc-3', name: 'Old EUR Account (Sample)', initialBalance: 10000, currency: Currency.EUR, isArchived: true },
];

const createGuestTrade = (id: number, daysAgo: number, overrides: Partial<Trade>): Trade => {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    
    const baseTrade: Trade = {
        id: `guest-trade-${id}`,
        date: date.toISOString(),
        accountId: 'guest-acc-1',
        pair: 'EUR/USD',
        entry: 'Continuation',
        direction: Direction.Long,
        risk: 1,
        rr: 2.5,
        riskAmount: 0, // will be calculated
        result: Result.Win,
        pnl: 0, // will be calculated
        commission: 5,
        stoploss: 'Previous Low',
        takeprofit: 'Next High',
        analysisD1: { notes: 'Daily trend is bullish, respecting the moving averages.' },
        analysis1h: { notes: '1H structure broke to the upside, indicating potential for continuation.' },
        analysis5m: { notes: 'Waited for a 5m pullback to a key level and entered on confirmation.' },
        analysisResult: { notes: 'Trade played out as expected. TP was hit cleanly.' },
        ...overrides,
    };
    
    const riskAmount = (50000 * (baseTrade.risk / 100));
    baseTrade.riskAmount = riskAmount;
    
    if (baseTrade.result === Result.Win) {
        baseTrade.pnl = (riskAmount * baseTrade.rr) - (baseTrade.commission || 0);
    } else if (baseTrade.result === Result.Loss) {
        baseTrade.pnl = -riskAmount - (baseTrade.commission || 0);
    } else {
        baseTrade.pnl = -(baseTrade.commission || 0);
    }
    
    return baseTrade;
};

const GUEST_TRADES: Trade[] = [
    createGuestTrade(1, 2, { pair: 'EUR/USD', direction: Direction.Long, result: Result.Win, rr: 3.1 }),
    createGuestTrade(2, 3, { pair: 'GBP/USD', direction: Direction.Short, result: Result.Loss, rr: 2.0 }),
    createGuestTrade(3, 5, { pair: 'XAU/USD', direction: Direction.Long, result: Result.Win, rr: 4.5, risk: 0.5 }),
    createGuestTrade(4, 7, { pair: 'BTC/USDT', direction: Direction.Short, result: Result.Breakeven, rr: 1.5 }),
    createGuestTrade(5, 8, { pair: 'EUR/USD', direction: Direction.Short, result: Result.Loss, rr: 2.2 }),
    createGuestTrade(6, 10, { pair: 'ETH/USDT', direction: Direction.Long, result: Result.Win, rr: 5.0, risk: 0.75, accountId: 'guest-acc-2' }),
    createGuestTrade(7, 12, { pair: 'GBP/USD', direction: Direction.Long, result: Result.Loss, rr: 1.8 }),
    createGuestTrade(8, 15, { pair: 'XAU/USD', direction: Direction.Short, result: Result.Win, rr: 2.8, analysisResult: {notes: 'Manually closed early due to news event approaching.'}, closeType: 'Manual' }),
    createGuestTrade(9, 20, { pair: 'EUR/USD', direction: Direction.Long, result: Result.Win, rr: 3.3 }),
    createGuestTrade(10, 25, { pair: 'BTC/USDT', direction: Direction.Long, result: Result.Loss, rr: 2.0, accountId: 'guest-acc-2' }),
    createGuestTrade(11, 32, { pair: 'EUR/USD', direction: Direction.Long, result: Result.Win, rr: 2.1 }),
    createGuestTrade(12, 35, { pair: 'GBP/USD', direction: Direction.Short, result: Result.Win, rr: 2.9 }),
    createGuestTrade(13, 40, { pair: 'XAU/USD', direction: Direction.Long, result: Result.Missed, rr: 4.0 }),
];

const GUEST_NOTES: Note[] = [
    { id: 'guest-note-1', date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), content: "Weekly Review (Sample)\n\n- Followed plan on most trades.\n- Over-risked on GBP/USD loss, need to be more disciplined.\n- Overall a profitable week." },
    { id: 'guest-note-2', date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), content: "Psychology Note (Sample)\n\nFelt FOMO after missing the XAU/USD trade. It's important to remember that there will always be another opportunity. Stick to the plan." },
    { id: 'guest-note-3', date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(), content: "Backtesting Results for new EUR/USD strategy (Sample)\n\n- Win Rate: 65%\n- Avg R:R: 2.8\n- Looks promising, will forward test on a small account." },
];

const GUEST_USER_DATA: UserData = {
    accounts: GUEST_ACCOUNTS,
    trades: GUEST_TRADES,
    notes: GUEST_NOTES,
    pairs: ['EUR/USD', 'GBP/USD', 'USD/JPY', 'XAU/USD', 'BTC/USDT', 'ETH/USDT'],
    entries: ['2.0', 'Market', 'Order block', 'FVG', 'IDM'],
    risks: [0.5, 1, 1.5, 2, 2.5, 3, 4, 5],
    defaultSettings: { accountId: 'guest-acc-1', pair: 'EUR/USD', entry: '2.0', risk: 1 },
    stoplosses: ['Session High/Low', 'FVG', 'Order block'],
    takeprofits: ['Session High/Low', 'FVG', 'Order block'],
    closeTypes: ['SL Hit', 'TP Hit', 'Manual', 'Breakeven'],
};


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
  | { type: 'SET_GUEST_MODE' };

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
                isGuest: false, // Real session logs out guest
            };
        case 'SET_GUEST_MODE':
            const guestUser = {
                id: 'guest-user',
                app_metadata: { provider: 'email' },
                user_metadata: {},
                aud: 'authenticated',
                created_at: new Date().toISOString(),
                email: 'guest@example.com'
            };
            return {
                ...state,
                isGuest: true,
                userData: GUEST_USER_DATA,
                session: {
                    access_token: 'guest-token',
                    token_type: 'bearer',
                    user: guestUser,
                    expires_in: 3600,
                    expires_at: Date.now() + 3600 * 1000,
                    refresh_token: 'guest-refresh-token'
                },
                currentUser: guestUser,
                isLoading: false,
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
export const saveTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeToSave: Omit<Trade, 'id' | 'riskAmount' | 'pnl'> & { id?: string }, isEditing: boolean, showToast: (message: string, type?: 'success' | 'error') => void) => {
    if (state.isGuest) {
        showToast("This feature is disabled in guest mode.", 'error');
        return;
    }
    if (!state.currentUser || !state.userData) return;
    
    const { accounts, trades } = state.userData;
    const account = accounts.find(a => a.id === tradeToSave.accountId);
    if (!account) throw new Error("Account not found");

    // --- ROBUST CALCULATION LOGIC ---
    // 1. Calculate the balance based on other trades in the account, safely handling non-numeric PnL values.
    const accountTrades = trades.filter(t => t.accountId === account.id && t.id !== tradeToSave.id);
    const accountPnl = accountTrades.reduce((sum, trade) => sum + (Number(trade.pnl) || 0), 0);
    const currentBalance = account.initialBalance + accountPnl;
    
    // 2. Safely convert form inputs to numbers.
    const riskPercent = Number(tradeToSave.risk);
    const rr = Number(tradeToSave.rr);
    const commission = Number(tradeToSave.commission || 0);

    // 3. Validate that all calculation inputs are valid numbers.
    if (isNaN(riskPercent) || isNaN(rr) || isNaN(commission) || isNaN(currentBalance)) {
        console.error("Calculation input error:", {riskPercent, rr, commission, currentBalance});
        throw new Error("Calculation error: Invalid numeric input detected.");
    }
    
    // 4. Perform the calculations.
    const riskAmount = currentBalance * (riskPercent / 100);
    let pnl = 0;
    if (tradeToSave.result === 'Win') {
        pnl = riskAmount * rr;
    } else if (tradeToSave.result === 'Loss') {
        pnl = -riskAmount;
    }

    const finalPnl = pnl - commission;
    
    // 5. Final validation of calculated values before sending to DB.
    if (isNaN(riskAmount) || isNaN(finalPnl)) {
        console.error("Calculation output error:", {riskAmount, finalPnl});
        throw new Error("Calculation error: Final PnL or Risk Amount is not a number.");
    }
    // --- END OF ROBUST CALCULATION LOGIC ---


    // Supabase requires snake_case for column names if they are multi-word
    const tradeForDb = {
        user_id: state.currentUser.id,
        account_id: tradeToSave.accountId,
        date: tradeToSave.date,
        pair: tradeToSave.pair,
        direction: tradeToSave.direction,
        entry: tradeToSave.entry,
        risk: riskPercent, // Use the sanitized number
        rr: rr, // Use the sanitized number
        risk_amount: riskAmount,
        pnl: finalPnl,
        commission: commission, // Use the sanitized number
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
        
        const updatedTrades = trades.map(t => t.id === data.id ? { ...t, ...tradeToSave, riskAmount, pnl: finalPnl, risk: riskPercent, rr, commission } : t);
        dispatch({ type: 'UPDATE_TRADES', payload: updatedTrades });
    } else {
        const { data, error } = await supabase.from('trades').insert(tradeForDb).select().single();
        if (error) throw error;

        const newTrade: Trade = {
            ...tradeToSave,
            id: data.id,
            risk: riskPercent,
            rr,
            commission,
            riskAmount,
            pnl: finalPnl
        };
        dispatch({ type: 'UPDATE_TRADES', payload: [...trades, newTrade] });
    }
};

export const deleteTradeAction = async (dispatch: Dispatch<Action>, state: AppState, tradeIdToDelete: string, showToast: (message: string, type?: 'success' | 'error') => void) => {
    if (state.isGuest) {
        showToast("This feature is disabled in guest mode.", 'error');
        return;
    }
    if (!state.currentUser || !state.userData) return;
    const { trades } = state.userData;
    
    const tradeToDelete = trades.find(t => t.id === tradeIdToDelete);
    if (tradeToDelete) {
        // Delete associated images from storage
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