// FIX: Provided full content for missing aiService.ts file.
import { GoogleGenAI } from "@google/genai";
import { Trade } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

export async function analyzeTradeWithAI(trade: Trade): Promise<string> {
    if (!process.env.API_KEY) {
        return "API key is not configured. AI analysis is unavailable.";
    }

    const prompt = `
        Analyze the following forex trade and provide constructive feedback. Focus on the setup, execution, and outcome.
        Keep the analysis concise, actionable, and professional, under 150 words.

        Trade Details:
        - Pair: ${trade.pair}
        - Direction: ${trade.direction}
        - Result: ${trade.result}
        - R:R Ratio: ${trade.rr.toFixed(2)}
        - PnL: ${trade.pnl.toFixed(2)}
        - Setup Notes: ${trade.setup || 'N/A'}
        - Execution Notes: ${trade.execution || 'N/A'}
        - Outcome Notes: ${trade.outcome || 'N/A'}
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text;
    } catch (error) {
        console.error("Error analyzing trade with AI:", error);
        return "An error occurred while analyzing the trade. Please try again later.";
    }
}