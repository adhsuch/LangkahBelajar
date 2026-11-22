import { normalizeSpeech } from "@langkahbelajar/shared";
import { useEffect, useState } from "react";

export const NO_VOICE_EVENT = "lb:no-indonesian-voice";
const CLIPS_EVENT = "lb:audio-clips-loaded";

const clips = new Map<string, string>();
let player: HTMLAudioElement | null = null;

void fetch("/audio/id/manifest.json")
  .then((response) => (response.ok ? response.json() : { clips: {} }))
  .then((manifest: { clips?: Record<string, string> }) => {
    for (const [text, file] of Object.entries(manifest.clips ?? {})) clips.set(text, file);
  })
  .catch(() => undefined)
  .finally(() => window.dispatchEvent(new Event(CLIPS_EVENT)));

// Some Android browsers report Indonesian with the legacy code "in" or an underscore.
const isIndonesian = (voice: SpeechSynthesisVoice) => /^(id|in|ind)([-_]|$)/i.test(voice.lang);
const isNatural = (voice: SpeechSynthesisVoice) => /natural|neural|online|google/i.test(voice.name);

function indonesianVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices().filter(isIndonesian);
  const usable = navigator.onLine ? voices : voices.filter((voice) => voice.localService);
  return usable.find(isNatural) ?? usable[0] ?? null;
}

const reportMissing = () => window.dispatchEvent(new Event(NO_VOICE_EVENT));

function stop() {
  player?.pause();
  player = null;
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
}

/**
 * Plays the app's own Indonesian clip, so speech does not depend on the device.
 * A device voice covers new provider text only if it is Indonesian, because an English voice would teach the wrong sounds.
 */
export function speak(text: string) {
  const clip = clips.get(normalizeSpeech(text));
  if (clip) {
    stop();
    const audio = new Audio(clip);
    player = audio;
    audio.onerror = reportMissing;
    audio.play().catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === "AbortError")) reportMissing();
    });
    return true;
  }
  const voice = indonesianVoice();
  if (!voice) {
    reportMissing();
    return false;
  }
  stop();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = voice;
  utterance.lang = voice.lang;
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
  return true;
}

const speechSource = () => (clips.size > 0 ? "audio Indonesia bawaan aplikasi" : (indonesianVoice()?.name ?? null));

export function useSpeechSource() {
  const [source, setSource] = useState(speechSource);
  useEffect(() => {
    const update = () => setSource(speechSource());
    update();
    window.addEventListener(CLIPS_EVENT, update);
    if ("speechSynthesis" in window) window.speechSynthesis.addEventListener?.("voiceschanged", update);
    return () => {
      window.removeEventListener(CLIPS_EVENT, update);
      if ("speechSynthesis" in window) window.speechSynthesis.removeEventListener?.("voiceschanged", update);
    };
  }, []);
  return source;
}
