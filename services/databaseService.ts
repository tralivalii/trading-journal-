// services/databaseService.ts
import { UserData, Trade, Account, Direction, Result, Currency, Note } from '../types';

// This is our "database" stored in localStorage.
// In a real app, this would be a remote server.
const DB_KEY = 'trading_journal_main_database';
const LATENCY = 300; // Simulate network latency

interface Database {
  [email: string]: UserData;
}

const getDb = (): Database => {
  try {
    const dbString = localStorage.getItem(DB_KEY);
    return dbString ? JSON.parse(dbString) : {};
  } catch (e) {
    console.error("Failed to parse database from localStorage", e);
    return {};
  }
};

const saveDb = (db: Database) => {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
};

const getDefaultUserData = (): UserData => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const threeDaysAgoStr = new Date(new Date().setDate(today.getDate() - 3)).toISOString().split('T')[0];
  const lastMonthStr = new Date(new Date().setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
  const twoMonthsAgoStr = new Date(new Date().setMonth(today.getMonth() - 2)).toISOString().split('T')[0];
  
  const defaultAccountId = crypto.randomUUID();

  return {
    trades: [
      {
        id: crypto.randomUUID(),
        date: todayStr,
        accountId: defaultAccountId,
        pair: 'BTC/USDT',
        setup: 'IDM',
        direction: Direction.Long,
        risk: 1,
        rr: 2.5,
        riskAmount: 100,
        result: Result.Win,
        pnl: 245,
        commission: 5,
        analysisD1: { notes: 'Uptrend on D1' },
        analysis1h: { notes: 'Break of structure on 1h' },
        analysis5m: { notes: 'Entry on FVG' },
        analysisResult: { notes: 'Target hit perfectly' },
      },
      {
        id: crypto.randomUUID(),
        date: threeDaysAgoStr,
        accountId: defaultAccountId,
        pair: 'ETH/USDT',
        setup: 'CHoCH',
        direction: Direction.Short,
        risk: 1,
        rr: 1.5,
        riskAmount: 100,
        result: Result.Loss,
        pnl: -103,
        commission: 3,
        analysisD1: { notes: 'Range bound' },
        analysis1h: { notes: 'Liquidity sweep' },
        analysis5m: { notes: 'Stopped out' },
        analysisResult: { notes: 'Bad read on momentum' },
      },
      {
        id: crypto.randomUUID(),
        date: lastMonthStr,
        accountId: defaultAccountId,
        pair: 'BTC/USDT',
        setup: 'IDM',
        direction: Direction.Long,
        risk: 1.5,
        rr: 3,
        riskAmount: 150,
        result: Result.Win,
        pnl: 444,
        commission: 6,
        analysisD1: { notes: 'Clear uptrend' },
        analysis1h: { notes: 'Pullback to demand zone' },
        analysis5m: { notes: 'Confirmation entry' },
        analysisResult: { notes: 'Great trade' },
      },
      {
        id: crypto.randomUUID(),
        date: twoMonthsAgoStr,
        accountId: defaultAccountId,
        pair: 'SOL/USDT',
        setup: 'IDM',
        direction: Direction.Long,
        risk: 1,
        rr: 4,
        riskAmount: 100,
        result: Result.Win,
        pnl: 396,
        commission: 4,
        analysisD1: {},
        analysis1h: {},
        analysis5m: {},
        analysisResult: {},
      }
    ],
    accounts: [
      {
        id: defaultAccountId,
        name: 'Main Account',
        initialBalance: 10000,
        currency: Currency.USD
      }
    ],
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    setups: ['IDM', 'CHoCH'],
    risks: [1, 1.5, 2],
    defaultSettings: {
      accountId: defaultAccountId,
      pair: 'BTC/USDT',
      setup: 'IDM',
      risk: 1,
    },
    notes: [
      {
        id: crypto.randomUUID(),
        date: new Date(new Date().setDate(today.getDate() - 1)).toISOString().split('T')[0],
        content: "Market is showing signs of a potential reversal. Need to be cautious with long positions and look for confirmation before entering shorts."
      },
      {
        id: crypto.randomUUID(),
        date: new Date(new Date().setDate(today.getDate() - 7)).toISOString().split('T')[0],
        content: "Psychology check: I've been hesitating on entries this week. Need to trust my analysis and stick to the plan. FOMO is not a strategy."
      }
    ],
  };
};

// --- Public API ---

/**
 * Initializes the data store for a newly registered user.
 */
export const initializeUser = (email: string): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const db = getDb();
      if (!db[email]) {
        db[email] = getDefaultUserData();
        saveDb(db);
      }
      resolve();
    }, LATENCY);
  });
};

/**
 * Fetches all data for a given user.
 */
export const getUserData = (email: string): Promise<UserData> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const db = getDb();
      // If user data doesn't exist for some reason, initialize it.
      if (!db[email]) {
        db[email] = getDefaultUserData();
        saveDb(db);
      }
      resolve(db[email]);
    }, LATENCY);
  });
};

/**
 * Saves all data for a given user.
 */
export const saveUserData = (email: string, data: UserData): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const db = getDb();
      db[email] = data;
      saveDb(db);
      resolve();
    }, LATENCY);
  });
};

/**
 * Deletes all data for a given user.
 */
export const deleteUserData = (email: string): Promise<void> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const db = getDb();
        delete db[email];
        saveDb(db);
        resolve();
      }, LATENCY);
    });
}