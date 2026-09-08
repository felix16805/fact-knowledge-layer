import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { withGeminiBackoff } from "@/lib/gemini-retry";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const MODEL = "gemini-3.6-flash";

// ============================================================
// Types
// ============================================================

export interface ExtractedFact {
  subject: string;
  metric: string;
  value: unknown;
  unit: string | null;
  time_scope: string | null;
  doc_scope: string | null;
  qualifiers: Record<string, string> | null;
  quoted_evidence: string;
  confidence: number;
}

interface Chunk {
  page_number: number;
  chunk_type: "text" | "table" | "slide";
  raw_text: string;
  bbox?: { x0: number; y0: number; x1: number; y1: number } | null;
}

// ============================================================
// Gemini function declaration for structured extraction
// ============================================================

const factExtractionTool = {
  name: "extract_facts",
  description:
    "Extract all verifiable factual claims from the given document text. Each fact must be grounded in a direct quote from the source.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      facts: {
        type: Type.ARRAY,
        description: "List of extracted facts",
        items: {
          type: Type.OBJECT,
          properties: {
            subject: {
              type: Type.STRING,
              description: 'The entity this fact is about. e.g. "Delhivery", "India", "RBI"',
            },
            metric: {
              type: Type.STRING,
              description: 'What is being measured. e.g. "Revenue from services", "Inflation rate (CPI)"',
            },
            value: {
              type: Type.STRING,
              description: 'The value as a string (numbers, ranges like "5–7%", or descriptive)',
            },
            unit: {
              type: Type.STRING,
              description: 'Unit of measurement. e.g. "₹ Crore", "percent", "USD billion". Null if not applicable.',
            },
            time_scope: {
              type: Type.STRING,
              description: 'Time period. e.g. "FY24", "Q4 FY24", "2024-25". Null if not specified.',
            },
            doc_scope: {
              type: Type.STRING,
              description: 'Scope. e.g. "consolidated", "standalone", "segment:PTL". Null if not specified.',
            },
            qualifiers: {
              type: Type.STRING,
              description: 'Additional qualifiers as a JSON string, or null.',
            },
            quoted_evidence: {
              type: Type.STRING,
              description: "The EXACT verbatim text from the chunk supporting this fact.",
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence 0.0 to 1.0.",
            },
          },
          required: ["subject", "metric", "value", "quoted_evidence", "confidence"],
        },
      },
    },
    required: ["facts"],
  },
};

const SYSTEM_PROMPT = `You are a precise fact extraction engine. Given text from a document, identify every meaningful factual claim that could be verified or contradicted by another source.

Rules:
- Extract facts from ANY document type — do not hardcode domain expectations
- Each fact MUST have a quoted_evidence field that is a verbatim quote from the text
- Be thorough: extract ALL facts, not just the most prominent ones
- For numerical data: include units, time scopes, and accounting scopes where visible
- Do not invent or infer values not present in the text`;

// ============================================================
// Main extraction function
// ============================================================

export async function extractFacts(chunk: Chunk): Promise<ExtractedFact[]> {
  if (!chunk.raw_text || chunk.raw_text.trim().length < 20) {
    return [];
  }

  const prompt = `${SYSTEM_PROMPT}

Document chunk (page ${chunk.page_number}, type: ${chunk.chunk_type}):
---
${chunk.raw_text}
---

Extract all verifiable factual claims from this text.`;

  const response = await withGeminiBackoff(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        tools: [{ functionDeclarations: [factExtractionTool] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
          },
        },
      },
    })
  );

  const facts: ExtractedFact[] = [];
  const candidates = response.candidates ?? [];

  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.functionCall?.name === "extract_facts") {
        const args = part.functionCall.args as {
          facts: Array<{
            subject: string;
            metric: string;
            value: string;
            unit?: string;
            time_scope?: string;
            doc_scope?: string;
            qualifiers?: string;
            quoted_evidence: string;
            confidence: number;
          }>;
        };

        for (const f of args.facts ?? []) {
          let qualifiers: Record<string, string> | null = null;
          if (f.qualifiers) {
            try {
              qualifiers = JSON.parse(f.qualifiers);
            } catch {
              qualifiers = { note: f.qualifiers };
            }
          }

          facts.push({
            subject: f.subject,
            metric: f.metric,
            value: f.value,
            unit: f.unit ?? null,
            time_scope: f.time_scope ?? null,
            doc_scope: f.doc_scope ?? null,
            qualifiers,
            quoted_evidence: f.quoted_evidence,
            confidence: Math.max(0, Math.min(1, f.confidence)),
          });
        }
      }
    }
  }

  return facts;
}
