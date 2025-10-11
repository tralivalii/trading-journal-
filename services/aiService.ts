import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Trade, Analysis } from '../types';

async function imageUrlToBase64(url: string): Promise<{ mimeType: string; data: string }> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // result is in the format "data:image/jpeg;base64,...."
            const [header, data] = result.split(',');
            if (!header || !data) {
                return reject(new Error("Invalid base64 string format."));
            }
            const mimeType = header.split(';')[0].split(':')[1];
            resolve({ mimeType, data });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

const timeframeToFieldMap: Record<string, keyof Trade> = {
    '1D': 'analysisD1',
    '1h': 'analysis1h',
    '5m': 'analysis5m',
    'Result': 'analysisResult',
};

export const analyzeTradeWithAI = async (trade: Trade, analysisTimeframes: string[], imageUrls: string[]): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API key is not configured.");
    }
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const analysisNotes = analysisTimeframes
        .map(timeframe => {
            const field = timeframeToFieldMap[timeframe];
            if (!field) return null;
            const analysis = trade[field] as Analysis | undefined;
            if (analysis && analysis.notes) {
                return `- ${timeframe} Analysis Notes: ${analysis.notes}`;
            }
            return null;
        })
        .filter(Boolean)
        .join('\n');

    const textPart = {
        text: `
          Act as a professional trading coach. Analyze the following trade based on the provided data and images.
          Be objective, concise, and provide actionable feedback. Focus on the process, not just the outcome.

          Trade Data:
          - Pair: ${trade.pair}
          - Direction: ${trade.direction}
          - Result: ${trade.result}
          - PnL: $${trade.pnl.toFixed(2)}
          - Risk: ${trade.risk}%
          - R:R Ratio: ${trade.rr}
          - Entry Type: ${trade.entry || 'N/A'}
          - Stoploss Type: ${trade.stoploss || 'N/A'}
          - Take Profit Type: ${trade.takeprofit || 'N/A'}
          - Close Type: ${trade.closeType || 'N/A'}

          Trader's Notes:
          ${analysisNotes || 'No notes provided.'}
          
          Your tasks:
          1.  **Confluence Check:** Based on the notes and charts (if provided), was there strong reasoning for entering the trade?
          2.  **Risk Management:** Was the R:R and risk percentage appropriate?
          3.  **Execution:** Was the entry and management of the trade (SL/TP types, close type) well-handled?
          4.  **Key Takeaway:** What is the single most important lesson from this trade?
          5.  **Rating:** Give an overall rating for this trade on a scale of 1-10 (process, not outcome).

          Provide your analysis in a structured, easy-to-read format. Do not repeat the input data.
        `,
    };

    const imageParts = await Promise.all(
        imageUrls.map(async url => {
            const { mimeType, data } = await imageUrlToBase64(url);
            return {
                inlineData: { mimeType, data }
            };
        })
    );

    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [textPart, ...imageParts] },
    });
    
    return response.text;
};