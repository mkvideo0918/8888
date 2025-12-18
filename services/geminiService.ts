
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";

// 初始化 Gemini 並配置專業金融大師指令
export const analyzeMarket = async (symbol: string, language: string) => {
  // 每次調用時創建實例以獲取最新的 API Key
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const isChinese = language === 'zh-TW';
  
  const systemInstruction = `
    你是一位擁有 30 年華爾街經驗的「全球首席金融策略大師」(Global Chief Strategy Officer)。
    
    你的任務：
    1. 以極其專業、冷靜且深具洞察力的口吻，分析資產：${symbol}。
    2. 你擁有對當前市場大數據的即時判讀能力，請根據該資產的特性進行全方位診斷。
    3. 報告結構必須包含：
       - 【市場情緒總覽】：當前市場參與者的心理與行為分析。
       - 【核心技術面解析】：K 線形態、支撐/阻力、量價關係判斷。
       - 【宏觀與基本面】：近期可能影響走勢的關鍵新聞與宏觀催化劑。
       - 【風險策略】：給予投資者的風控建議。
       - 【大師決策】：Buy (買入), Hold (持有), Sell (賣出), Neutral (觀望)。
    
    關於「市場恐慌貪婪指數」(0-100)：
    - 0-25: 極度恐慌 (Extreme Fear)
    - 26-45: 恐慌 (Fear)
    - 46-55: 中性 (Neutral)
    - 56-75: 貪婪 (Greed)
    - 76-100: 極度貪婪 (Extreme Greed)
    
    請使用 ${isChinese ? '繁體中文' : 'English'} 撰寫報告。
    嚴格遵守 JSON 格式輸出，不要包含額外的說明文字或 Markdown 代碼塊標籤。
  `;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `身為策略大師，請對資產代碼 "${symbol}" 提供當前的深度市場分析報告與情緒評分。`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING, description: "一句話精煉總結" },
            recommendation: { type: Type.STRING, enum: ['Buy', 'Hold', 'Sell', 'Neutral'] },
            detailedAnalysis: { type: Type.STRING, description: "包含大標題的專業詳細分析正文" },
            sentimentScore: { type: Type.INTEGER, description: "0-100 的市場情緒分數" },
            sentimentLabel: { type: Type.STRING, description: "對應分數的情緒標籤" },
            keyLevels: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "當前關鍵支撐位與阻力位 (3-4 個)"
            }
          },
          required: ['summary', 'recommendation', 'detailedAnalysis', 'sentimentScore', 'sentimentLabel', 'keyLevels']
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("AI 輸出內容為空");
    
    return JSON.parse(text.trim());
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    // 返回一個降級的錯誤提示對象，防止 UI 崩潰
    return {
      summary: "分析引擎暫時無法獲取數據",
      recommendation: "Neutral",
      detailedAnalysis: "抱歉，目前 AI 分析引擎遭遇連線問題或額度限制，請稍後再試。您可以查看 TradingView 圖表進行判斷。",
      sentimentScore: 50,
      sentimentLabel: "Data Error",
      keyLevels: ["N/A"]
    };
  }
};
