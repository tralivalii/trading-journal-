import { UserData, Account, Trade, Note, Result, CloseType, AnalysisResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

const GUEST_USER_ID = 'guest-user-id';
const GUEST_ACCOUNT_ID_1 = 'guest-account-id-1';
const GUEST_ACCOUNT_ID_2 = 'guest-account-id-2';

const startDate = new Date();
startDate.setMonth(startDate.getMonth() - 2);

const generateRandomDate = (start: Date): Date => {
  const end = new Date();
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const getRandomElement = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const generateDemoTrade = (accountId: string): Omit<Trade, 'user_id'> => {
  const result = getRandomElement([Result.Win, Result.Loss, Result.Breakeven]);
  const pnl = result === Result.Win ? Math.random() * 200 + 50 : result === Result.Loss ? -(Math.random() * 100 + 20) : 0;
  const risk = 100;
  const rr = pnl / risk;

  return {
    id: uuidv4(),
    date: generateRandomDate(startDate).toISOString(),
    pair: getRandomElement(['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD']),
    bias: getRandomElement(['Bullish', 'Bearish']),
    narrative: 'A sample trade narrative describing the setup and execution.',
    result: result,
    pnl: parseFloat(pnl.toFixed(2)),
    risk: parseFloat(risk.toFixed(2)),
    rr: parseFloat(rr.toFixed(2)),
    accountId: accountId,
    closeType: result === Result.Win ? CloseType.TP : result === Result.Loss ? CloseType.SL : CloseType.Manual,
    analysisD1: 'Sample D1 analysis.',
    analysis1h: 'Sample 1h analysis.',
    analysis5m: 'Sample 5m analysis.',
    analysisResult: AnalysisResult.Good,
    screenshotUrl: '',
    commission: 5.50,
  };
};

const demoAccounts: Account[] = [
  {
    id: GUEST_ACCOUNT_ID_1,
    user_id: GUEST_USER_ID,
    name: 'Primary Demo Account',
    initialBalance: 50000,
    currency: 'USD',
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: GUEST_ACCOUNT_ID_2,
    user_id: GUEST_USER_ID,
    name: 'Challenge Account',
    initialBalance: 100000,
    currency: 'USD',
    isArchived: false,
    createdAt: new Date().toISOString(),
  },
];

const demoTrades: Trade[] = Array.from({ length: 35 }, (_, i) =>
  generateDemoTrade(i % 3 === 0 ? GUEST_ACCOUNT_ID_2 : GUEST_ACCOUNT_ID_1)
).map(t => ({ ...t, user_id: GUEST_USER_ID }));

const demoNotes: Note[] = [
  {
    id: uuidv4(),
    user_id: GUEST_USER_ID,
    date: new Date().toISOString(),
    content: 'This is a sample note about market observations. It\'s a good practice to keep a journal of your thoughts and ideas.',
    tags: ['psychology', 'observations'],
  },
  {
    id: uuidv4(),
    user_id: GUEST_USER_ID,
    date: new Date(Date.now() - 86400000 * 2).toISOString(),
    content: 'Reviewing last week\'s performance. I need to work on cutting losses sooner and not widening my stop loss.',
    tags: ['review', 'improvement'],
  },
];

export const demoData: UserData = {
  accounts: demoAccounts,
  trades: demoTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
  notes: demoNotes,
};
