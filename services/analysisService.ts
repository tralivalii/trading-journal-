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

    const labels = sortedTrades.map(t => new Date(t.date).toLocaleDateString());
    
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

const getRRCategory = (rr: number): string => {
    if (rr < 1) return "< 1:1";
    if (rr < 2) return "1:1 - 1:2";
    if (rr < 3) return "1:2 - 1:3";
    if (rr < 4) return "1:3 - 1:4";
    return "> 1:4";
};

export const findKeyCorrelations = (trades: Trade[]): string => {
    if (trades.length < 3) {
        return "Not enough trades to find meaningful patterns.";
    }

    const getSignificanceThreshold = (count: number): number => {
        if (count < 5) return 0.8; // 80% for very small samples
        if (count < 10) return 0.7; // 70% for small samples
        return 0.6; // 60% for larger samples
    };

    const singleFactorThreshold = getSignificanceThreshold(trades.length);
    const twoFactorThreshold = 0.75; // High threshold for secondary correlation

    const patterns: Set<string> = new Set();
    const totalTrades = trades.length;
    
    const propertiesToAnalyze: { name: string; getValue: (t: Trade) => string | undefined }[] = [
        { name: 'Pair', getValue: t => t.pair },
        { name: 'Direction', getValue: t => t.direction },
        { name: 'Entry Type', getValue: t => t.entry },
        { name: 'Stoploss Type', getValue: t => t.stoploss },
        { name: 'Take Profit Type', getValue: t => t.takeprofit },
        { name: 'Close Type', getValue: t => t.closeType },
        { name: 'R:R', getValue: t => getRRCategory(t.rr) },
    ];

    let allCounts: { name: string; value: string; count: number }[] = [];

    // --- Part 1: Single-Factor Analysis ---
    propertiesToAnalyze.forEach(prop => {
        const counts: Record<string, number> = {};
        trades.forEach(trade => {
            const value = prop.getValue(trade);
            if (value) {
                counts[value] = (counts[value] || 0) + 1;
            }
        });

        Object.entries(counts).forEach(([value, count]) => {
            allCounts.push({ name: prop.name, value, count });
            // This logic ensures ALL significant single-factor patterns are collected.
            if (count / totalTrades >= singleFactorThreshold) {
                const percentage = ((count / totalTrades) * 100).toFixed(0);
                patterns.add(`- ${percentage}% of trades have '${prop.name}: ${value}'`);
            }
        });
    });

    // --- Part 2: Time Slot Analysis ---
    const getTimeSlot = (date: Date): string => {
        const hour = date.getHours();
        if (hour >= 8 && hour < 12) return "Morning Session (08-12)";
        if (hour >= 12 && hour < 16) return "Afternoon Session (12-16)";
        if (hour >= 16 && hour < 20) return "Evening Session (16-20)";
        return "Night Session";
    };

    const timeSlotCounts: Record<string, number> = {};
    trades.forEach(trade => {
        const slot = getTimeSlot(new Date(trade.date));
        timeSlotCounts[slot] = (timeSlotCounts[slot] || 0) + 1;
    });

    Object.entries(timeSlotCounts).forEach(([slot, count]) => {
        if (count / totalTrades >= singleFactorThreshold) {
            const percentage = ((count / totalTrades) * 100).toFixed(0);
            patterns.add(`- ${percentage}% of trades occur during the ${slot}`);
        }
    });

    // --- Part 3: Two-Factor Analysis ---
    // Only run if no strong single patterns were found, to avoid redundancy
    if (patterns.size === 0 && allCounts.length > 0) {
        // Find the most frequent item overall, even if it's not "significant" on its own
        const primaryFactor = allCounts.sort((a, b) => b.count - a.count)[0];
        
        // Ensure the primary factor is not trivial (e.g. covers almost all trades)
        if (primaryFactor.count < totalTrades && primaryFactor.count > 1) {
            const primaryTrades = trades.filter(t => {
                const prop = propertiesToAnalyze.find(p => p.name === primaryFactor.name);
                return prop && prop.getValue(t) === primaryFactor.value;
            });

            const secondaryProperties = propertiesToAnalyze.filter(p => p.name !== primaryFactor.name);
            let secondaryCorrelations: { name: string; value: string; count: number; percentage: number }[] = [];

            secondaryProperties.forEach(prop => {
                const counts: Record<string, number> = {};
                primaryTrades.forEach(trade => {
                    const value = prop.getValue(trade);
                    if (value) {
                        counts[value] = (counts[value] || 0) + 1;
                    }
                });

                Object.entries(counts).forEach(([value, count]) => {
                    if (count / primaryTrades.length >= twoFactorThreshold) {
                        secondaryCorrelations.push({
                            name: prop.name,
                            value,
                            count,
                            percentage: (count / primaryTrades.length) * 100,
                        });
                    }
                });
            });

            if (secondaryCorrelations.length > 0) {
                // Find the strongest secondary correlation
                const bestSecondary = secondaryCorrelations.sort((a, b) => b.percentage - a.percentage)[0];
                patterns.add(`- High Correlation: ${bestSecondary.percentage.toFixed(0)}% of trades with '${primaryFactor.name}: ${primaryFactor.value}' also have '${bestSecondary.name}: ${bestSecondary.value}'.`);
            }
        }
    }


    if (patterns.size === 0) {
        return "No significant patterns identified with the current settings.";
    }

    return Array.from(patterns).join('\n');
};