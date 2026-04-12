import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 5): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Retry on 429 (Rate Limit) or 5xx (Server Error)
      const status = error?.status || error?.response?.status;
      const isRateLimit = status === 429 || error?.message?.includes('429') || error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isRateLimit || (status >= 500 && status < 600)) {
        // Longer delay for rate limits
        const baseDelay = isRateLimit ? 3000 : 1000;
        const delay = Math.pow(2, i) * baseDelay + Math.random() * 1000;
        console.warn(`API error (${status || '429'}). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export async function transcribeAudio(base64Audio: string, mimeType: string, primaryLanguage: string = 'mixed') {
  // Pre-processing: Basic check for extremely small audio payloads
  // Even a 1-second low-quality clip is typically > 2KB in base64.
  if (base64Audio.length < 500) {
    return "[No clear speech detected]";
  }

  const languageContext = primaryLanguage === 'mixed' 
    ? "The audio is a mix of Arabic and English (Code-Switching)."
    : `The primary language of the audio is ${primaryLanguage === 'ar' ? 'Arabic' : 'English'}.`;

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                data: base64Audio,
                mimeType: mimeType,
              },
            },
            {
              text: `Transcribe the provided audio exactly. ${languageContext} Follow the system instructions strictly.`,
            }
          ],
        },
      ],
      config: {
        systemInstruction: `You are a world-class academic transcriptionist specializing in Artificial Intelligence, Software Engineering, and the broader Technology field.
Transcribe this audio recording of a technical lecture or discussion.

STRICT TRANSCRIPTION RULES:
1. SHORT AUDIO & ANTI-HALLUCINATION: If the audio is very short (e.g., < 2 seconds) or contains only noise, silence, or unintelligible sounds, do NOT guess or invent text. If no clear speech is detected, return exactly: "[No clear speech detected]".
2. NO ADDED CONTEXT: Do not add any introductory or concluding remarks (e.g., "This is a transcription..."). Return ONLY the transcribed text or the specified error message.
3. CODE-SWITCHING MASTERY: The speaker frequently switches between Arabic and English (Code-Switching). Transcribe English technical terms in English script (e.g., "Neural Networks", "Fine-tuning", "Deployment", "Dataset", "Optimizer") even when they appear in the middle of an Arabic sentence.
4. ARABIC TECHNICAL ACCURACY: Correctly transcribe technical terms spoken in Arabic, whether they are formal translations (e.g., "الذكاء الاصطناعي", "التعلم العميق") or transliterations (e.g., "موديل", "داتا", "باراميترز"). Use precise Arabic script.
5. SPEAKER IDENTIFICATION: Identify and label distinct speakers as "Speaker 1:", "Speaker 2:", etc., throughout the transcript. If a speaker's name is explicitly mentioned, use their name. Do NOT invent names.
6. DOMAIN EXPERTISE: Correctly identify and spell complex technology terms across AI, Cloud, and Software Engineering (e.g., "Transformers", "Backpropagation", "Microservices", "CI/CD", "Serverless", "Latency", "Throughput", "Scalability").
7. VERBATIM & CLEAN: Provide a verbatim transcription but remove filler words (like "um", "uh") unless they are essential for context.
8. FORMATTING: Use clear paragraph breaks. Ensure punctuation is placed correctly for mixed-language sentences. If you are not 90% sure about a word, use "[unclear]".

Context: This is a high-level technical seminar, lecture, or a brief technical note. Accuracy is paramount even for the shortest clips.`,
        temperature: 0.1,
        topP: 0.1,
        topK: 1,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
      }
    }));

    return response.text || "No transcription available.";
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

export async function summarizeTranscription(transcription: string) {
  if (!transcription || transcription.includes("[No clear speech detected]")) {
    return "No summary available: No clear speech was detected in the audio.";
  }

  try {
    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              text: `You are an expert AI tutor and technology analyst. Analyze the following transcription from the AI/Technology field and provide an elite-level summary.

SUMMARY REQUIREMENTS:
1. BILINGUAL OUTPUT: Provide a full summary in English, followed by a full summary in Arabic.
2. SEPARATION: You MUST separate the English and Arabic sections with the exact string: "---ARABIC_SECTION---"
3. DOMAIN ANALYSIS: Identify the specific technology or AI sub-field discussed.
4. KEY TOPICS: Identify the main modules, chapters, or discussion points.
5. CORE CONCEPTS: Explain the technical concepts and their significance clearly.
6. TAKEAWAYS: List the most important points a professional or student should remember.
7. FORMAT: Use professional Markdown with bold headers, bullet points, and numbered lists.

Transcription:
${transcription}`,
            },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
      }
    }));

    return response.text || "No summary available.";
  } catch (error) {
    console.error("Summarization error:", error);
    throw error;
  }
}
