"use client";

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  return (
    voices.find((voice) => voice.lang.replace("_", "-") === lang) ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase())) ??
    null
  );
}

/**
 * Spoken replies. Only ever called from a user action, which is what browsers require
 * before they allow audio.
 */
export function speak(text: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-GB";
  utterance.rate = 1.02;
  utterance.pitch = 1;
  const voice = pickVoice("en-GB");
  if (voice) utterance.voice = voice;
  synth.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
