
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 獲取恐慌貪婪指數
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search LATEST Fear & Greed Index from CNN (Stocks) and Alternative.me (Crypto). Return only JSON.",
      config: {
        systemInstruction: "You are a data agent. Extract numeric scores and labels. JSON only: { \"stock\": { \"score\": number, \"label\": string }, \"crypto\": { \"score\": number, \"label\": string } }.",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });
    const text = response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("F&G Error:", error);
    return null;
  }
};

// 深度分析報告
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `分析資產: "${symbol}"。優先參考 TradingView 實時指標。`,
      config: {
        systemInstruction: `你是全球首席金融策略大師。輸出 ${isChinese ? '繁體中文' : 'English'} JSON。`,
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

    return JSON.parse(response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
  } catch (error) {
    console.error("Analysis Error:", error);
    return null;
  }
};

// 對話功能 (Stream)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  // 簡化後的指令，能讓回應更快開始
  const systemInstruction = `你是全球首席金融策略大師。分析對象：${symbol}。語氣專業、極簡。語言：${isChinese ? '繁體中文' : 'English'}。`;

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction,
        tools: [{googleSearch: {}}]
      },
      // 過濾無效訊息，避免卡住
      history: history.filter(m => m.text && m.text.length > 0).map(m => ({
        role: m.role,
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
    return fullText;
  } catch (error) {
    console.error("Chat Stream Error:", error);
    const errorMsg = isChinese ? "抱歉，分析引擎暫時不可用。" : "Sorry, the engine is temporarily unavailable.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
