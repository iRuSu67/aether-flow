/**
 * AudioPerception
 * Multi-modal audio & speech activity detection (VAD),
 * zero-crossing rate computation, and signal energy analysis.
 */

export interface AudioSignalMetrics {
  durationSeconds: number;
  rmsEnergy: number;
  hasVoiceActivity: boolean;
  zeroCrossingRate: number;
  dominantFrequencyHz: number;
}

export class AudioPerception {
  /**
   * Process raw PCM or synthetic audio frames
   */
  public analyzeSignal(samples: number[], sampleRate = 16000): AudioSignalMetrics {
    if (samples.length === 0) {
      return {
        durationSeconds: 0,
        rmsEnergy: 0,
        hasVoiceActivity: false,
        zeroCrossingRate: 0,
        dominantFrequencyHz: 0,
      };
    }

    // Root-Mean-Square (RMS) Energy
    let sumSquares = 0;
    let zeroCrossings = 0;

    for (let i = 0; i < samples.length; i++) {
      sumSquares += samples[i] * samples[i];
      if (i > 0 && ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0))) {
        zeroCrossings++;
      }
    }

    const rms = Math.sqrt(sumSquares / samples.length);
    const zcr = zeroCrossings / samples.length;
    const duration = samples.length / sampleRate;
    const hasVoice = rms > 0.02 && zcr < 0.4;

    return {
      durationSeconds: Number(duration.toFixed(3)),
      rmsEnergy: Number(rms.toFixed(4)),
      hasVoiceActivity: hasVoice,
      zeroCrossingRate: Number(zcr.toFixed(4)),
      dominantFrequencyHz: Math.round(zcr * sampleRate * 0.5),
    };
  }
}
