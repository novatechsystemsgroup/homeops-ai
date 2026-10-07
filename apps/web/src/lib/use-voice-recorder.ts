"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface VoiceRecording {
  blob: Blob;
  seconds: number;
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

/**
 * Records a voice note with the microphone. Used for repair evidence: what the
 * engineer said, or a note to self while standing in front of the boiler.
 */
export function useVoiceRecorder(onRecorded: (recording: VoiceRecording) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const startedAt = useRef(0);
  const handler = useRef(onRecorded);
  handler.current = onRecorded;

  useEffect(() => {
    const available = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
    setSupported(available);
    if (!available) setError("This browser cannot record audio. You can still attach a photo or write a note.");
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(timer);
  }, [recording]);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const instance = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];
      startedAt.current = Date.now();

      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };
      instance.onstop = () => {
        const type = instance.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunks.current, { type });
        const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setSeconds(0);
        if (blob.size > 0) handler.current({ blob, seconds: durationSeconds });
      };

      recorder.current = instance;
      instance.start();
      setRecording(true);
    } catch {
      setRecording(false);
      setError("Microphone access was refused, so the voice note was not recorded.");
    }
  }, []);

  return { recording, seconds, error, supported, start, stop };
}
