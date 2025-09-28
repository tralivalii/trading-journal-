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
  image?: string; // Base64 string
  notes?: string;
}

export interface Trade {
  id: string;
  date: string;
  accountId: string;
  pair: string;
  setup: string;
  direction: Direction;
  risk: number; // The % risk from dropdown
  rr: number; // The R:R ratio
  riskAmount: number; // The actual $ amount risked
  result: Result;
  pnl: number; // This will be calculated on save
  commission?: number;
  
  // New structured analysis
  analysisD1: Analysis;
  analysis1h: Analysis;
  analysis5m: Analysis;
  analysisResult: Analysis;
}

export interface Account {
  id:string;
  name: string;
  initialBalance: number;
  currency?: Currency;
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

export interface DefaultSettings {
    accountId: string;
    pair: string;
    setup: string;
    risk: number | string;
}

export interface UserData {
    trades: Trade[];
    accounts: Account[];
    pairs: string[];
    setups: string[];
    risks: number[];
    defaultSettings: DefaultSettings;
    notes: Note[];
}