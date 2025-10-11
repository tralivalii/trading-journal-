// FIX: Provided full content for missing analysisService.ts file.
import { Trade, Result } from '../types';

type Distribution = Record<string, number>;

interface GroupStats {
    count: number;
    distributionByEntry: Distribution;
    distributionByDirection: Distribution;
    distributionByPair: Distribution;
    distributionByDay: Distribution;
    distributionByRR: Distribution;
    distributionByTakeProfit?: Distribution;
    distributionByStoploss?: Distribution;
    distributionByCloseType?: Distribution;
}

// Utility functions
const getDayOfWeek = (dateString: string) => {
  const date = new Date(dateString);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
};

const getRRCategory = (rr: number) => {
    if (rr < 1) return "< 1:1";
    if (rr < 2) return "1:1 - 2:1";
    if (rr < 3) return "2:1 - 3:1";
    if (rr < 5) return "3:1 - 5:1";
    return "> 5:1";
};

const addToDistribution = (dist: Distribution, key: string | undefined) => {
    if (key) {
        dist[key] = (dist[key] || 0) + 1;
    }
};

export const analyzeTradeGroups = (trades: Trade[]) => {
    const results = Object.values(Result).reduce((acc, result) => {
        acc[result] = {
            count: 0,
            distributionByEntry: {},
            distributionByDirection: {},
            distributionByPair: {},
            distributionByDay: {},
            distributionByRR: {},
            distributionByTakeProfit: {},
            distributionByStoploss: {},
            distributionByCloseType: {},
        };
        return acc;
    }, {} as Record<Result, GroupStats>);

    for (const trade of trades) {
        const group = results[trade.result];
        if (group) {
            group.count++;
            addToDistribution(group.distributionByEntry, trade.entryType || 'N/A');
            addToDistribution(group.distributionByDirection, trade.direction);
            addToDistribution(group.distributionByPair, trade.pair);
            addToDistribution(group.distributionByDay, getDayOfWeek(trade.date));
            addToDistribution(group.distributionByRR, getRRCategory(trade.rr));
            if (group.distributionByTakeProfit) addToDistribution(group.distributionByTakeProfit, trade.takeProfitType || 'N/A');
            if (group.distributionByStoploss) addToDistribution(group.distributionByStoploss, trade.stoplossType || 'N/A');
            if (group.distributionByCloseType) addToDistribution(group.distributionByCloseType, trade.closeType || 'N/A');
        }
    }
    return results;
};

export const calculateStreaks = (trades: Trade[]) => {
    const sortedTrades = trades
        .filter(t => t.result === Result.Win || t.result === Result.Loss)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let currentStreak = { type: 'none', count: 0 };
    
    if (sortedTrades.length > 0) {
        const lastTrade = sortedTrades[sortedTrades.length - 1];
        let count = 0;
        for (let i = sortedTrades.length - 1; i >= 0; i--) {
            if (sortedTrades[i].result === lastTrade.result) {
                count++;
            } else {
                break;
            }
        }
        currentStreak = {
            type: lastTrade.result === Result.Win ? 'win' : 'loss',
            count: count
        };
    }


    for (const trade of sortedTrades) {
        if (trade.result === Result.Win) {
            currentWinStreak++;
            currentLossStreak = 0;
            if (currentWinStreak > longestWinStreak) {
                longestWinStreak = currentWinStreak;
            }
        } else if (trade.result === Result.Loss) {
            currentLossStreak++;
            currentWinStreak = 0;
            if (currentLossStreak > longestLossStreak) {
                longestLossStreak = currentLossStreak;
            }
        }
    }

    return { longestWinStreak, longestLossStreak, currentStreak };
};
