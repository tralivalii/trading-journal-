// types.ts

export enum Currency {
  USD = 'USD',
  EUR = 'EUR',
}

export enum Result {
  Win = 'Win',
  Loss = 'Loss',
  Breakeven = 'Breakeven',
  InProgress = 'In Progress',
  Missed = 'Missed',
}

export enum Direction {
  Long = 'Long',
  Short = 'Short',
}

// New type for analysis sections
export interface Analysis {
  image?: string; // This is now an ID/key for an image in IndexedDB
  notes?: string;
}

export interface Trade {
  id: string;
  date: string; // Will store full ISO string for time analysis
  accountId: string;
  pair: string;
  entry: string;
  direction: Direction;
  risk: number; // The % risk from dropdown
  rr: number; // The R:R ratio
  riskAmount: number; // The actual $ amount risked
  result: Result;
  pnl: number; // This will be calculated on save
  commission?: number;
  stoploss: string;
  takeprofit: string;
  
  // New fields for deeper analysis
  entryPrice?: number;
  stoplossPrice?: number;
  takeprofitPrice?: number;
  closeType?: string;
  
  // New structured analysis
  analysisD1: Analysis;
  analysis1h: Analysis;
  analysis5m: Analysis;
  analysisResult: Analysis;

  // AI-powered analysis result
  aiAnalysis?: string;
}

export interface Account {
  id:string;
  name: string;
  initialBalance: number;
  currency?: Currency;
  isArchived?: boolean;
}

export interface User {
  email: string;
  // NOTE: In a real-world application, never store passwords in plaintext.
  // This is a simplified simulation for a frontend-only context.
  password?: string;
}

export interface Note {
  id: string;
  date: string;
  content: string;
  tags?: string[];
  isFavorite?: boolean;
  attachments?: {
    name: string;
    type: string; // MIME type
    data: string; // This is now an ID/key for an image in IndexedDB
  }[];
}

export interface Stats {
  totalTrades: number;
  winRate: number;
  wins: number;
  losses: number;
  breakevens: number;
  // FIX: Corrected typo from `anumber` to `number`.
  missed: number;
  averageRR: number;
  totalRR: number;
  netProfit: number;
  profitSum: number;
  lossSum: number;
}

export interface DefaultSettings {
    accountId: string;
    pair: string;
    entry: string;
    risk: number | string;
}

export interface UserData {
    trades: Trade[];
    accounts: Account[];
    pairs: string[];
    entries: string[];
    risks: number[];
    defaultSettings: DefaultSettings;
    notes: Note[];
    stoplosses: string[];
    // FIX: Corrected typo from `takeprofite` to `takeprofits` to resolve type errors.
    takeprofits: string[];
    closeTypes: string[];
}