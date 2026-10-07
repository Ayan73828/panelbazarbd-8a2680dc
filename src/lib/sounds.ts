// Small WebAudio sound effects — no audio files needed.
// Call after a user gesture (click) so browsers allow playback.

function ctx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    return new AC();
  } catch {
    return null;
  }
}

function tone(ac: AudioContext, freq: number, start: number, dur: number, type: OscillatorType = "sine", vol = 0.18) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ac.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Cheerful "money received" chime (rising notes). */
export function playMoneyAdd() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 660, 0, 0.15);
  tone(ac, 880, 0.12, 0.15);
  tone(ac, 1320, 0.24, 0.3);
  setTimeout(() => void ac.close().catch(() => {}), 900);
}

/** Lower "money spent / deducted" sound (falling notes). */
export function playMoneyDeduct() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 520, 0, 0.18, "triangle");
  tone(ac, 330, 0.15, 0.3, "triangle");
  setTimeout(() => void ac.close().catch(() => {}), 900);
}
