import type { EvidenceKind } from "@homeops/contracts";
import { EVIDENCE_ALLOWED_TYPES, EVIDENCE_MAX_BYTES } from "@homeops/contracts";
import { DomainError } from "../errors";

/**
 * Removes EXIF, XMP and IPTC segments from a JPEG. Home photos carry GPS
 * coordinates and device identifiers; those must never be stored by default.
 * Other formats are returned untouched and reported as not stripped.
 */
export function stripJpegMetadata(bytes: Buffer): Buffer {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return bytes;

  const kept: Buffer[] = [bytes.subarray(0, 2)];
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) break;
    const marker = bytes[offset + 1];
    if (marker === undefined) break;

    // Start of scan: everything after this is image data, copy it verbatim.
    if (marker === 0xda) {
      kept.push(bytes.subarray(offset));
      return Buffer.concat(kept);
    }

    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) break;
    const end = offset + 2 + length;
    if (end > bytes.length) break;

    // APP1..APP15 carry EXIF/XMP/IPTC. APP0 (JFIF) is kept.
    const isMetadataSegment = marker >= 0xe1 && marker <= 0xef;
    if (!isMetadataSegment) kept.push(bytes.subarray(offset, end));

    offset = end;
  }

  // Malformed input: return the original rather than a truncated image.
  return kept.length > 1 ? Buffer.concat(kept) : bytes;
}

export interface EvidenceInput {
  kind: EvidenceKind;
  contentType: string;
  originalName: string | null;
  note: string | null;
  bytes: Buffer;
}

export interface ValidatedEvidence extends EvidenceInput {
  metadataStripped: boolean;
}

function matchesKind(kind: EvidenceKind, contentType: string): boolean {
  if (kind === "photo") return contentType.startsWith("image/");
  if (kind === "voice_note") return contentType.startsWith("audio/");
  return contentType === "text/plain";
}

/** Size, type and kind are validated before anything touches the disk. */
export function validateEvidence(input: EvidenceInput): ValidatedEvidence {
  const contentType = input.contentType.split(";")[0]?.trim().toLowerCase() ?? "";

  if (!(EVIDENCE_ALLOWED_TYPES as readonly string[]).includes(contentType)) {
    throw new DomainError("unsupported_media_type", 415, `Unsupported file type: ${contentType || "unknown"}. Allowed: images, audio and plain text.`);
  }
  if (!matchesKind(input.kind, contentType)) {
    throw new DomainError("evidence_kind_mismatch", 400, `A ${input.kind} must be uploaded as ${input.kind === "photo" ? "an image" : input.kind === "voice_note" ? "audio" : "plain text"}.`);
  }
  if (input.bytes.length === 0) {
    throw new DomainError("empty_evidence", 400, "The attached file is empty.");
  }
  if (input.bytes.length > EVIDENCE_MAX_BYTES) {
    throw new DomainError("evidence_too_large", 413, `Attachments are limited to ${Math.round(EVIDENCE_MAX_BYTES / (1024 * 1024))} MB.`);
  }

  let bytes = input.bytes;
  let metadataStripped = false;
  if (contentType === "image/jpeg") {
    const stripped = stripJpegMetadata(input.bytes);
    metadataStripped = stripped.length !== input.bytes.length;
    bytes = stripped;
  }

  return { ...input, contentType, bytes, metadataStripped };
}
