
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 獲取特定的恐慌貪婪指數 (美股從 CNN, 虛幣從 Coinglass)
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "請搜索並提供兩個最新的恐慌貪婪指數數據：1. CNN Business 的美股恐慌貪婪指數。 2. Coinglass 提供的虛擬貨幣恐慌貪婪指數 (Crypto Fear & Greed Index)。輸出包含數值 (0-100) 與標籤。",
      config: {
        systemInstruction: "你是一個專業的金融數據提取助手。請使用 Google Search 獲取最新的數據。輸出必須為 JSON 格式，包含 stock (score, label) 和 crypto (score, label) 兩個對象。",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stock: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                label: { type: Type.STRING }
              },
              required: ['score', 'label']
            },
            crypto: {
              type: Type.OBJECT,
              properties: {
                score: { type: Type.INTEGER },
                label: { type: Type.STRING }
              },
              required: ['score', 'label']
            }
          },
          required: ['stock', 'crypto']
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Fear & Greed Index Search Error:", error);
    return null;
  }
};

// 基礎分析：生成結構化報告，強制要求參考 TradingView 數據
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」(Global Chief Strategy Officer)。
    你的任務：對資產 ${symbol} 進行深度診斷。
    你必須使用搜尋工具，優先參考 TradingView 的實時數據、報價與技術圖表分析。
    輸出結構必須嚴格遵守 JSON，包含 summary, recommendation, detailedAnalysis, sentimentScore, sentimentLabel, keyLevels。
    語言：${isChinese ? '繁體中文' : 'English'}。
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `身為策略大師，請搜索 TradingView 上關於 "${symbol}" 的最新實時價格與技術指標，並提供深度診斷。`,
      config: {
        systemInstruction,
        tools: [{googleSearch: {}}],
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

    const data = JSON.parse(response.text.trim());
    
    // 提取搜尋來源
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter((s: any) => s.title && s.uri) || [];

    return { ...data, sources };
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

// 對話功能：與 AI 大師即時交談，參考 TradingView
export const getChatResponse = async (symbol: string, history: any[], message: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」。
    當前討論資產：${symbol}。
    你必須優先搜尋 TradingView 的數據來回答問題。
    語言：必須使用${isChinese ? '繁體中文' : 'English'}。
  `;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction,
        tools: [{googleSearch: {}}]
      },
      history: history.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }))
    });

    const response = await chat.sendMessage({ message });
    
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter((s: any) => s.title && s.uri) || [];

    return { text: response.text, sources };
  } catch (error) {
    console.error("Chat Error:", error);
    return { 
      text: isChinese ? "抱歉，大師目前忙碌中，請稍後再試。" : "Sorry, the Master is currently busy. Please try again later.",
      sources: []
    };
  }
};
