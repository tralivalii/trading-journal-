import { UserData, Account, Trade, Note, Result, Direction, CloseType } from '../types';
import { v4 as uuidv4 } from 'uuid';

const today = new Date();
const one_month_ago = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

const demoAccounts: Account[] = [
  {
    id: 'acc-demo-1',
    name: 'Futures Demo',
    initialBalance: 50000,
    isArchived: false,
    currency: 'USD',
  },
  {
    id: 'acc-demo-2',
    name: 'Swing Trading Demo',
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
        direction: Direction.Long,
        narrative: 'Price swept session liquidity and showed a strong bullish reaction. Entered on a pullback to a 5m fair value gap, targeting previous day high.',
        result: Result.Win,
        pnl: 1250,
        risk: 1,
        rr: 2.5,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 12.50,
        closeType: 'TP hit',
        analysisD1: { text: 'Daily timeframe shows a clear bullish market structure. Price is respecting the daily uptrend.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=Daily+Chart' },
        analysis1h: { text: '1h chart shows a clear break of structure to the upside after taking liquidity.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=1H+Chart' },
        analysis5m: { text: '5m entry on a pullback to a fair value gap, confirming entry with a displacement.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=5m+Chart' },
        analysisResult: { text: 'Trade hit take profit target with minimal drawdown. The analysis was correct.', image: 'https://placehold.co/600x400/10B981/FFFFFF?text=WIN' },
    },
    {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 5)).toISOString(),
        pair: 'NQ',
        direction: Direction.Short,
        narrative: 'Market structure shift on the 1h timeframe after a grab of buy-side liquidity. Targeting weekly lows.',
        result: Result.Loss,
        pnl: -500,
        risk: 1,
        rr: 3,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 10.50,
        closeType: 'SL hit',
        analysisD1: { text: 'Daily shows weakness, potential for a reversal pattern forming.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=Daily+Chart' },
        analysis1h: { text: 'A bearish order block formed after the liquidity grab, signaling a potential reversal.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=1H+Chart' },
        analysis5m: { text: 'Entry on a retracement to the newly formed bearish order block.', image: null },
        analysisResult: { text: 'Stop loss was hit as the price continued to rally higher. The reversal thesis was invalidated.', image: 'https://placehold.co/600x400/EF4444/FFFFFF?text=LOSS' },
    },
     {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 7)).toISOString(),
        pair: 'AAPL',
        direction: Direction.Long,
        narrative: 'Positive earnings report was a catalyst. Looking for a continuation of the bullish momentum after a period of consolidation.',
        result: Result.Win,
        pnl: 450,
        risk: 2,
        rr: 2.25,
        accountId: 'acc-demo-2',
        riskAmount: 200,
        commission: 5.50,
        closeType: 'Manual close',
        analysisD1: { text: 'Strong daily candle closure above a key resistance level, indicating strength.', image: 'https://placehold.co/600x400/232733/F0F0F0?text=Daily+Chart' },
        analysis1h: { text: 'Consolidating nicely above the breakout level, forming a bull flag.', image: null },
        analysis5m: { text: 'Entry on a dip to the VWAP, which was acting as dynamic support.', image: null },
        analysisResult: { text: 'Scaled out profits into strength as the market showed signs of exhaustion.', image: 'https://placehold.co/600x400/10B981/FFFFFF?text=WIN' },
    },
     {
        id: uuidv4(),
        date: new Date().toISOString(),
        pair: 'EURUSD',
        direction: Direction.Long,
        narrative: 'Looking for a retracement to a key support level on the 4h chart.',
        result: Result.InProgress,
        pnl: 0,
        risk: 0.5,
        rr: 2,
        accountId: 'acc-demo-2',
        riskAmount: 50,
        commission: 3.50,
        closeType: undefined,
        analysisD1: { text: 'Daily trend is bullish, but showing signs of short-term consolidation.', image: null },
        analysis1h: { text: 'Waiting for price to pull back to the demand zone.', image: null },
        analysis5m: { text: 'Will look for a confirmation entry on the 5m once the 1h zone is reached.', image: null },
        analysisResult: { text: '', image: null },
    },
    {
        id: uuidv4(),
        date: new Date(today.setDate(today.getDate() - 10)).toISOString(),
        pair: 'GC',
        direction: Direction.Short,
        narrative: 'Fed minutes were hawkish, expecting a stronger dollar and weaker gold. Entered after a clear rejection from a key resistance level.',
        result: Result.Breakeven,
        pnl: 0,
        risk: 1,
        rr: 4,
        accountId: 'acc-demo-1',
        riskAmount: 500,
        commission: 15.00,
        closeType: 'Time stop',
        analysisD1: { text: 'Daily is in a clear downtrend, respecting the moving averages.', image: null },
        analysis1h: { text: 'Price is respecting a key resistance level, with multiple wicks rejecting it.', image: null },
        analysis5m: { text: 'Entry after a bearish engulfing candle printed on the 5m chart.', image: null },
        analysisResult: { text: 'Price failed to move decisively in my direction, so I moved my stop to breakeven. Got stopped out for a scratch trade.', image: 'https://placehold.co/600x400/8A91A8/FFFFFF?text=BREAKEVEN' },
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
        content: 'Felt FOMO today and entered a trade that was not part of my plan. This resulted in an unnecessary loss. I must stick to my rules and wait for A+ setups only.'
    }
];

export const demoData: UserData = {
    accounts: demoAccounts,
    trades: demoTrades,
    notes: demoNotes,
    analysisTimeframes: ['Daily', '4H', '1H', '15m'],
    closeTypes: ['TP hit', 'SL hit', 'Manual close', 'Time stop', 'Invalidated'],
    defaultSettings: {
        accountId: 'acc-demo-1',
        pair: 'ES',
        entry: 'FVG',
        risk: 1,
        stoploss: 'Session High/Low',
        takeprofit: 'Fractal',
    },
    // These are not part of the demo data from the server but are here for type consistency
    pairs: [],
    entries: [],
    risks: [],
    stoplosses: [],
    takeprofits: [],
};
