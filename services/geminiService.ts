
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 初始化 Gemini 並配置專業金融大師指令
export const analyzeMarket = async (symbol: string, language: string) => {
  // Always create a new instance inside the function to use the latest API key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isChinese = language === 'zh-TW';
  
  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」(Global Chief Strategy Officer)。
    
    你的任務：
    1. 以極其專業、冷靜且深具洞察力的口吻，分析資產：${symbol}。
    2. 使用專業術語（例如：支撐位/阻力位、超買/超賣、宏觀經濟催化劑、流動性指標、方差分析等）。
    3. 報告結構必須包含：
       - 【市場情緒總覽】：當前市場參與者的心理狀態。
       - 【核心技術面解析】：K 線形態、關鍵移動平均線、RSI/MACD 等。
       - 【宏觀與基本面因素】：地緣政治、利率預期、相關行業新聞。
       - 【風險對沖建議】：若發生意外反轉應如何保護。
       - 【最終決策】：Buy (強力買入), Hold (觀望/持有), Sell (賣出), Neutral (中性)。
    
    CRITICAL: 
    - 你必須根據當前大數據環境計算一個「恐慌與貪婪指數」(0-100)。
    - 0-25: 極度恐慌 (Extreme Fear)
    - 26-45: 恐慌 (Fear)
    - 46-55: 中性 (Neutral)
    - 56-75: 貪婪 (Greed)
    - 76-100: 極度貪婪 (Extreme Greed)
    
    請使用 ${isChinese ? '繁體中文' : 'English'} 撰寫報告。
    輸出格式必須是純 JSON，不得包含 Markdown 語法外框。
  `;

  // Use gemini-3-flash-preview for fast and free-tier compliant analysis
  const response: GenerateContentResponse = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `請對 ${symbol} 進行深度大師級分析，並提供具體的數值化情緒指標。`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "一句話精簡總結當前態勢" },
          recommendation: { type: Type.STRING, enum: ['Buy', 'Hold', 'Sell', 'Neutral'] },
          detailedAnalysis: { type: Type.STRING, description: "包含多個小標題的深度專業分析報告" },
          sentimentScore: { type: Type.INTEGER, description: "0-100 的市場情緒分數" },
          sentimentLabel: { type: Type.STRING, description: "對應分數的標籤，如「極度貪婪」" },
          keyLevels: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "關鍵支撐與阻力價位"
          }
        },
        required: ['summary', 'recommendation', 'detailedAnalysis', 'sentimentScore', 'sentimentLabel', 'keyLevels']
      }
    }
  });

  // Use .text property directly as per guidelines
  return JSON.parse(response.text?.trim() || '{}');
};
