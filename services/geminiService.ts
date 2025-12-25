
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });

/**
 * 自动查询汉字的拼音和简单含义
 */
export async function fetchCharacterDetails(character: string) {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `为5岁孩子学习汉字提供资料。汉字: "${character}"。请给出拼音和极其简短的中文含义。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          pinyin: { type: Type.STRING },
          meaning: { type: Type.STRING }
        },
        required: ["pinyin", "meaning"]
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    return { pinyin: "", meaning: "" };
  }
}

/**
 * 批量查询汉字详情
 */
export async function fetchBulkCharacterDetails(characters: string[]) {
  const charsStr = characters.join('、');
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `为5岁孩子学习汉字。请提供以下汉字的拼音和极简含义：${charsStr}。`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            character: { type: Type.STRING },
            pinyin: { type: Type.STRING },
            meaning: { type: Type.STRING }
          },
          required: ["character", "pinyin", "meaning"]
        }
      }
    }
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    return [];
  }
}
