// services/databaseService.ts
import { UserData, Trade, Account, Direction, Result, Currency, Note } from '../types';

const DB_NAME = 'trading_journal_main_database_v2';
const STORE_NAME = 'users_data';
const DB_VERSION = 1;

let db: IDBDatabase;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("IndexedDB error:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const dbInstance = (event.target as IDBOpenDBRequest).result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        // The key will be the user's email.
        dbInstance.createObjectStore(STORE_NAME, { keyPath: 'email' });
      }
    };
  });
};


const getDefaultUserData = (): UserData => {
  const today = new Date();
  const defaultAccountId = crypto.randomUUID();
  const initialStoplosses = ['fractal', 'FVG', 'OB', 'Sessions'];
  const initialTakeprofits = ['fractal', 'FVG', 'OB', 'Sessions'];
  const initialCloseTypes = ['SL Hit', 'TP Hit', 'Manual', 'Missed TP'];

  const existingTrades: Trade[] = [
      {
        id: crypto.randomUUID(),
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() -1, 15, 30).toISOString(),
        accountId: defaultAccountId,
        pair: 'BTC/USDT',
        entry: 'IDM',
        direction: Direction.Long,
        risk: 1,
        rr: 2.5,
        riskAmount: 100,
        result: Result.Win,
        pnl: 245,
        commission: 5,
        stoploss: 'FVG',
        takeprofit: 'fractal',
        entryPrice: 68000,
        stoplossPrice: 67800,
        takeprofitPrice: 68500,
        closeType: 'TP Hit',
        analysisD1: { notes: 'Uptrend on D1, bullish market structure.' },
        analysis1h: { notes: 'Break of structure on 1h confirmed upside momentum.' },
        analysis5m: { notes: 'Entry on FVG after a liquidity sweep.' },
        analysisResult: { notes: 'Target hit perfectly at the opposing order block.' },
      },
      {
        id: crypto.randomUUID(),
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3, 10, 45).toISOString(), // Original loss moved to morning session
        accountId: defaultAccountId,
        pair: 'ETH/USDT',
        entry: 'CHoCH',
        direction: Direction.Short,
        risk: 1.5,
        rr: 1.5,
        riskAmount: 150,
        result: Result.Loss,
        pnl: -153,
        commission: 3,
        stoploss: 'Sessions',
        takeprofit: 'OB',
        entryPrice: 3500,
        stoplossPrice: 3520,
        takeprofitPrice: 3470,
        closeType: 'SL Hit',
        analysisD1: { notes: 'Range bound on the daily chart, no clear direction.' },
        analysis1h: { notes: 'A liquidity sweep above the Asian session high, looked like a good short.' },
        analysis5m: { notes: 'News spike pushed price through my stop loss.' },
        analysisResult: { notes: 'Bad read on momentum. Should have avoided trading before the news event.' },
      },
      {
        id: crypto.randomUUID(),
        date: new Date(today.getFullYear(), today.getMonth() -1, 15, 10, 0).toISOString(),
        accountId: defaultAccountId,
        pair: 'BTC/USDT',
        entry: 'IDM',
        direction: Direction.Long,
        risk: 1,
        rr: 3,
        riskAmount: 100,
        result: Result.Win,
        pnl: 294,
        commission: 6,
        stoploss: 'OB',
        takeprofit: 'Sessions',
        entryPrice: 65000,
        stoplossPrice: 64800,
        takeprofitPrice: 65600,
        closeType: 'TP Hit',
        analysisD1: { notes: 'Clear uptrend, buying dips.' },
        analysis1h: { notes: 'Pullback to a key demand zone on the 1-hour chart.' },
        analysis5m: { notes: 'Waited for a 5m confirmation entry and got a great fill.' },
        analysisResult: { notes: 'Excellent trade, followed the plan perfectly.' },
      },
      {
        id: crypto.randomUUID(),
        date: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20, 11, 20).toISOString(),
        accountId: defaultAccountId,
        pair: 'SOL/USDT',
        entry: 'IDM',
        direction: Direction.Long,
        risk: 2.5, // High risk for alert testing
        rr: 4,
        riskAmount: 250,
        result: Result.Win,
        pnl: 996,
        commission: 4,
        stoploss: 'fractal',
        takeprofit: 'fractal',
        entryPrice: 160,
        stoplossPrice: 158,
        takeprofitPrice: 168,
        closeType: 'Manual',
        analysisD1: { notes: 'Very bullish momentum on SOL.'},
        analysis1h: {},
        analysis5m: {notes: 'Closed manually before TP as market looked overextended.'},
        analysisResult: {},
      }
    ];

    const newTestTrades: Trade[] = [
    // Two-Factor Loss Test Case: 3 manual losses, all on ETH. With 4 total losses, this won't trigger a single pattern but will trigger the 2-factor.
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2, 14, 10).toISOString(), accountId: defaultAccountId,
      pair: 'ETH/USDT', entry: 'CHoCH', direction: Direction.Short, risk: 1, rr: 1.2, riskAmount: 100,
      result: Result.Loss, pnl: -102, commission: 2, stoploss: 'Sessions', takeprofit: 'OB', closeType: 'Manual',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    },
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2, 16, 30).toISOString(), accountId: defaultAccountId,
      pair: 'ETH/USDT', entry: 'IDM', direction: Direction.Short, risk: 1, rr: 2, riskAmount: 100,
      result: Result.Loss, pnl: -102, commission: 2, stoploss: 'fractal', takeprofit: 'fractal', closeType: 'Manual',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    },
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 3, 11, 0).toISOString(), accountId: defaultAccountId,
      pair: 'ETH/USDT', entry: 'IDM', direction: Direction.Long, risk: 1.5, rr: 1, riskAmount: 150,
      result: Result.Loss, pnl: -153, commission: 3, stoploss: 'FVG', takeprofit: 'Sessions', closeType: 'Manual',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    },
    
    // Time Slot Win Test Case: Add 3 new wins in the morning to the existing ones.
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 9, 15).toISOString(), accountId: defaultAccountId,
      pair: 'SOL/USDT', entry: 'IDM', direction: Direction.Long, risk: 1, rr: 3, riskAmount: 100,
      result: Result.Win, pnl: 298, commission: 2, stoploss: 'OB', takeprofit: 'Sessions', closeType: 'TP Hit',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    },
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 10, 30).toISOString(), accountId: defaultAccountId,
      pair: 'BTC/USDT', entry: 'IDM', direction: Direction.Long, risk: 1, rr: 2, riskAmount: 100,
      result: Result.Win, pnl: 198, commission: 2, stoploss: 'fractal', takeprofit: 'fractal', closeType: 'TP Hit',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    },
    {
      id: crypto.randomUUID(), date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2, 9, 45).toISOString(), accountId: defaultAccountId,
      pair: 'ETH/USDT', entry: 'CHoCH', direction: Direction.Long, risk: 1, rr: 2.5, riskAmount: 100,
      result: Result.Win, pnl: 248, commission: 2, stoploss: 'FVG', takeprofit: 'OB', closeType: 'TP Hit',
      analysisD1: {}, analysis1h: {}, analysis5m: {}, analysisResult: {}
    }
  ];


  return {
    trades: [...existingTrades, ...newTestTrades],
    accounts: [
      {
        id: defaultAccountId,
        name: 'Main Account',
        initialBalance: 10000,
        currency: Currency.USD,
        isArchived: false,
      }
    ],
    pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
    entries: ['IDM', 'CHoCH'],
    risks: [1, 1.5, 2, 2.5],
    defaultSettings: {
      accountId: defaultAccountId,
      pair: 'BTC/USDT',
      entry: 'IDM',
      risk: 1,
    },
    notes: [
      {
        id: crypto.randomUUID(),
        date: new Date(new Date().setDate(today.getDate() - 1)).toISOString(),
        content: "Market is showing signs of a potential reversal. Need to be cautious with long positions and look for confirmation before entering shorts. The volume on the down moves is increasing, and key support levels are being tested. Watching the DXY for correlation.",
        tags: ['analysis', 'market-sentiment'],
        isFavorite: true,
      },
      {
        id: crypto.randomUUID(),
        date: new Date(new Date().setDate(today.getDate() - 7)).toISOString(),
        content: "Psychology Check-in: I've been hesitating on entries this week. Need to trust my analysis and stick to the plan. FOMO is not a strategy. The market doesn't care about my feelings. Discipline is key.",
        tags: ['psychology'],
        isFavorite: false,
      }
    ],
    stoplosses: initialStoplosses,
    takeprofits: initialTakeprofits,
    closeTypes: initialCloseTypes,
  };
};


// --- Public API ---

/**
 * Initializes the data store for a newly registered user if they don't exist.
 */
export const initializeUser = async (email: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(email);
        
        request.onsuccess = () => {
            if (!request.result) {
                const writeTransaction = db.transaction(STORE_NAME, 'readwrite');
                const writeStore = writeTransaction.objectStore(STORE_NAME);
                const newUserRecord = { email, data: getDefaultUserData() };
                const writeRequest = writeStore.put(newUserRecord);

                writeRequest.onsuccess = () => resolve();
                writeRequest.onerror = () => reject(writeRequest.error);
            } else {
                resolve(); // User already exists
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Fetches all data for a given user.
 */
export const getUserData = async (email: string): Promise<UserData | null> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(email);

        request.onsuccess = () => {
            if (request.result) {
                resolve(request.result.data);
            } else {
                // If user data doesn't exist, initialize it and return the default data.
                console.warn(`No data found for ${email}, initializing with defaults.`);
                initializeUser(email).then(() => {
                    resolve(getDefaultUserData());
                }).catch(reject);
            }
        };
        request.onerror = () => reject(request.error);
    });
};

/**
 * Updates one or more properties of a user's data.
 */
export const updateUserData = async (email: string, updates: Partial<UserData>): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(email);

        request.onerror = () => reject(request.error);
        
        request.onsuccess = () => {
            const existingRecord = request.result;
            if (existingRecord) {
                const updatedData = { ...existingRecord.data, ...updates };
                const putRequest = store.put({ email, data: updatedData });

                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                reject(new Error(`User data not found for email: ${email}`));
            }
        };
    });
};


/**
 * Deletes all data for a given user.
 */
export const deleteUserData = async (email: string): Promise<void> => {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(email);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
