import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { ExpansionBlueprintItem } from "../types";

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

export async function getExpansionBlueprint(
    goal: string,
    filesPerSeed: number,
    seedFilePath: string,
    seedFileContent: string
): Promise<ExpansionBlueprintItem[]> {
    const prompt = `
You are a senior software architect. Your task is to plan the creation of new files that expand upon an existing "seed" file, based on a high-level user goal.
The user has provided a goal and the content of a seed file.
Your instructions are:
1. Analyze the seed file's content, language, and coding style.
2. Based on the user's goal, devise a plan to create ${filesPerSeed} new, complementary files.
3. The new files should logically extend the functionality of the seed file and reside in the same directory or a logical subdirectory. Use Unix-style path separators (/).
4. For each new file, provide a full file path (relative to the seed file's directory) and a concise, one-sentence description of its purpose.
5. You MUST return ONLY a JSON object that adheres to the provided schema. Do not add any other text, explanations, or markdown.

User Goal: "${goal}"

Seed File Path: "${seedFilePath}"

Seed File Content:
---
${seedFileContent}
---
`;

    try {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        files: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    filePath: {
                                        type: Type.STRING,
                                        description: 'The full, relative path of the new file to create (e.g., "components/UserProfile.tsx" or "../services/api.ts").',
                                    },
                                    description: {
                                        type: Type.STRING,
                                        description: 'A concise, one-sentence description of the new file\'s purpose.',
                                    },
                                },
                                required: ["filePath", "description"],
                            },
                        },
                    },
                    required: ["files"],
                },
            },
        });
        
        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);
        return parsed.files || [];
    } catch (error) {
        console.error("Error getting expansion blueprint:", error);
        throw new Error(`AI Architect failed: ${ (error as Error).message }`);
    }
}

export async function generateFileForBlueprint(
    goal: string,
    seedFilePath: string,
    seedFileContent: string,
    blueprintItem: ExpansionBlueprintItem,
    onChunk: (chunk: string) => void
): Promise<void> {
    const prompt = `
You are an expert AI programmer. Your task is to write the full code for a new file based on an architectural blueprint.
You have been given a high-level goal, the content of a "seed" file for context (style, language, imports, etc.), and the path and description for the new file you must create.

Your instructions are:
1. Adhere strictly to the coding style, patterns, and language of the seed file.
2. The generated code should be complete, correct, and ready to be saved as a file.
3. Ensure the code fulfills the purpose described in the blueprint.
4. You MUST return ONLY the raw code for the new file. Do not include any explanations, introductory text, or markdown code fences like \`\`\`.

High-Level Goal: "${goal}"

Seed File for Context ("${seedFilePath}"):
---
${seedFileContent}
---

New file to create:
- Path: "${blueprintItem.filePath}"
- Description: "${blueprintItem.description}"

---
New File Code:
`;
    await generateCodeEditStream(prompt, onChunk);
}
