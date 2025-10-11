
// FIX: Changed import to be a relative path
import { Trade, Result, Stats } from '../types';

export function calculateStats(trades: Trade[]): Stats {
  const completedTrades = trades.filter(t => t.result !== Result.InProgress);
  const totalTrades = completedTrades.length;
  
  // Net profit is calculated on all trades since in-progress have 0 PNL and don't affect the sum, but should be reflected in the total.
  const netProfit = trades.reduce((sum, trade) => sum + trade.pnl, 0);

  if (totalTrades === 0) {
    return { totalTrades: 0, winRate: 0, wins: 0, losses: 0, breakevens: 0, missed: 0, averageRR: 0, totalRR: 0, netProfit, profitSum: 0, lossSum: 0 };
  }

  const wins = completedTrades.filter(t => t.result === Result.Win);
  const losses = completedTrades.filter(t => t.result === Result.Loss);
  const breakevens = completedTrades.filter(t => t.result === Result.Breakeven);
  const missed = completedTrades.filter(t => t.result === Result.Missed);

  const winRate = (wins.length + losses.length) > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;
  
  const totalRR = wins.reduce((sum, trade) => sum + trade.rr, 0);
  const averageRR = wins.length > 0 ? totalRR / wins.length : 0;

  const profitSum = wins.reduce((sum, trade) => sum + trade.pnl, 0);
  const lossSum = losses.reduce((sum, trade) => sum + trade.pnl, 0);

  return {
    totalTrades,
    winRate,
    wins: wins.length,
    losses: losses.length,
    breakevens: breakevens.length,
    missed: missed.length,
    averageRR,
    totalRR,
    netProfit,
    profitSum,
    lossSum,
  };
}

export function filterTradesByPeriod(trades: Trade[], period: 'week' | 'month' | 'quarter' | 'all' | 'this-month' | 'last-month' | 'this-quarter'): Trade[] {
    const now = new Date();
    if (period === 'all') return trades;

    return trades.filter(trade => {
        const tradeDate = new Date(trade.date);
        const currentYear = now.getFullYear();
        switch(period) {
            case 'week': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                weekStart.setHours(0,0,0,0);
                return tradeDate >= weekStart;
            }
            case 'month':
            case 'this-month': {
                const currentMonth = now.getMonth();
                return tradeDate.getMonth() === currentMonth && tradeDate.getFullYear() === currentYear;
            }
             case 'last-month': {
                const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lastMonth = lastMonthDate.getMonth();
                const yearOfLastMonth = lastMonthDate.getFullYear();
                return tradeDate.getMonth() === lastMonth && tradeDate.getFullYear() === yearOfLastMonth;
            }
            case 'quarter':
            case 'this-quarter': {
                const currentQuarter = Math.floor(now.getMonth() / 3);
                const tradeQuarter = Math.floor(tradeDate.getMonth() / 3);
                return tradeQuarter === currentQuarter && tradeDate.getFullYear() === currentYear;
            }
            default:
                return true;
        }
    });
}