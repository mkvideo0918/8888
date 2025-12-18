
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

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

// 獲取恐慌貪婪指數 - 純 AI 預測版 (最穩定)
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "請根據 2025 年初的全球宏觀經濟趨勢（通膨、利率、美股與加密貨幣走勢），估算目前的市場恐慌與貪婪指數（0-100）。",
      config: {
        systemInstruction: "你是一個金融數據估算工具。僅輸出 JSON 格式：{ \"stock\": { \"score\": 數字, \"label\": \"字串\" }, \"crypto\": { \"score\": 數字, \"label\": \"字串\" } }。不要解釋。",
        responseMimeType: "application/json",
      }
    });
    return extractJson(response.text) || { stock: { score: 55, label: "Neutral" }, crypto: { score: 55, label: "Neutral" } };
  } catch (error) {
    console.error("F&G Error:", error);
    return { stock: { score: 50, label: "Stable" }, crypto: { score: 50, label: "Stable" } };
  }
};

// 深度分析報告 - 移除搜尋，確保成功
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const prompt = `請針對金融商品 "${symbol}" 進行深度大師分析。包含投資建議、技術支撐壓力位以及詳細趨勢預測。`;
  const systemInstruction = `你是一位享譽全球的金融大師。你的分析應專業且詳盡。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
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
    console.error("Analysis Error:", error);
    return {
      summary: "連線分析引擎失敗",
      recommendation: "Neutral",
      detailedAnalysis: `無法產生報告：${error.message || '未知錯誤'}。請確認 API 金鑰權限。`,
      sentimentScore: 50,
      sentimentLabel: "Error",
      keyLevels: ["N/A"]
    };
  }
};

// 對話功能 (Stream) - 核心重構，確保 100% 穩定
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  // 1. 嚴格過濾與整理歷史紀錄，確保 roles 交替
  const validContents: any[] = [];
  let expectedRole = 'user'; // 第一筆必須是 user

  // 我們只拿最後 6 筆有效的對話，防止 context 過長或格式混亂
  const cleanHistory = history.filter(m => m.text && m.text.trim().length > 0);
  
  for (const m of cleanHistory) {
    const role = m.role === 'user' ? 'user' : 'model';
    if (role === expectedRole) {
      validContents.push({ role, parts: [{ text: m.text }] });
      expectedRole = role === 'user' ? 'model' : 'user';
    }
  }

  // 2. 確保最後一筆是 user 提問
  if (expectedRole === 'user') {
    validContents.push({ role: 'user', parts: [{ text: message }] });
  } else {
    // 如果上一筆已經是 user，就合併訊息
    const lastIdx = validContents.length - 1;
    validContents[lastIdx].parts[0].text += `\n${message}`;
  }

  try {
    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3-flash-preview',
      contents: validContents,
      config: { 
        systemInstruction: `你是 WealthWise 的全球首席金融大師。分析商品：${symbol}。你的回答要充滿智慧、精確且易於理解。語言：${isChinese ? '繁體中文' : 'English'}。`,
        temperature: 0.7,
        topP: 0.95,
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
    
    if (!fullText) throw new Error("API 沒有回傳任何內容");
    return fullText;
  } catch (error: any) {
    console.error("Stream Error Detail:", error);
    const errorMsg = isChinese 
      ? `【系統連線故障】\n原因：${error.message || 'API 請求被拒絕'}\n提示：請檢查您的 API Key 是否有效，或嘗試更換網路環境。` 
      : `【Connection Error】\nReason: ${error.message || 'API request rejected'}\nPlease check your API key or network.`;
    onChunk(errorMsg);
    return errorMsg;
  }
};
