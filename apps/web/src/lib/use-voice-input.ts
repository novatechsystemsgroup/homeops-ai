"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}
interface SpeechRecognitionErrorLike {
  error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceState = "unsupported" | "idle" | "listening" | "error";

/**
 * Thin wrapper over the browser SpeechRecognition API. The demo never depends on
 * it: when the browser has no support (or the user denies the microphone) the
 * console falls back to typed input and says so.
 */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const handler = useRef(onTranscript);
  handler.current = onTranscript;

  useEffect(() => {
    const scope = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Constructor = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Constructor) {
      setState("unsupported");
      return;
    }

    const instance = new Constructor();
    instance.lang = "en-GB";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim() !== "") handler.current(transcript.trim());
    };
    instance.onerror = (event) => {
      setState("error");
      setError(event.error === "not-allowed" ? "Microphone permission was denied — type the scenario instead." : "Voice input failed — type the scenario instead.");
    };
    instance.onend = () => setState((current) => (current === "error" ? current : "idle"));
    recognition.current = instance;

    return () => {
      try {
        instance.stop();
      } catch {
        // stopping an idle recogniser throws in some browsers; nothing to do
      }
    };
  }, []);

  const start = useCallback(() => {
    const instance = recognition.current;
    if (!instance) {
      setError("This browser has no speech recognition — type the scenario instead.");
      setState("unsupported");
      return;
    }
    setError(null);
    setState("listening");
    try {
      instance.start();
    } catch {
      setState("error");
      setError("Voice input is already running.");
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      // ignore
    }
    setState("idle");
  }, []);

  return { state, error, start, stop, supported: state !== "unsupported" };
}
