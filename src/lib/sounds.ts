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

/** Original, short premium payment-confirmation chime (inspired by the feel of a phone wallet confirmation; not a sampled Apple sound). */
export function playMoneyAdd() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 880, 0, 0.11, "sine", 0.12);
  tone(ac, 1174.66, 0.09, 0.14, "sine", 0.13);
  tone(ac, 1567.98, 0.2, 0.24, "sine", 0.11);
  setTimeout(() => void ac.close().catch(() => {}), 800);
}

/** Matching soft confirmation sound for a successful purchase/deduction. */
export function playMoneyDeduct() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 783.99, 0, 0.1, "sine", 0.1);
  tone(ac, 1046.5, 0.09, 0.18, "sine", 0.12);
  setTimeout(() => void ac.close().catch(() => {}), 700);
}

/** Quiet premium tap feedback for ordinary UI interactions. */
export function playUiClick() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 620, 0, 0.035, "sine", 0.025);
  setTimeout(() => void ac.close().catch(() => {}), 160);
}
