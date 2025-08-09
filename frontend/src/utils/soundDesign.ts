import { useEffect } from 'react';

export class SoundDesign {
  private static audioContext: AudioContext | null = null;
  private static sounds: Map<string, AudioBuffer> = new Map();

  static async initializeAudio() {
    if (!this.audioContext && typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext();
    }
  }

  static async play(name: string, volume: number = 0.1) {
    try {
      if (!this.audioContext) return;
      const buffer = this.sounds.get(name);
      if (!buffer) return;
      const source = this.audioContext.createBufferSource();
      const gain = this.audioContext.createGain();
      source.buffer = buffer;
      gain.gain.value = volume;
      source.connect(gain);
      gain.connect(this.audioContext.destination);
      source.start();
    } catch {
      // ignore
    }
  }

  static playSuccess(level: 'simple' | 'moderate' | 'complex' = 'moderate') {
    const map = { simple: 'success_gentle', moderate: 'success_moderate', complex: 'success_epic' } as const;
    return this.play(map[level]);
  }
}

export const useSoundEffects = () => {
  useEffect(() => { void SoundDesign.initializeAudio(); }, []);
  return {
    playSuccess: SoundDesign.playSuccess,
  };
};
