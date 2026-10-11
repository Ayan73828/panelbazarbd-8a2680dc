// Small WebAudio sound effects — no audio files needed.
// Call after a user gesture (click) so browsers allow playback.

let sharedContext: AudioContext | null = null;
function ctx(): AudioContext | null {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedContext || sharedContext.state === "closed") sharedContext = new AC();
    if (sharedContext.state === "suspended") void sharedContext.resume();
    return sharedContext;
  } catch { return null; }
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

}

/** Matching soft confirmation sound for a successful purchase/deduction. */
export function playMoneyDeduct() {
  const ac = ctx();
  if (!ac) return;
  tone(ac, 783.99, 0, 0.1, "sine", 0.1);
  tone(ac, 1046.5, 0.09, 0.18, "sine", 0.12);

}

/** Minimal premium tap: a quick, soft finger-on-glass tick, single hit, no bass thump or ringing. */
export function playUiClick() {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;

  // Tiny, dry click transient with restrained high-mid energy.
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  const filter = ac.createBiquadFilter();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1150, t);
  osc.frequency.exponentialRampToValueAtTime(720, t + 0.014);
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1450, t);
  filter.Q.setValueAtTime(0.7, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.022, t + 0.0015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
  osc.connect(filter).connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.025);
}
