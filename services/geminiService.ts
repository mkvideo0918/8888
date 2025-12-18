
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 獲取特定的恐慌貪婪指數 (美股從 CNN, 虛幣從 Alternative.me/Coinglass)
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // 使用極其明確的搜尋目標，增加成功率
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Please search and provide the LATEST real-time data for: 1. CNN Business Fear & Greed Index (Stock Market). 2. Alternative.me Crypto Fear & Greed Index. I need the current numeric score (0-100) and the sentiment label for both.",
      config: {
        systemInstruction: "You are a specialized financial data agent. Search the web and extract the CURRENT Fear and Greed Index values. Output MUST be a single JSON object. Format: { \"stock\": { \"score\": number, \"label\": \"string\" }, \"crypto\": { \"score\": number, \"label\": \"string\" } }. Do not include markdown formatting or extra text.",
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

    // 強大的解析與清理邏輯
    let jsonStr = response.text.trim();
    // 移除可能存在的 Markdown 代碼塊標記
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    const data = JSON.parse(jsonStr);
    
    // 簡單的數值驗證
    if (typeof data.stock.score !== 'number' || typeof data.crypto.score !== 'number') {
      throw new Error("Invalid data format received from AI");
    }
    
    return data;
  } catch (error) {
    console.error("Fear & Greed Index Fetching Error:", error);
    throw error;
  }
};

// 基礎分析報告：生成結構化 JSON，優先參考 TradingView
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `身為策略大師，請搜索 TradingView 上關於 "${symbol}" 的最新實時價格與技術指標，並提供深度診斷。`,
      config: {
        systemInstruction: `你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」。請使用 Google Search 並優先參考 TradingView 數據。輸出格式為 ${isChinese ? '繁體中文' : 'English'} 的 JSON。`,
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

    const text = response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    const data = JSON.parse(text);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter((s: any) => s.title && s.uri) || [];

    return { ...data, sources };
  } catch (error) {
    console.error("Market Analysis Error:", error);
    return null;
  }
};

// 對話功能改為串流 (Streaming)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  const systemInstruction = `你是全球首席金融策略大師。目前分析：${symbol}。必須參考 TradingView 最新動態。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction,
        tools: [{googleSearch: {}}]
      },
      history: history.filter(m => m.text).map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }))
    });

    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    for await (const chunk of result) {
      const chunkText = chunk.text;
      fullText += chunkText;
      onChunk(fullText);
    }
    return fullText;
  } catch (error) {
    console.error("Chat Stream Error:", error);
    const errorMsg = isChinese ? "系統繁忙，請稍後再試。" : "System busy, please try again.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
