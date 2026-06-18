import { useEffect, useRef, useState } from 'react';
import type { BreathPhase } from './useBreathTimer';

interface VoiceSettings {
  enabled: boolean;
  useSanskrit: boolean;
}

const VOICE_SETTINGS_KEY = 'sacred-breath-voice';
const DEFAULT_VOICE_SETTINGS: VoiceSettings = { enabled: true, useSanskrit: false };

const readStoredVoiceSettings = (): VoiceSettings => {
  const saved = localStorage.getItem(VOICE_SETTINGS_KEY);
  return saved ? JSON.parse(saved) : DEFAULT_VOICE_SETTINGS;
};

export const useVoiceGuidance = (currentPhase: BreathPhase, isRunning: boolean) => {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false);

  const lastPhaseRef = useRef<BreathPhase>(currentPhase);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Save settings to localStorage
  useEffect(() => {
    if (!hasLoadedSettings) return;
    localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  }, [hasLoadedSettings, settings]);

  useEffect(() => {
    try {
      setSettings(readStoredVoiceSettings());
    } catch {
      console.warn('Invalid sacred-breath-voice localStorage payload');
      setSettings(DEFAULT_VOICE_SETTINGS);
    } finally {
      setHasLoadedSettings(true);
    }
  }, []);

  const speak = (text: string) => {
    if (!settings.enabled || !('speechSynthesis' in window)) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.92;
    utterance.pitch = 1.05;
    utterance.volume = 0.85;

    // Try to find a calm, pleasant voice
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
      v.name.toLowerCase().includes('karen') ||
      v.name.toLowerCase().includes('samantha') ||
      v.name.toLowerCase().includes('female') ||
      v.lang.startsWith('en')
    );

    if (preferredVoice) utterance.voice = preferredVoice;

    window.speechSynthesis.speak(utterance);
    utteranceRef.current = utterance;
  };

  const phaseMessages: Record<BreathPhase, { en: string; sanskrit: string }> = {
    inhale: {
      en: "Inhale deeply through the nose",
      sanskrit: "Puraka — inhale"
    },
    hold1: {
      en: "Hold the breath gently",
      sanskrit: "Kumbhaka — retain"
    },
    exhale: {
      en: "Exhale slowly and completely",
      sanskrit: "Rechaka — exhale"
    },
    hold2: {
      en: "Empty... rest in stillness",
      sanskrit: "Shunyaka — empty"
    }
  };

  useEffect(() => {
    if (!isRunning || currentPhase === lastPhaseRef.current) return;

    const msg = phaseMessages[currentPhase];
    const text = settings.useSanskrit ? msg.sanskrit : msg.en;

    // Small delay so it doesn't overlap with chimes
    setTimeout(() => speak(text), 180);

    lastPhaseRef.current = currentPhase;
  }, [currentPhase, isRunning, settings.useSanskrit]);

  const toggleVoice = () => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  };

  const toggleSanskrit = () => {
    setSettings(prev => ({ ...prev, useSanskrit: !prev.useSanskrit }));
  };

  return {
    settings,
    toggleVoice,
    toggleSanskrit,
  };
};
