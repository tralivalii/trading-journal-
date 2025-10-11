import { Trade, Result, Direction } from '../types';

interface GroupStats {
    count: number;
    avgRisk: number;
    avgRR: number;
    slHitRate: number;
    tpHitRate: number;
    manualCloseRate: number;
    avgSlDistance: number;
    // New detailed distribution stats
    distributionByEntry: Record<string, number>;
    distributionByDirection: Record<string, number>;
    distributionByPair: Record<string, number>;
    distributionByDay: Record<string, number>;
    avgCommissionImpact: number; // as a percentage of gross PnL
    distributionByRR: Record<string, number>;
    distributionByStoploss?: Record<string, number>;
    distributionByTakeProfit?: Record<string, number>;
    distributionByCloseType?: Record<string, number>;
}

type AnalysisData = {
    [key in Result]?: GroupStats;
};

// Helper to get distribution of items in an array
const getDistribution = (arr: (string | undefined)[]): Record<string, number> => {
    const filteredArr = arr.filter(Boolean) as string[];
    if (filteredArr.length === 0) return {};
    return filteredArr.reduce((acc, value) => {
        acc[value] = (acc[value] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);
};

const getRRDistribution = (trades: Trade[]): Record<string, number> => {
    const bins: Record<string, number> = {
        "< 1:1": 0,
        "1:1 - 1:2": 0,
        "1:2 - 1:3": 0,
        "1:3 - 1:4": 0,
        "> 1:4": 0,
    };

    trades.forEach(trade => {
        if (trade.rr < 1) bins["< 1:1"]++;
        else if (trade.rr < 2) bins["1:1 - 1:2"]++;
        else if (trade.rr < 3) bins["1:2 - 1:3"]++;
        else if (trade.rr < 4) bins["1:3 - 1:4"]++;
        else bins["> 1:4"]++;
    });

    // Filter out empty bins
    return Object.entries(bins).reduce((acc, [key, value]) => {
        if (value > 0) {
            acc[key] = value;
        }
        return acc;
    }, {} as Record<string, number>);
};


export const analyzeTradeGroups = (trades: Trade[]): AnalysisData => {
    const analysis: AnalysisData = {};
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    Object.values(Result).forEach(result => {
        if (result === Result.InProgress) return;

        const groupTrades = trades.filter(t => t.result === result);
        const groupTradesWithPrices = groupTrades.filter(t => t.entryPrice && t.stoplossPrice);

        if (groupTrades.length === 0) {
            analysis[result] = { 
                count: 0, avgRisk: 0, avgRR: 0, slHitRate: 0, tpHitRate: 0, manualCloseRate: 0, avgSlDistance: 0,
                distributionByEntry: {}, distributionByDirection: {}, distributionByPair: {}, distributionByDay: {}, avgCommissionImpact: 0,
                distributionByRR: {},
            };
            return;
        }

        const totalRisk = groupTrades.reduce((sum, t) => sum + t.risk, 0);
        const totalRR = groupTrades.reduce((sum, t) => sum + t.rr, 0);

        const slHits = groupTrades.filter(t => t.closeType === 'SL Hit').length;
        const tpHits = groupTrades.filter(t => t.closeType === 'TP Hit').length;
        const manualCloses = groupTrades.filter(t => t.closeType === 'Manual').length;
        
        const totalSlDistance = groupTradesWithPrices.reduce((sum, t) => sum + Math.abs(t.entryPrice! - t.stoplossPrice!), 0);
        
        const totalCommissions = groupTrades.reduce((sum, t) => sum + (t.commission || 0), 0);
        const totalAbsoluteGrossPnl = groupTrades.reduce((sum, t) => {
            const grossPnl = t.pnl + (t.commission || 0);
            return sum + Math.abs(grossPnl);
        }, 0);
        
        const distributionByRR = getRRDistribution(groupTrades);
        const distributionByStoploss = result === Result.Loss ? getDistribution(groupTrades.map(t => t.stoploss)) : undefined;
        const distributionByTakeProfit = result === Result.Win ? getDistribution(groupTrades.map(t => t.takeprofit)) : undefined;
        const distributionByCloseType = result !== Result.Missed ? getDistribution(groupTrades.map(t => t.closeType)) : undefined;


        analysis[result] = {
            count: groupTrades.length,
            avgRisk: totalRisk / groupTrades.length,
            avgRR: totalRR / groupTrades.length,
            slHitRate: (slHits / groupTrades.length) * 100,
            tpHitRate: (tpHits / groupTrades.length) * 100,
            manualCloseRate: (manualCloses / groupTrades.length) * 100,
            avgSlDistance: groupTradesWithPrices.length > 0 ? totalSlDistance / groupTradesWithPrices.length : 0,
            distributionByEntry: getDistribution(groupTrades.map(t => t.entry)),
            distributionByDirection: getDistribution(groupTrades.map(t => t.direction)),
            distributionByPair: getDistribution(groupTrades.map(t => t.pair)),
            distributionByDay: getDistribution(groupTrades.map(t => daysOfWeek[new Date(t.date).getDay()])),
            avgCommissionImpact: totalAbsoluteGrossPnl > 0 ? (totalCommissions / totalAbsoluteGrossPnl) * 100 : 0,
            distributionByRR,
            distributionByStoploss,
            distributionByTakeProfit,
            distributionByCloseType,
        };
    });

    return analysis;
};

export interface HeatmapData {
    labels: { risk: string[], pnl: string[] };
    data: number[][];
    maxCount: number;
}

export const generateCorrelationData = (trades: Trade[]): HeatmapData => {
    const completed = trades.filter(t => t.result === Result.Win || t.result === Result.Loss);
    if (completed.length < 5) return { labels: { risk: [], pnl: [] }, data: [], maxCount: 0 };
    
    const riskBins = [0, 1, 1.5, 2, Infinity];
    const riskLabels = ['<1%', '1-1.5%', '1.5-2%', '>2%'];

    const pnlExtent = completed.reduce((max, t) => Math.max(max, Math.abs(t.pnl)), 0);
    const pnlStep = pnlExtent / 2;
    const pnlBins = [-Infinity, -pnlStep, 0, pnlStep, Infinity];
    const pnlLabels = [`<-${pnlStep.toFixed(0)}`, `-${pnlStep.toFixed(0)}-0`, `0-${pnlStep.toFixed(0)}`, `>${pnlStep.toFixed(0)}`];

    const data = Array(pnlLabels.length).fill(0).map(() => Array(riskLabels.length).fill(0));
    let maxCount = 0;

    completed.forEach(trade => {
        const riskIndex = riskBins.findIndex(bin => trade.risk < bin) - 1;
        const pnlIndex = pnlBins.findIndex(bin => trade.pnl < bin) - 1;
        if(riskIndex >= 0 && pnlIndex >= 0) {
            data[pnlIndex][riskIndex]++;
            if(data[pnlIndex][riskIndex] > maxCount) {
                maxCount = data[pnlIndex][riskIndex];
            }
        }
    });
    
    return { labels: { risk: riskLabels, pnl: pnlLabels.reverse() }, data: data.reverse(), maxCount };
};


export const generateTemporalData = (trades: Trade[]) => {
    const sortedTrades = [...trades]
        .filter(t => t.result !== Result.InProgress)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let cumulativePnl = 0;
    const data = sortedTrades.map(t => {
        cumulativePnl += t.pnl;
        return cumulativePnl;
    });

    const labels = sortedTrades.map(t => new Date(t.date).toLocaleDateString('en-US'));
    
    const pointColors = sortedTrades.map(t => {
         switch (t.result) {
            case Result.Win: return 'rgba(52, 211, 153, 1)'; // green
            case Result.Loss: return 'rgba(239, 68, 68, 1)'; // red
            case Result.Breakeven: return 'rgba(156, 163, 175, 1)'; // gray
            case Result.Missed: return 'rgba(96, 165, 250, 1)'; // blue
            default: return 'rgba(255, 255, 255, 1)';
         }
    });

    return { labels, data, pointColors };
};

export interface StreakStats {
    longestWinStreak: number;
    longestLossStreak: number;
    currentStreak: { type: 'win' | 'loss' | 'none', count: number };
}

export const calculateStreaks = (trades: Trade[]): StreakStats => {
    const sortedTrades = [...trades]
        .filter(t => t.result === Result.Win || t.result === Result.Loss)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (sortedTrades.length === 0) {
        return { longestWinStreak: 0, longestLossStreak: 0, currentStreak: { type: 'none', count: 0 } };
    }

    let longestWinStreak = 0;
    let longestLossStreak = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of sortedTrades) {
        if (trade.result === Result.Win) {
            currentWinStreak++;
            currentLossStreak = 0; // Reset loss streak
            if (currentWinStreak > longestWinStreak) {
                longestWinStreak = currentWinStreak;
            }
        } else if (trade.result === Result.Loss) {
            currentLossStreak++;
            currentWinStreak = 0; // Reset win streak
            if (currentLossStreak > longestLossStreak) {
                longestLossStreak = currentLossStreak;
            }
        }
    }
    
    let currentStreakCount = 0;
    let currentStreakType: StreakStats['currentStreak']['type'] = 'none';

    if (sortedTrades.length > 0) {
        const lastResult = sortedTrades[sortedTrades.length - 1].result;
        if (lastResult === Result.Win || lastResult === Result.Loss) {
            currentStreakType = lastResult === Result.Win ? 'win' : 'loss';
            for (let i = sortedTrades.length - 1; i >= 0; i--) {
                const currentTradeResult = sortedTrades[i].result;
                if (currentTradeResult === Result.Win || currentTradeResult === Result.Loss) {
                     if ((currentStreakType === 'win' && currentTradeResult === Result.Win) || (currentStreakType === 'loss' && currentTradeResult === Result.Loss)) {
                        currentStreakCount++;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
        }
    }

    return {
        longestWinStreak,
        longestLossStreak,
        currentStreak: { type: currentStreakType, count: currentStreakCount }
    };
};