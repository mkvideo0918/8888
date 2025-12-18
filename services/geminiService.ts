
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 輔助函式：從文本中提取 JSON
const extractJson = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

// 獲取恐慌貪婪指數 - 穩定版
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search for the current CNN Business Fear & Greed Index and Alternative.me Crypto Fear & Greed Index score (0-100).",
      config: {
        systemInstruction: "Output ONLY valid JSON. Format: { \"stock\": { \"score\": number, \"label\": \"string\" }, \"crypto\": { \"score\": number, \"label\": \"string\" } }",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });
    const data = extractJson(response.text);
    if (data) return data;
    throw new Error("Invalid Data");
  } catch (error) {
    console.warn("F&G Search failed, using model prediction.");
    // 降級方案：使用模型內部的市場趨勢理解
    const fallback = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Estimate current market sentiment based on recent global economic trends.",
      config: {
        systemInstruction: "Return JSON ONLY: { \"stock\": { \"score\": 60, \"label\": \"Greed\" }, \"crypto\": { \"score\": 40, \"label\": \"Fear\" } }",
        responseMimeType: "application/json",
      }
    });
    return extractJson(fallback.text) || { stock: { score: 50, label: "Neutral" }, crypto: { score: 50, label: "Neutral" } };
  }
};

// 深度分析報告
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const prompt = `深度分析代號: "${symbol}"。包含建議、總結、技術位、詳細報告。`;
  const systemInstruction = `你是一位全球頂尖金融大師。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    const response = await ai.models.generateContent({
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
    return extractJson(response.text);
  } catch (error) {
    console.warn("Search Analysis failed, using base model.");
    const backup = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: systemInstruction + " (基於內部知識庫分析)",
        responseMimeType: "application/json"
      }
    });
    return extractJson(backup.text);
  }
};

// 對話功能 (Stream) - 穩定版 (棄用 chat 物件，手動維護 contents)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  // 1. 整理歷史紀錄，確保 roles 嚴格交替：user -> model -> user -> model
  const contents: any[] = [];
  let lastRole = "";
  
  // 過濾掉空訊息並確保順序
  history.forEach(m => {
    const currentRole = m.role === 'user' ? 'user' : 'model';
    if (m.text && currentRole !== lastRole) {
      contents.push({ role: currentRole, parts: [{ text: m.text }] });
      lastRole = currentRole;
    }
  });

  // 確保最後一則是 user 提問
  contents.push({ role: 'user', parts: [{ text: message }] });

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: { 
        systemInstruction: `你是全球首席金融策略大師。討論對象：${symbol}。語言：${isChinese ? '繁體中文' : 'English'}。`,
      },
    });

    let fullText = "";
    for await (const chunk of responseStream) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }
    
    if (!fullText) throw new Error("API returned empty text.");
    return fullText;
  } catch (error: any) {
    console.error("Critical Chat Stream Error:", error);
    const msg = isChinese 
      ? `連線發生錯誤：${error.message || '請確認 API 配置是否正確。'}` 
      : `Connection error: ${error.message || 'Please check your API configuration.'}`;
    onChunk(msg);
    return msg;
  }
};
