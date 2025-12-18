
import { GoogleGenAI, Type } from "@google/genai";

// 取得 AI 實例的工廠函式 - 確保每次呼叫都能抓到最新注入的 API_KEY
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("API_KEY_MISSING");
  }
  return new GoogleGenAI({ apiKey });
};

// 輔助函式：確保 JSON 格式正確
const extractJson = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch (e) {
    return null;
  }
};

// 獲取恐慌貪婪指數
export const getFearGreedIndices = async (language: string) => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Estimate current global market Fear & Greed Index (0-100) for Stocks and Crypto based on 2025 macro trends.",
      config: {
        systemInstruction: "Output ONLY JSON: { \"stock\": { \"score\": number, \"label\": \"string\" }, \"crypto\": { \"score\": number, \"label\": \"string\" } }",
        responseMimeType: "application/json",
      }
    });
    return extractJson(response.text) || { stock: { score: 55, label: "Neutral" }, crypto: { score: 55, label: "Neutral" } };
  } catch (error) {
    console.error("F&G Error:", error);
    return { stock: { score: 50, label: "Stable" }, crypto: { score: 50, label: "Stable" } };
  }
};

// 深度分析報告
export const analyzeMarket = async (symbol: string, language: string) => {
  const isChinese = language === 'zh-TW';
  const prompt = `深度分析 "${symbol}"：包含投資建議、支撐壓力位與趨勢預估。`;
  const systemInstruction = `你是一位專業金融大師。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
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
    return extractJson(response.text);
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") throw error;
    return null;
  }
};

// 對話功能 (Stream)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const isChinese = language === 'zh-TW';
  
  // 整理歷史，確保角色嚴格交替
  const validContents: any[] = [];
  let lastRole = "";
  history.filter(m => m.text && m.text.trim()).forEach(m => {
    const role = m.role === 'user' ? 'user' : 'model';
    if (role !== lastRole) {
      validContents.push({ role, parts: [{ text: m.text }] });
      lastRole = role;
    }
  });

  // 確保最後是 user 提問
  if (lastRole === 'user') {
    validContents[validContents.length - 1].parts[0].text += `\n${message}`;
  } else {
    validContents.push({ role: 'user', parts: [{ text: message }] });
  }

  try {
    const ai = getAI();
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: validContents,
      config: { 
        systemInstruction: `你是 WealthWise 金融大師。分析：${symbol}。專業、準確、具啟發性。語言：${isChinese ? '繁體中文' : 'English'}。`,
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
    return fullText;
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") throw error;
    const msg = isChinese ? `連線錯誤: ${error.message}` : `Error: ${error.message}`;
    onChunk(msg);
    return msg;
  }
};
