import { UserData, Account, Trade, Note, Result } from '../types';
import { v4 as uuidv4 } from 'uuid';

const today = new Date();
const one_month_ago = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

const demoAccounts: Account[] = [
  {
    id: 'acc-demo-1',
    name: 'Demo Futures Account',
    initialBalance: 50000,
    isArchived: false,
    currency: 'USD',
  },
  {
    id: 'acc-demo-2',
    name: 'Demo Swing Account',
    initialBalance: 10000,
    isArchived: false,
    currency: 'USD',
  },
];

const demoTrades: Trade[] = [
    {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 2)).toISOString(),
        pair: 'ES',
        bias: 'Long',
        narrative: 'Price swept liquidity and showed a strong reaction, expecting a move higher.',
        result: Result.Win,
        pnl: 1250,
        risk: 1,
        rr: 2.5,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 12.50,
        analysisD1: { text: 'Daily timeframe shows a bullish structure.', image: null },
        analysis1h: { text: '1h chart shows a clear break of structure to the upside.', image: null },
        analysis5m: { text: '5m entry on a pullback to a fair value gap.', image: null },
        analysisResult: { text: 'Trade hit take profit target with minimal drawdown.', image: null },
    },
    {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 5)).toISOString(),
        pair: 'NQ',
        bias: 'Short',
        narrative: 'Market structure shift on the 1h, targeting weekly lows.',
        result: Result.Loss,
        pnl: -500,
        risk: 1,
        rr: 3,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 10.50,
        analysisD1: { text: 'Daily shows weakness, potential reversal.', image: null },
        analysis1h: { text: 'Bearish order block formed after a liquidity grab.', image: null },
        analysis5m: { text: 'Entry on a retracement to the order block.', image: null },
        analysisResult: { text: 'Stop loss was hit as the price continued to rally.', image: null },
    },
     {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 7)).toISOString(),
        pair: 'AAPL',
        bias: 'Long',
        narrative: 'Earnings beat expectations, looking for continuation.',
        result: Result.Win,
        pnl: 450,
        risk: 2,
        rr: 2.25,
        accountId: 'acc-demo-2',
        riskAmount: 200,
        commission: 5.50,
        analysisD1: { text: 'Strong daily candle closure above resistance.', image: null },
        analysis1h: { text: 'Consolidating above the breakout level.', image: null },
        analysis5m: { text: 'Entry on a dip to the VWAP.', image: null },
        analysisResult: { text: 'Scaled out profits into strength.', image: null },
    },
     {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 10)).toISOString(),
        pair: 'GC',
        bias: 'Short',
        narrative: 'Fed minutes were hawkish, expecting a stronger dollar and weaker gold.',
        result: Result.Breakeven,
        pnl: 0,
        risk: 1,
        rr: 4,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 15.00,
        analysisD1: { text: 'Daily is in a downtrend.', image: null },
        analysis1h: { text: 'Price is respecting a key resistance level.', image: null },
        analysis5m: { text: 'Entry after a rejection from the level.', image: null },
        analysisResult: { text: 'Moved stop to breakeven, then got stopped out.', image: null },
    }
];

const demoNotes: Note[] = [
    {
        id: uuidv4(),
        date: new Date().toISOString(),
        title: 'Weekly Review',
        content: 'This week was profitable. My patience has improved, and I am cutting losing trades faster. I need to work on my entry precision on the 5m chart.'
    },
     {
        id: uuidv4(),
        date: new Date(one_month_ago).toISOString(),
        title: 'Psychology Note',
        content: 'Felt FOMO today and entered a trade that was not part of my plan. I need to stick to my rules and wait for A+ setups.'
    }
];

export const demoData: UserData = {
    accounts: demoAccounts,
    trades: demoTrades,
    notes: demoNotes,
    analysisTimeframes: ['Daily', '4H', '1H', '15m'],
    defaultSettings: {
        accountId: 'acc-demo-1',
        pair: 'ES',
        entry: 'FVG',
        risk: 1,
        stoploss: 'Session High/Low',
        takeprofit: 'Fractal',
    },
};
