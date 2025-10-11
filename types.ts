// FIX: Provided full content for missing types.ts file.
// REFACTORED: Expanded types to include all features like default settings and analysis timeframes.

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
  tpType?: string;
  slType?: string;
  closeType?: string;
  entryPrice?: number;
  sl?: number;
  tp?: number;
  notesD1?: string;
  notes1h?: string;
  notes5m?: string;
  notesResult?: string;
  // FIX: Added missing properties to the Trade interface.
  setup?: string;
  execution?: string;
  outcome?: string;
  screenshotD1Key?: string | null;
  screenshot1hKey?: string | null;
  screenshot5mKey?: string | null;
  screenshotResultKey?: string | null;
  aiAnalysis?: string;
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

export interface DefaultSettings {
    pair: string;
    direction: 'Long' | 'Short';
    risk: number;
    rr: number;
    entryType: string;
    slType: string;
    tpType: string;
    closeType: string;
}

export interface UserData {
    id?: string;
    userId: string;
    riskPerTrade: number;
    slTypes: string[];
    tpTypes: string[];
    entryTypes: string[];
    closeTypes: string[];
    defaultSettings: DefaultSettings;
    analysisTimeframes: string[];
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
}