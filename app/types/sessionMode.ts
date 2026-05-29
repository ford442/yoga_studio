export interface BreathTiming {
  inhale: number;
  hold1: number;
  exhale: number;
  hold2: number;
}

export interface SessionMode {
  id: string;
  label: string;
  emoji: string;
  description: string;
  chakraFocus: string;
  shaderPath: string;
  vertexEntry: string;
  fragmentEntry: string;
  breath: BreathTiming;
  theme: number;
  mandalaStyle: number;
  strengthLevel?: number; // 0.0=light, 1.0=regular (default), 2.0=strong
}
