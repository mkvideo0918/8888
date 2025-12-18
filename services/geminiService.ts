
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 基礎分析：生成結構化報告
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」(Global Chief Strategy Officer)。
    你的任務：對資產 ${symbol} 進行深度診斷。
    輸出結構必須嚴格遵守 JSON，包含 summary, recommendation, detailedAnalysis, sentimentScore, sentimentLabel, keyLevels。
    語言：${isChinese ? '繁體中文' : 'English'}。
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `身為策略大師，請對資產代碼 "${symbol}" 提供當前的深度市場分析報告與情緒評分。`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            recommendation: { type: Type.STRING, enum: ['Buy', 'Hold', 'Sell', 'Neutral'] },
            detailedAnalysis: { type: Type.STRING },
            sentimentScore: { type: Type.INTEGER },
            sentimentLabel: { type: Type.STRING },
            keyLevels: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ['summary', 'recommendation', 'detailedAnalysis', 'sentimentScore', 'sentimentLabel', 'keyLevels']
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

// 對話功能：與 AI 大師即時交談
export const getChatResponse = async (symbol: string, history: any[], message: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」。
    當前正在與客戶討論資產：${symbol}。
    你的回答必須具備：
    1. 專業度：使用正確的金融術語（如：超買、背離、流動性壓力、通膨預期等）。
    2. 深度：不只是回答表面，要分析背後的經濟邏輯。
    3. 語氣：冷靜、優雅、自信、大師風範。
    4. 語言：必須使用${isChinese ? '繁體中文' : 'English'}。
    5. 限制：不要給予具體的財務建議，只提供分析觀點。
  `;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { systemInstruction },
      history: history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }))
    });

    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Chat Error:", error);
    return isChinese ? "抱歉，大師目前忙碌中，請稍後再試。" : "Sorry, the Master is currently busy. Please try again later.";
  }
};
