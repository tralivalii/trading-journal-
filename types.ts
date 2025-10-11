// FIX: Provided full content for missing types.ts file.

export enum Result {
  Win = 'Win',
  Loss = 'Loss',
  Breakeven = 'Breakeven',
  InProgress = 'In Progress',
  Missed = 'Missed',
}

export enum Currency {
    USD = 'USD',
    EUR = 'EUR',
    GBP = 'GBP',
    JPY = 'JPY',
    AUD = 'AUD',
    CAD = 'CAD',
    CHF = 'CHF',
    NZD = 'NZD',
}

export interface Trade {
  id: string;
  userId: string;
  accountId: string;
  date: string; // ISO string
  pair: string;
  direction: 'Long' | 'Short';
  result: Result;
  rr: number;
  pnl: number;
  risk: number; // percentage
  entryType?: string;
  takeProfitType?: string;
  stoplossType?: string;
  closeType?: string;
  entryPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  setup?: string; // Markdown
  execution?: string; // Markdown
  outcome?: string; // Markdown
  screenshotBeforeKey?: string | null;
  screenshotAfterKey?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Stats {
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  breakevens: number;
  missed: number;
  averageRR: number;
  totalRR: number;
  netProfit: number;
  profitSum: number;
  lossSum: number;
}

export interface Account {
  id: string;
  userId: string;
  name: string;
  initialBalance: number;
  currency: Currency;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  userId: string;
  date: string; // ISO string
  content: string; // Markdown
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
    id?: string;
    userId: string;
    riskPerTrade: number; // default risk percentage
}

export interface UserData {
    trades: Trade[];
    accounts: Account[];
    notes: Note[];
    settings: UserSettings;
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}
