import { CognitiveBus } from '../kernel/CognitiveBus.js';

export interface VoiceFrame {
  id: string;
  speaker: string;
  transcript: string;
  audioFormat: 'wav' | 'pcm' | 'simulated';
  durationMs: number;
  timestamp: number;
}

/**
 * @experimental Stub implementation - prototype not yet verified for production use.
 * VoiceKernel
 * Telemetry and frame handling for simulated voice interaction streams.
 */
export class VoiceKernel {
  private bus: CognitiveBus;
  private isListening = false;

  constructor(bus: CognitiveBus) {
    this.bus = bus;
  }

  /**
   * Process spoken audio transcript and dispatch to the cognitive bus
   */
  public ingestSpeech(transcript: string, speaker = 'user'): VoiceFrame {
    const frame: VoiceFrame = {
      id: `voice_${Date.now()}`,
      speaker,
      transcript,
      audioFormat: 'simulated',
      durationMs: Math.max(800, transcript.length * 45),
      timestamp: Date.now(),
    };

    this.bus.emit('goal:received', { spokenTranscript: transcript, voiceFrameId: frame.id }, 'VoiceKernel', 'info');
    return frame;
  }

  /**
   * Synthesize spoken response from agent swarm output
   */
  public synthesizeSpeech(text: string, agent = 'AetherVoice'): VoiceFrame {
    const frame: VoiceFrame = {
      id: `tts_${Date.now()}`,
      speaker: agent,
      transcript: text,
      audioFormat: 'simulated',
      durationMs: Math.max(1000, text.length * 50),
      timestamp: Date.now(),
    };

    this.bus.emit('agent:debate', { ttsOutput: text, durationMs: frame.durationMs }, agent, 'info');
    return frame;
  }

  public setListening(listening: boolean): void {
    this.isListening = listening;
  }

  public getStatus(): { isListening: boolean } {
    return { isListening: this.isListening };
  }
}
