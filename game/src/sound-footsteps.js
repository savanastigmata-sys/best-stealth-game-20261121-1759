// Sound, footsteps and music — everything is synthesised with WebAudio, so
// the game ships no audio files at all. Footsteps tick at the player's pace
// (soft while sneaking, loud while running) and their pitch tells a guard's
// distance; a rising sting plays when a guard spots you, a chime when a
// relic is taken, and a quiet arpeggio when you slip out unseen.
let audioContext = null;
let masterGain = null;
let stepCount = 0;

export function ensureAudio() {
  if (audioContext) {
    if (audioContext.state === 'suspended') audioContext.resume();
    return true;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    audioContext = new AC();
    masterGain = audioContext.createGain();
    masterGain.gain.value = 0.5;
    masterGain.connect(audioContext.destination);
    return true;
  } catch {
    return false;
  }
}

function tone(freq, seconds, type, volume, when) {
  if (!audioContext || !masterGain) return;
  const t0 = audioContext.currentTime + (when || 0);
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.05);
}

/** One footstep tick. Call it each time the player covers a stride. */
export function playFootstep(sneaking, running) {
  if (!audioContext) return;
  stepCount += 1;
  const alternate = stepCount % 2 === 0 ? 1 : 0.86;
  const freq = (running ? 150 : sneaking ? 95 : 120) * alternate;
  tone(freq, running ? 0.09 : 0.07, 'triangle', running ? 0.16 : sneaking ? 0.04 : 0.09, 0);
}

/** A bright double ping when a pebble lands and rings. */
export function playPebbleTink() {
  tone(1320, 0.12, 'sine', 0.08, 0);
  tone(1760, 0.18, 'sine', 0.06, 0.07);
}

/** The rising sting when a guard's awareness crosses into alarm. */
export function playAlarmSting() {
  tone(220, 0.5, 'sawtooth', 0.12, 0);
  tone(330, 0.5, 'sawtooth', 0.1, 0.09);
  tone(440, 0.4, 'sawtooth', 0.08, 0.18);
}

/** A soft "?" blip when a guard grows suspicious. */
export function playSuspicionBlip() {
  tone(660, 0.12, 'sine', 0.07, 0);
  tone(880, 0.14, 'sine', 0.05, 0.08);
}

/** The chime when a Moonlit Relic is taken. */
export function playRelicChime() {
  tone(523, 0.3, 'sine', 0.1, 0);
  tone(784, 0.35, 'sine', 0.09, 0.07);
  tone(1047, 0.5, 'sine', 0.07, 0.14);
}

/** The quiet arpeggio of a ghost run: out unseen. */
export function playGhostArpeggio() {
  const notes = [392, 494, 587, 784];
  for (let i = 0; i < notes.length; i += 1) {
    tone(notes[i], 0.5, 'sine', 0.09, i * 0.13);
  }
}

/** A low thud when the player is caught. */
export function playCaughtThud() {
  tone(90, 0.4, 'sine', 0.2, 0);
  tone(60, 0.5, 'sine', 0.18, 0.1);
}
