
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 獲取特定的恐慌貪婪指數
export const getFearGreedIndices = async (language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Search CURRENT Fear & Greed Index for CNN (Stocks) and Coinglass (Crypto). Return JSON only.",
      config: {
        systemInstruction: "Output JSON: { \"stock\": { \"score\": number, \"label\": string }, \"crypto\": { \"score\": number, \"label\": string } }.",
        tools: [{googleSearch: {}}],
        responseMimeType: "application/json",
      }
    });
    const text = response.text.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch (error) {
    console.error("Fear & Greed Index Error:", error);
    return null;
  }
};

// 深度分析報告 (保持非串流，因為需要結構化 JSON)
export const analyzeMarket = async (symbol: string, language: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `分析資產: "${symbol}"。優先參考 TradingView 數據。`,
      config: {
        systemInstruction: `你是全球首席金融策略大師。輸出 ${isChinese ? '繁體中文' : 'English'} JSON 診斷報告。`,
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

// 對話功能改為串流 (Streaming) 以提升體感速度
export const getChatResponseStream = async (symbol: string, history: any[], message: string, language: string, onChunk: (text: string) => void) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const isChinese = language === 'zh-TW';

  const systemInstruction = `你是全球首席金融策略大師。討論資產：${symbol}。優先參考 TradingView。語氣專業、簡潔。語言：${isChinese ? '繁體中文' : 'English'}。`;

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

    const result = await chat.sendMessageStream({ message });
    let fullText = "";
    for await (const chunk of result) {
      const chunkText = chunk.text;
      fullText += chunkText;
      onChunk(fullText);
    }
    return fullText;
  } catch (error) {
    console.error("Chat Error:", error);
    const errorMsg = isChinese ? "抱歉，大師目前忙碌中。" : "Sorry, the Master is busy.";
    onChunk(errorMsg);
    return errorMsg;
  }
};
