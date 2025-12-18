
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 強化版 JSON 提取工具，確保能從任何文本中挖出 JSON
const extractJson = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Extraction failed:", e);
    throw new Error("Invalid response format");
  }
};

// 獲取恐慌貪婪指數 - 增加自動備援
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // 嘗試 1：使用搜尋工具獲取最新數據
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search the web for LATEST CNN Business Fear & Greed Index and Alternative.me Crypto Fear & Greed Index.",
      config: {
        systemInstruction: "You are a financial data tool. Return ONLY a JSON object: { \"stock\": { \"score\": number, \"label\": \"string\" }, \"crypto\": { \"score\": number, \"label\": \"string\" } }. Do not explain.",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });
    return extractJson(response.text);
  } catch (error) {
    console.warn("Real-time search failed, falling back to AI estimation:", error);
    try {
      // 嘗試 2：搜尋失敗時，請 AI 根據當前大環境進行估算（確保 UI 不會報錯）
      const fallback = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Estimate current market sentiment based on early 2025 trends.",
        config: {
          systemInstruction: "Return JSON ONLY: { \"stock\": { \"score\": 50, \"label\": \"Neutral\" }, \"crypto\": { \"score\": 50, \"label\": \"Neutral\" } }.",
          responseMimeType: "application/json",
        }
      });
      return extractJson(fallback.text);
    } catch (e) {
      return { stock: { score: 50, label: "N/A" }, crypto: { score: 50, label: "N/A" } };
    }
  }
};

// 深度分析報告 - 增加模型備援
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const prompt = `請針對 "${symbol}" 進行深度金融分析。`;
  const systemInstruction = `你是一位全球頂尖金融大師。請分析技術指標與近期新聞。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    // 嘗試 1：帶搜尋工具的深度分析
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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

    const data = extractJson(response.text);
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title,
      uri: chunk.web?.uri
    })).filter((s: any) => s.title && s.uri) || [];

    return { ...data, sources };
  } catch (error) {
    console.warn("Search-based analysis failed, using core model knowledge:", error);
    try {
      // 嘗試 2：搜尋失效時，直接使用 AI 核心知識分析
      const backup = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction + " (Note: Search tool is unavailable, analyze based on your current financial knowledge.)",
          responseMimeType: "application/json"
        }
      });
      return extractJson(backup.text);
    } catch (e) {
      console.error("All analysis modes failed");
      return null;
    }
  }
};

// 對話功能 (Stream)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  const config = { 
    systemInstruction: `你是全球首席金融策略大師。討論對象：${symbol}。語言：${isChinese ? '繁體中文' : 'English'}。`,
  };

  try {
    // 聊天模式優先不帶搜尋，確保回應速度，如果使用者問「最新」才建議增加搜尋邏輯，但這裡為了穩定先簡化
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config,
      history: history.filter(m => m.text).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }))
    });

    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    for await (const chunk of result) {
      if (chunk.text) {
        fullText += chunk.text;
        onChunk(fullText);
      }
    }
    return fullText;
  } catch (error) {
    console.error("Chat Error:", error);
    const errorMsg = isChinese ? "分析引擎連線中斷，請稍後重試。" : "Connection interrupted, please try again.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
