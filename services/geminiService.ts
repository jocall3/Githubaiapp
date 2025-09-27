import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Lazily initialize the AI client to prevent app crash if process.env is not defined
// at module load time.
let ai: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
    if (ai) {
        return ai;
    }

    // Check for process and API_KEY only when the AI function is first called.
    const apiKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;

    if (!apiKey) {
      throw new Error("API_KEY environment variable not set or accessible.");
    }

    ai = new GoogleGenAI({ apiKey });
    return ai;
}


export async function editCodeWithAI(currentCode: string, instruction: string): Promise<string> {
  const prompt = `
You are an expert code assistant. Your task is to modify the provided code based on the user's instruction.
Provide ONLY the complete, updated code as your response. Do not add any explanations, introductory text, or markdown code fences like \`\`\`.

Instruction:
${instruction}

---

Original Code:
${currentCode}

---

Updated Code:
`;

  try {
    const client = getAiClient(); // This will initialize or get the existing client
    const response: GenerateContentResponse = await client.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    const editedCode = response.text;

    if (!editedCode || editedCode.trim() === '') {
        throw new Error("AI returned empty content.");
    }
    
    return editedCode.trim();
  } catch (error) {
    console.error("Error calling Gemini API:", error);
     if (error instanceof Error && error.message.includes("API_KEY")) {
        throw error;
    }
    throw new Error("Failed to get response from AI.");
  }
}
