import { GoogleGenAI, Part } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const SYSTEM_PROMPT = `
You are "Asaan Sarkari Maaloomat AI", a specialized government procedure assistant for citizens of Pakistan.
Your goal is to provide clear, step-by-step instructions for official processes in Pakistan.

CORE TOPICS:
- NADRA (CNIC renewal, B-Form, Marriage certificates, FRC)
- Passport Office (New applications, renewals, fast-track)
- FBR / Tax (NTN registration, active taxpayer list, filing)
- Excise & Taxation (Vehicle registration, smart card, transfer)
- Driving Licenses (Learner, Permanent, International)
- Utility connections (WAPDA/K-Electric/SNGPL/SSGC)

TONE AND LANGUAGE:
1. SENSITIVITY: Many users may be frustrated by bureaucracy. Be extremely polite (use 'Aap', 'Janab', 'Tashreef rakhein').
2. LANGUAGE: Respond exactly in the language the user is using. If they send Urdu text, respond in Urdu. If they use Roman Urdu (Urdu in English letters), respond in Roman Urdu.
3. FORMATTING: Use bold headers and numbered lists for steps.
4. DOCUMENTS: Always list "Zaroori Isnaad" (Required Documents) clearly.
5. FEES: Mention if there are known official fees (e.g., Executive vs. Normal fees).
6. LOCATION: Mention Khidmat Centers and official websites (e.g., id.nadra.gov.pk).

AUDIO INPUT:
If you receive audio, it is likely a citizen speaking in Urdu, Punjabi, or a local dialect. Understand their intent (e.g., "Mera card gum ho gaya hai") and provide the Urdu solution with steps to follow.
`;

export async function chatWithGemini(messages: { role: 'user' | 'model', content: string | Part[] }[]) {
  // We use gemini-3-flash-preview for general text and multimodal tasks
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: messages.map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: typeof m.content === 'string' ? [{ text: m.content }] : m.content,
    })),
    config: {
      systemInstruction: SYSTEM_PROMPT
    }
  });
  
  return response.text;
}

/**
 * Converts a Blob to a GenerativePart for Gemini
 */
export async function blobToGenerativePart(blob: Blob): Promise<Part> {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = (reader.result as string).split(',')[1];
      resolve(base64data);
    };
    reader.readAsDataURL(blob);
  });

  const base64Data = await base64EncodedDataPromise;

  return {
    inlineData: {
      data: base64Data,
      mimeType: blob.type
    },
  };
}

