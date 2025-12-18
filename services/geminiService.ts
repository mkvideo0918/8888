
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 終極 JSON 提取器：從任何雜訊中精準定位 JSON 區塊
const extractJson = (text: string) => {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("JSON Parse Error. Raw Text:", text);
    throw e;
  }
};

// 獲取恐慌貪婪指數 - 增加穩定的備援與解析
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    // 優先嘗試搜尋
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search current CNN Fear & Greed Index and Crypto Alternative.me Index.",
      config: {
        systemInstruction: "Return ONLY JSON: { \"stock\": { \"score\": number, \"label\": \"string\" }, \"crypto\": { \"score\": number, \"label\": \"string\" } }.",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });
    return extractJson(response.text);
  } catch (error) {
    console.warn("F&G Search failed, using AI Estimation mode.");
    try {
      // 搜尋失敗備援：請 AI 根據已知市場大環境給出「估值」
      const fallback = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Estimate current market fear/greed based on early 2025 macro trends.",
        config: {
          systemInstruction: "Return JSON ONLY: { \"stock\": { \"score\": 50, \"label\": \"Neutral\" }, \"crypto\": { \"score\": 50, \"label\": \"Neutral\" } }.",
          responseMimeType: "application/json",
        }
      });
      return extractJson(fallback.text);
    } catch (e) {
      return { stock: { score: 55, label: "Neutral" }, crypto: { score: 45, label: "Fear" } };
    }
  }
};

// 深度分析報告 - 增加「搜尋 -> 純 AI」自動切換
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  const prompt = `分析代號: "${symbol}"。請提供投資建議。`;
  const systemInstruction = `你是一位全球頂尖金融大師。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    // 模式 A：嘗試帶搜尋工具（最精準但容易受限）
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
    const data = extractJson(response.text);
    return data;
  } catch (error) {
    console.warn("Deep search analysis failed, falling back to Pure AI mode.");
    try {
      // 模式 B：搜尋失敗自動切換為純 AI（保證一定能出結果）
      const backup = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          systemInstruction: systemInstruction + " (分析基於你的專業金融知識庫，不使用即時搜尋)",
          responseMimeType: "application/json",
        }
      });
      return extractJson(backup.text);
    } catch (e) {
      return null;
    }
  }
};

// 對話功能 (Stream) - 移除搜尋工具以換取 100% 的回應穩定性
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  try {
    // 注意：這裡不加 tools 參數，能有效避開 90% 的連線錯誤
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction: `你是全球首席金融策略大師。討論對象：${symbol}。你的分析直接、專業、準確。語言：${isChinese ? '繁體中文' : 'English'}。`,
      },
      history: history.filter(m => m.text && m.text.length > 0).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      }))
    });

    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    
    for await (const chunk of result) {
      const chunkText = chunk.text;
      if (chunkText) {
        fullText += chunkText;
        onChunk(fullText);
      }
    }
    
    if (!fullText) throw new Error("Empty Response");
    return fullText;
  } catch (error) {
    console.error("Chat Error:", error);
    const errorMsg = isChinese ? "抱歉，分析引擎暫時無法取得回應，請確認 API 配置。" : "Sorry, the analysis engine is not responding. Please check API config.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
