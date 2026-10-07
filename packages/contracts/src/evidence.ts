import { z } from "zod";
import { PlanIdSchema } from "./ids";

export const EvidenceKindSchema = z.enum(["photo", "voice_note", "note"]);

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

export const EVIDENCE_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/mpeg",
  "text/plain"
] as const;

/**
 * Proof attached to a plan action: a photo of the leak, a voice note from the
 * engineer, or a written note. Metadata lives in SQLite, bytes live on disk.
 */
export const EvidenceSchema = z.object({
  id: z.uuid(),
  planId: PlanIdSchema,
  actionId: z.uuid().nullable(),
  kind: EvidenceKindSchema,
  contentType: z.string().min(3).max(80),
  byteSize: z.number().int().min(0).max(EVIDENCE_MAX_BYTES),
  originalName: z.string().max(160).nullable(),
  note: z.string().max(500).nullable(),
  /** Image metadata (EXIF, XMP, IPTC) is stripped before the bytes are stored. */
  metadataStripped: z.boolean(),
  createdAt: z.iso.datetime()
});

export const EvidenceWithUrlSchema = EvidenceSchema.extend({
  url: z.string().min(1)
});

export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;
export type Evidence = z.infer<typeof EvidenceSchema>;
export type EvidenceWithUrl = z.infer<typeof EvidenceWithUrlSchema>;
