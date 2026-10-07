"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorLike {
  error?: string;
  message?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type VoiceStatus = "checking" | "unsupported" | "idle" | "listening" | "error";

function detectConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const scope = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

function browserHint(): string {
  if (typeof navigator === "undefined") return "";
  const agent = navigator.userAgent;
  if (/firefox/i.test(agent)) return "Firefox cannot do speech recognition: use Chrome, Edge or Safari, or simply type.";
  if (/safari/i.test(agent) && !/chrome|chromium|edg/i.test(agent)) {
    return "Safari asks for microphone access the first time: allow it, then press the microphone button again.";
  }
  return "You can type instead — the agent behaves exactly the same.";
}

/**
 * Voice input on top of the browser SpeechRecognition API, with live interim text so
 * the user can see that it is listening. When the browser cannot do it, the console
 * still works: dictation is a convenience, never a requirement.
 */
export function useVoiceInput(onTranscript: (text: string) => void) {
  const [status, setStatus] = useState<VoiceStatus>("checking");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const finalText = useRef("");
  const handler = useRef(onTranscript);
  handler.current = onTranscript;

  useEffect(() => {
    const Constructor = detectConstructor();
    if (!Constructor) {
      setStatus("unsupported");
      return;
    }

    const instance = new Constructor();
    instance.lang = "en-GB";
    instance.continuous = false;
    instance.interimResults = true;
    instance.maxAlternatives = 1;

    instance.onstart = () => {
      setStatus("listening");
      setError(null);
    };

    instance.onresult = (event) => {
      let live = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";
        if (result?.isFinal) finalText.current = (finalText.current + " " + text).trim();
        else live = (live + " " + text).trim();
      }
      setInterim(live);
      const combined = (finalText.current + " " + live).trim();
      if (combined !== "") handler.current(combined);
    };

    instance.onerror = (event) => {
      const code = event.error ?? "unknown";
      setStatus("error");
      if (code === "not-allowed" || code === "service-not-allowed") {
        setError("The microphone is blocked for this site. Allow it in your browser's address bar, then press the microphone button again.");
      } else if (code === "no-speech") {
        setError("I did not hear anything. Press the microphone button and speak clearly.");
      } else if (code === "audio-capture") {
        setError("No microphone was found. Check that one is connected and selected in your system settings.");
      } else if (code === "network") {
        setError("Speech recognition needs an internet connection: it runs in the browser vendor's cloud.");
      } else {
        setError("Voice input failed (" + code + "). " + browserHint());
      }
    };

    instance.onend = () => {
      setStatus((current) => (current === "error" ? current : "idle"));
      setInterim("");
    };

    recognition.current = instance;

    return () => {
      try {
        instance.abort();
      } catch {
        // aborting an idle recogniser throws in some browsers
      }
    };
  }, []);

  const start = useCallback(() => {
    const instance = recognition.current;
    if (!instance) {
      setStatus("unsupported");
      setError("This browser has no speech recognition. " + browserHint());
      return;
    }
    finalText.current = "";
    setInterim("");
    setError(null);
    try {
      instance.start();
      setStatus("listening");
    } catch {
      // start() throws when it is already running; treat it as "still listening"
      setStatus("listening");
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognition.current?.stop();
    } catch {
      // ignore
    }
    setStatus("idle");
    setInterim("");
  }, []);

  return {
    status,
    interim,
    error,
    start,
    stop,
    supported: status !== "unsupported" && status !== "checking",
    listening: status === "listening"
  };
}
