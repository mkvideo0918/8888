
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 獲取恐慌貪婪指數
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search and extract the CURRENT values for: 1. CNN Business Fear & Greed Index. 2. Alternative.me Crypto Fear & Greed Index. Return ONLY JSON.",
      config: {
        systemInstruction: "You are a data extraction specialist. Search the web for current market sentiment values. Output MUST be valid JSON: { \"stock\": { \"score\": number, \"label\": string }, \"crypto\": { \"score\": number, \"label\": string } }. Label should be in English (e.g., 'Extreme Fear', 'Greed'). No markdown.",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });

    const text = response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("Fear & Greed Index Fetching Error:", error);
    // 回傳預設值或 Null，讓前端處理
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
      contents: `分析資產: "${symbol}"。請搜索 TradingView 及財經新聞。`,
      config: {
        systemInstruction: `你是一位全球頂尖金融大師。請對該代號進行深度技術與基本面分析。語言要求：${isChinese ? '繁體中文' : 'English'}。`,
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

    const data = JSON.parse(response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, ''));
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

// 對話功能 (Stream)
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  try {
    const chat = ai.chats.create({
      model: 'gemini-3-flash-preview',
      config: { 
        systemInstruction: `你是全球首席金融策略大師。討論對象：${symbol}。優先參考 TradingView 實時指標。回覆語氣：專業、犀利、簡明。語言：${isChinese ? '繁體中文' : 'English'}。`,
        tools: [{googleSearch: {}}]
      },
      history: history.filter(m => m.text).map(m => ({
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
    return fullText;
  } catch (error) {
    console.error("Chat Stream Error:", error);
    const errorMsg = isChinese ? "抱歉，分析引擎目前回應較慢或遇到障礙，請稍後再試。" : "Sorry, the analysis engine is currently busy or experiencing issues.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
