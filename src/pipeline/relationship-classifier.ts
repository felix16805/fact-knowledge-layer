import { GoogleGenAI, Type, FunctionCallingConfigMode } from "@google/genai";
import { withGeminiBackoff } from "@/lib/gemini-retry";
import type { RelationshipType } from "@/lib/validators";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const PRIMARY_MODEL = "gemini-3.6-flash";
const FALLBACK_MODEL = "gemini-3-flash";

// ============================================================
// Types
// ============================================================

export interface FactForClassification {
  id: string;
  subject: string;
  metric: string;
  value: unknown;
  unit: string | null;
  time_scope: string | null;
  doc_scope: string | null;
  qualifiers: Record<string, string> | null;
  quoted_evidence: string;
  document_filename: string;
  page_number: number;
}

export type RelationshipResult =
  | { type: "corroborates"; reasoning: string; confidence: number }
  | { type: "contradicts"; reasoning: string; confidence: number }
  | { type: "reconcilable"; reasoning: string; reconciling_factor: string; confidence: number }
  | { type: "insufficient_context"; reasoning: string; confidence: number };

// ============================================================
// Gemini function declaration
// ============================================================

const classifyTool = {
  name: "classify_relationship",
  description: "Classify the relationship between two facts from different documents.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      relationship_type: {
        type: Type.STRING,
        enum: ["corroborates", "contradicts", "reconcilable", "insufficient_context"],
        description: [
          "corroborates: Both facts make compatible claims about the same entity/metric/period",
          "contradicts: Facts make logically incompatible claims that cannot both be true",
          "reconcilable: Apparent conflict resolvable by a specific, nameable factor (scope, methodology, period)",
          "insufficient_context: Not enough information to determine the relationship",
        ].join("\n"),
      },
      reasoning: {
        type: Type.STRING,
        description: "Explicit reasoning referencing specific details from both facts.",
      },
      reconciling_factor: {
        type: Type.STRING,
        description:
          "Only for 'reconcilable': the specific factor that resolves the conflict. Empty for other types.",
      },
      confidence: {
        type: Type.NUMBER,
        description: "Confidence 0.0 to 1.0.",
      },
    },
    required: ["relationship_type", "reasoning", "confidence"],
  },
};

// ============================================================
// Prompt builder
// ============================================================

function buildPrompt(factA: FactForClassification, factB: FactForClassification): string {
  const formatFact = (f: FactForClassification, label: string) =>
    `${label} (from: ${f.document_filename}, page ${f.page_number}):
- Subject: ${f.subject}
- Metric: ${f.metric}
- Value: ${JSON.stringify(f.value)}${f.unit ? ` ${f.unit}` : ""}
- Period: ${f.time_scope ?? "unspecified"}
- Scope: ${f.doc_scope ?? "unspecified"}${
      f.qualifiers ? `\n- Qualifiers: ${JSON.stringify(f.qualifiers)}` : ""
    }
- Evidence: "${f.quoted_evidence}"`;

  return `You are a fact relationship classifier. Determine the relationship between these two facts.

${formatFact(factA, "FACT A")}

${formatFact(factB, "FACT B")}

Classify the relationship. Be precise — reference specific values, periods, and scopes in your reasoning.
If the facts cover different metrics or entities, use 'insufficient_context'.`;
}

// ============================================================
// Main classification function
// ============================================================

export async function classifyRelationship(
  factA: FactForClassification,
  factB: FactForClassification
): Promise<RelationshipResult> {
  const callConfig = {
    contents: [{ role: "user", parts: [{ text: buildPrompt(factA, factB) }] }],
    config: {
      tools: [{ functionDeclarations: [classifyTool] }],
      toolConfig: {
        functionCallingConfig: { mode: FunctionCallingConfigMode.ANY },
      },
    },
  };

  let response;
  try {
    response = await withGeminiBackoff(() =>
      ai.models.generateContent({ model: PRIMARY_MODEL, ...callConfig })
    );
  } catch (err: any) {
    const status = err?.status ?? err?.code;
    const isUnavailable =
      status === 503 ||
      status === 429 ||
      err?.message?.includes("503") ||
      err?.message?.includes("429") ||
      err?.message?.includes("UNAVAILABLE") ||
      err?.message?.toLowerCase().includes("high demand") ||
      err?.message?.toLowerCase().includes("overloaded") ||
      err?.message?.toLowerCase().includes("quota") ||
      err?.message?.toLowerCase().includes("rate limit");

    if (isUnavailable) {
      console.warn(`[fallback] Primary model exhausted/unavailable after retries. Falling back to ${FALLBACK_MODEL}...`);
      response = await withGeminiBackoff(() =>
        ai.models.generateContent({ model: FALLBACK_MODEL, ...callConfig })
      );
    } else {
      throw err;
    }
  }

  const candidates = response.candidates ?? [];

  for (const candidate of candidates) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.functionCall?.name === "classify_relationship") {
        const args = part.functionCall.args as {
          relationship_type: string;
          reasoning: string;
          reconciling_factor?: string;
          confidence: number;
        };

        const type = args.relationship_type as RelationshipType;
        const confidence = Math.max(0, Math.min(1, args.confidence ?? 0.5));

        switch (type) {
          case "corroborates":
            return { type, reasoning: args.reasoning, confidence };
          case "contradicts":
            return { type, reasoning: args.reasoning, confidence };
          case "reconcilable":
            return {
              type,
              reasoning: args.reasoning,
              reconciling_factor: args.reconciling_factor ?? "unspecified",
              confidence,
            };
          case "insufficient_context":
            return { type, reasoning: args.reasoning, confidence };
          default:
            console.warn(`[classifier] Unexpected type '${type}', defaulting to insufficient_context`);
            return {
              type: "insufficient_context",
              reasoning: `Model returned unexpected type '${type}'. Original: ${args.reasoning}`,
              confidence: 0.3,
            };
        }
      }
    }
  }

  return {
    type: "insufficient_context",
    reasoning: "Model did not return a structured classification response.",
    confidence: 0.1,
  };
}
