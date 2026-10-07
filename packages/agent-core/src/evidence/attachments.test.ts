import { describe, expect, it } from "vitest";
import { EVIDENCE_MAX_BYTES } from "@homeops/contracts";
import { stripJpegMetadata, validateEvidence } from "./attachments";

/** Minimal JPEG: SOI, an EXIF APP1 segment, an APP0 segment, a scan and EOI. */
function jpegWithExif(): Buffer {
  const exifPayload = Buffer.concat([Buffer.from("Exif\0\0", "latin1"), Buffer.from("GPS 51.45,-2.59", "latin1")]);
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1]), Buffer.from([(exifPayload.length + 2) >> 8, (exifPayload.length + 2) & 0xff]), exifPayload]);
  const app0 = Buffer.concat([Buffer.from([0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF\0", "latin1"), Buffer.alloc(9)]);
  const scan = Buffer.from([0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33]);
  const eoi = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([Buffer.from([0xff, 0xd8]), app1, app0, scan, eoi]);
}

describe("jpeg metadata stripping", () => {
  it("removes the EXIF segment and keeps the image data", () => {
    const original = jpegWithExif();
    const stripped = stripJpegMetadata(original);

    expect(stripped.length).toBeLessThan(original.length);
    expect(stripped.includes(Buffer.from("Exif", "latin1"))).toBe(false);
    expect(stripped.includes(Buffer.from("GPS 51.45,-2.59", "latin1"))).toBe(false);
    // JFIF marker, scan and EOI survive.
    expect(stripped.includes(Buffer.from("JFIF", "latin1"))).toBe(true);
    expect(stripped.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("returns non-JPEG data untouched", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
    expect(stripJpegMetadata(png)).toEqual(png);
  });
});

describe("evidence validation", () => {
  const base = { originalName: "leak.jpg", note: null };

  it("accepts a photo and reports that metadata was stripped", () => {
    const result = validateEvidence({ ...base, kind: "photo", contentType: "image/jpeg", bytes: jpegWithExif() });
    expect(result.metadataStripped).toBe(true);
    expect(result.contentType).toBe("image/jpeg");
  });

  it("accepts a png without claiming to strip anything", () => {
    const result = validateEvidence({ ...base, kind: "photo", contentType: "image/png", bytes: Buffer.from([1, 2, 3]) });
    expect(result.metadataStripped).toBe(false);
  });

  it("rejects a file type outside the allow-list", () => {
    expect(() => validateEvidence({ ...base, kind: "photo", contentType: "application/zip", bytes: Buffer.from([1]) })).toThrowError(/Unsupported file type/i);
  });

  it("rejects a photo uploaded as audio", () => {
    expect(() => validateEvidence({ ...base, kind: "voice_note", contentType: "image/png", bytes: Buffer.from([1]) })).toThrowError(/must be uploaded as/i);
  });

  it("rejects empty and oversized attachments", () => {
    expect(() => validateEvidence({ ...base, kind: "note", contentType: "text/plain", bytes: Buffer.alloc(0) })).toThrowError(/empty/i);
    expect(() =>
      validateEvidence({ ...base, kind: "voice_note", contentType: "audio/webm", bytes: Buffer.alloc(EVIDENCE_MAX_BYTES + 1) })
    ).toThrowError(/limited to/i);
  });
});
