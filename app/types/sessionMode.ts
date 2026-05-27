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
}
