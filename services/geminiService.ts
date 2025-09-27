import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// This is a browser-based app, so `process.env.API_KEY` is expected to be
// replaced by a build tool or otherwise available on the `window` or a similar object.
// For this context, we assume it's magically available as per the instructions.
const API_KEY = process.env.API_KEY;

// Lazily initialize the AI client.
let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
    if (ai) {
        return ai;
    }
    if (!API_KEY) {
        throw new Error("API_KEY is not available. Please configure your environment.");
    }
    ai = new GoogleGenAI({ apiKey: API_KEY });
    return ai;
}


export async function editCodeWithAI(currentCode: string, instruction: string): Promise<string> {
  const prompt = `
You are an expert code assistant. Your task is to modify the provided code based on the user's instruction.
You MUST return only the complete, updated code block. Do not add any explanations, introductory text, or markdown code fences like \`\`\`.

Instruction:
${instruction}

---

Original Code:
${currentCode}

---

Updated Code:
`;

  try {
    const client = getAiClient();
    const response: GenerateContentResponse = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    const editedCode = response.text;

    if (!editedCode || editedCode.trim() === '') {
        throw new Error("AI returned empty content. Please try a different instruction.");
    }
    
    // The model might still wrap the code in markdown fences. Clean it up.
    const cleanedCode = editedCode.replace(/^```(?:\w*\n)?/, '').replace(/\n?```$/, '').trim();

    return cleanedCode;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    if (error instanceof Error) {
        // Propagate a more informative error message.
        throw new Error(`AI request failed: ${error.message}`);
    }
    throw new Error("Failed to get response from AI due to an unknown error.");
  }
}
