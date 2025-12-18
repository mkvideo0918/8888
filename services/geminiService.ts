
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// Use process.env.API_KEY directly and initialize inside the function
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const systemInstruction = `You are a world-class financial analyst (AI Master). 
  Analyze the current economic trends, news, and technical signals for ${symbol}.
  Provide a detailed report in ${language === 'zh-TW' ? 'Traditional Chinese' : 'English'}.
  Include: 
  1. Market Sentiment.
  2. Technical Indicators Summary.
  3. Risk Assessment.
  4. Final Verdict (Buy, Sell, Hold, or Neutral).
  Keep it professional and data-driven. Output in JSON format.`;

  // Use gemini-3-pro-preview for complex reasoning and set thinkingBudget
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Analyze ${symbol} for me.`,
    config: {
      systemInstruction,
      thinkingConfig: { thinkingBudget: 32768 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          recommendation: { type: Type.STRING, enum: ['Buy', 'Hold', 'Sell', 'Neutral'] },
          detailedAnalysis: { type: Type.STRING },
        },
        required: ['summary', 'recommendation', 'detailedAnalysis']
      }
    }
  });

  // Use response.text directly as a property
  return JSON.parse(response.text?.trim() || '{}');
};
