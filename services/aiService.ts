// services/aiService.ts
import { GoogleGenAI } from "@google/genai";
import { Trade } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
    console.warn("API_KEY environment variable not set. AI features will be disabled.");
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

export async function generateInsightsForTrades(trades: Trade[], tradeGroup: string): Promise<string> {
    if (!ai) {
        return Promise.resolve("AI Service is disabled. Please configure your API_KEY.");
    }
    
    if (trades.length < 3) {
        return Promise.resolve("Not enough trades in this group to find meaningful patterns.");
    }

    // Simplify trade data to send to the model
    const simplifiedTrades = trades.map(t => {
        const tradeDate = new Date(t.date);
        const dayOfWeek = tradeDate.toLocaleString('en-us', { weekday: 'long' });
        const timeOfDay = tradeDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        return {
            pair: t.pair,
            direction: t.direction,
            entry: t.entry,
            rr: t.rr,
            stoploss: t.stoploss,
            takeprofit: t.takeprofit,
            closeType: t.closeType,
            dayOfWeek: dayOfWeek,
            timeOfDay: timeOfDay,
            notes: [
                t.analysisD1.notes,
                t.analysis1h.notes,
                t.analysis5m.notes,
                t.analysisResult.notes
            ].filter(Boolean).join('; ')
        };
    });
    
    const prompt = `
        You are a professional trading performance analyst.
        I will provide you with a set of my recent trades that all resulted in a ${tradeGroup}.
        Your task is to analyze this data to find the most significant recurring patterns or correlations.
        Focus on connections between parameters like entry type, stop loss type, take profit type, closing reason, time of day, day of week, and pair.

        Based on your analysis, provide a concise, bulleted list of the top 2-3 patterns you've identified. 
        Each bullet point should be a single, clear statement. 
        If you find a strong correlation, state it directly.

        Example outputs:
        - A high percentage of losses are associated with the 'Manual' close type.
        - Winning trades frequently occur on BTC/USDT during morning hours (08:00-11:00).
        - The 'IDM' entry strategy shows a strong positive correlation with winning trades on Wednesdays.

        Do not add any intro or conclusion, just provide the bulleted list. If no significant patterns are found, return the text "No significant patterns identified."

        Here is the trade data in JSON format:
        ${JSON.stringify(simplifiedTrades, null, 2)}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        return "An error occurred while generating AI insights. Please check the console for details.";
    }
}
