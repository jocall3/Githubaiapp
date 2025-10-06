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

async function generateCodeEditStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    try {
        const client = getAiClient();
        const responseStream = await client.models.generateContentStream({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
                onChunk(text);
            }
        }
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error instanceof Error) {
            // Propagate a more informative error message.
            throw new Error(`AI request failed: ${error.message}`);
        }
        throw new Error("Failed to get response from AI due to an unknown error.");
    }
}


export async function editFileWithAI(currentCode: string, instruction: string, onChunk: (chunk: string) => void): Promise<void> {
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
  await generateCodeEditStream(prompt, onChunk);
}

export async function bulkEditFileWithAI(currentCode: string, instruction: string, filePath: string, onChunk: (chunk: string) => void): Promise<void> {
    const prompt = `
You are an expert AI programmer executing a high-level directive across an entire codebase.
For the file located at \`${filePath}\`, apply the following overall instruction:
"${instruction}"

Your task is to significantly enhance and expand this specific file based on the instruction.
- Add new features, classes, and functions that are relevant to the file's purpose and the main instruction. The goal is to substantially increase the file's value and content.
- You MUST NOT change or remove any existing import statements.
- Any new top-level functions, classes, or variables you create MUST be exported.
- Your changes should be mindful of the entire repository's architecture. Create code that can intelligently interact with other modules.
- Adhere strictly to the coding style and language of the original file.

Return ONLY the complete, updated code for the file. Do not include any explanations, markdown fences, or other text outside of the code itself.

---
Original Code from \`${filePath}\`:
${currentCode}
---

Updated Code:
`;
    await generateCodeEditStream(prompt, onChunk);
}
