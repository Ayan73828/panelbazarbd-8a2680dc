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

/** Premium deep tactile UI click: a single muted low thock with a subtle warm body. */
export function playUiClick() {
  const ac = ctx();
  if (!ac) return;
  const t = ac.currentTime;

  // Short low body — gives the click weight without sounding like a bird/chime.
  const body = ac.createOscillator();
  const bodyGain = ac.createGain();
  const bodyFilter = ac.createBiquadFilter();
  body.type = "sine";
  body.frequency.setValueAtTime(190, t);
  body.frequency.exponentialRampToValueAtTime(112, t + 0.075);
  bodyFilter.type = "lowpass";
  bodyFilter.frequency.setValueAtTime(520, t);
  bodyGain.gain.setValueAtTime(0.0001, t);
  bodyGain.gain.exponentialRampToValueAtTime(0.085, t + 0.004);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.095);
  body.connect(bodyFilter).connect(bodyGain).connect(ac.destination);
  body.start(t);
  body.stop(t + 0.1);

  // Very brief, quiet attack for definition; no high-pitched ringing or double tone.
  const attack = ac.createOscillator();
  const attackGain = ac.createGain();
  const attackFilter = ac.createBiquadFilter();
  attack.type = "triangle";
  attack.frequency.setValueAtTime(430, t);
  attack.frequency.exponentialRampToValueAtTime(250, t + 0.018);
  attackFilter.type = "lowpass";
  attackFilter.frequency.value = 900;
  attackGain.gain.setValueAtTime(0.0001, t);
  attackGain.gain.exponentialRampToValueAtTime(0.018, t + 0.002);
  attackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
  attack.connect(attackFilter).connect(attackGain).connect(ac.destination);
  attack.start(t);
  attack.stop(t + 0.03);
}
