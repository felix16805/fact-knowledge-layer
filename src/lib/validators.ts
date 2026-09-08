import { z } from "zod";

// ============================================================
// Upload URL request
// ============================================================
export const UploadUrlQuerySchema = z.object({
  filename: z
    .string()
    .min(1)
    .max(255)
    .regex(/\.pdf$/i, "Must be a .pdf filename"),
});

// ============================================================
// POST /api/documents — register after direct-to-Storage upload
// ============================================================
export const RegisterDocumentSchema = z.object({
  storagePath: z
    .string()
    .min(1)
    .max(500)
    // Must match the pattern the server issues: "pdfs/{uuid}/{filename}.pdf"
    .regex(
      /^pdfs\/[0-9a-f-]{36}\/.+\.pdf$/i,
      "Invalid storage path format"
    ),
  filename: z.string().min(1).max(255),
});

// ============================================================
// Fact query filters
// ============================================================
export const FactsQuerySchema = z.object({
  document_id: z.string().uuid().optional(),
  subject: z.string().max(255).optional(),
  metric: z.string().max(255).optional(),
  relationship_type: z
    .enum(["corroborates", "contradicts", "reconcilable", "insufficient_context"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================
// Relationship query filters
// ============================================================
export const RelationshipsQuerySchema = z.object({
  document_id: z.string().uuid().optional(),
  relationship_type: z
    .enum(["corroborates", "contradicts", "reconcilable", "insufficient_context"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// ============================================================
// Types inferred from schemas
// ============================================================
export type UploadUrlQuery = z.infer<typeof UploadUrlQuerySchema>;
export type RegisterDocument = z.infer<typeof RegisterDocumentSchema>;
export type FactsQuery = z.infer<typeof FactsQuerySchema>;
export type RelationshipsQuery = z.infer<typeof RelationshipsQuerySchema>;

// ============================================================
// Relationship type union — exhaustive discriminated union
// New types added here will cause TS errors in every unhandled switch,
// preventing silent fall-through.
// ============================================================
export type RelationshipType =
  | "corroborates"
  | "contradicts"
  | "reconcilable"
  | "insufficient_context";

export const RELATIONSHIP_TYPES = [
  "corroborates",
  "contradicts",
  "reconcilable",
  "insufficient_context",
] as const satisfies readonly RelationshipType[];

// ============================================================
// Document status
// ============================================================
export type DocumentStatus = "pending" | "processing" | "ready" | "failed";

export const DOCUMENT_STATUSES = [
  "pending",
  "processing",
  "ready",
  "failed",
] as const satisfies readonly DocumentStatus[];
