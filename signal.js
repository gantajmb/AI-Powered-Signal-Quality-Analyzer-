/**
 * signal.js — Signal generation, FFT, and quality metrics engine
 * AI-Powered Signal Quality Analyzer
 */

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const SAMPLE_COUNT = 1024;
const TWO_PI = 2 * Math.PI;

// ─── SIGNAL GENERATORS ────────────────────────────────────────────────────────

function generateSignal(type, freq, amplitude, noiseLevel, sampleRate, distortionType) {
  const noise = noiseLevel / 100;
  const samples = new Float64Array(SAMPLE_COUNT);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const t = i / sampleRate;
    let s = 0;

    switch (type) {
      case 'sine':
        s = amplitude * Math.sin(TWO_PI * freq * t);
        break;
      case 'square':
        s = amplitude * Math.sign(Math.sin(TWO_PI * freq * t));
        break;
      case 'sawtooth':
        s = amplitude * (2 * ((freq * t) % 1) - 1);
        break;
      case 'triangle':
        s = amplitude * (2 * Math.abs(2 * ((freq * t + 0.25) % 1) - 1) - 1);
        break;
      case 'noise':
        s = amplitude * (Math.random() * 2 - 1);
        break;
      case 'composite':
        s = amplitude * (
          0.6 * Math.sin(TWO_PI * freq * t) +
          0.25 * Math.sin(TWO_PI * freq * 3 * t) +
          0.1 * Math.sin(TWO_PI * freq * 5 * t) +
          0.05 * Math.sin(TWO_PI * freq * 7 * t)
        );
        break;
    }

    // Distortion injection
    switch (distortionType) {
      case 'harmonic':
        s += amplitude * 0.15 * Math.sin(TWO_PI * freq * 2 * t);
        s += amplitude * 0.08 * Math.sin(TWO_PI * freq * 3 * t);
        break;
      case 'intermod':
        const f2 = freq * 1.3;
        s += amplitude * 0.1 * Math.sin(TWO_PI * (freq - f2) * t);
        s += amplitude * 0.07 * Math.sin(TWO_PI * (freq + f2) * t);
        break;
      case 'clipping':
        s = Math.max(-amplitude * 0.7, Math.min(amplitude * 0.7, s));
        break;
      case 'jitter':
        const jitter = (Math.random() - 0.5) * (1 / sampleRate) * 0.3;
        const tj = i / sampleRate + jitter;
        s = amplitude * Math.sin(TWO_PI * freq * tj);
        break;
    }

    // Add noise
    s += noise * amplitude * (Math.random() * 2 - 1);

    samples[i] = s;
  }

  return samples;
}

// ─── WINDOW FUNCTIONS ────────────────────────────────────────────────────────

function applyWindow(samples, windowType) {
  const N = samples.length;
  const windowed = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    let w = 1;
    switch (windowType) {
      case 'hann':
        w = 0.5 * (1 - Math.cos(TWO_PI * i / (N - 1)));
        break;
      case 'hamming':
        w = 0.54 - 0.46 * Math.cos(TWO_PI * i / (N - 1));
        break;
      case 'blackman':
        w = 0.42 - 0.5 * Math.cos(TWO_PI * i / (N - 1)) + 0.08 * Math.cos(4 * Math.PI * i / (N - 1));
        break;
      case 'rectangular':
      default:
        w = 1;
    }
    windowed[i] = samples[i] * w;
  }
  return windowed;
}

// ─── SIMPLE DFT (for up to 1024 samples — acceptable perf) ──────────────────

function computeFFT(samples) {
  const N = samples.length;
  const re = new Float64Array(N);
  const im = new Float64Array(N);

  // Copy samples
  for (let i = 0; i < N; i++) {
    re[i] = samples[i];
    im[i] = 0;
  }

  // Bit-reversal permutation (MUST happen before butterfly passes)
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // Cooley-Tukey iterative FFT butterfly passes
  for (let len = 2; len <= N; len <<= 1) {
    const angle = -TWO_PI / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let i = 0; i < N; i += len) {
      let curRe = 1, curIm = 0;
      for (let j = 0; j < len / 2; j++) {
        const uRe = re[i + j];
        const uIm = im[i + j];
        const vRe = re[i + j + len / 2] * curRe - im[i + j + len / 2] * curIm;
        const vIm = re[i + j + len / 2] * curIm + im[i + j + len / 2] * curRe;
        re[i + j]           = uRe + vRe;
        im[i + j]           = uIm + vIm;
        re[i + j + len / 2] = uRe - vRe;
        im[i + j + len / 2] = uIm - vIm;
        const newCurRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = newCurRe;
      }
    }
  }

  // Magnitude spectrum (first half)
  const mag = new Float64Array(N / 2);
  for (let i = 0; i < N / 2; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / N;
  }
  return mag;
}

// ─── QUALITY METRICS ─────────────────────────────────────────────────────────

function computeMetrics(samples, spectrum, sampleRate, freq) {
  const N = samples.length;
  const freqResolution = sampleRate / N;

  // Find fundamental bin
  const fundBin = Math.round(freq / freqResolution);

  // Signal power (fundamental ± 2 bins)
  let signalPower = 0;
  for (let i = Math.max(0, fundBin - 2); i <= Math.min(spectrum.length - 1, fundBin + 2); i++) {
    signalPower += spectrum[i] * spectrum[i];
  }

  // Harmonic bins (2nd–5th harmonic)
  const harmonicBins = [2, 3, 4, 5].map(h => Math.round(freq * h / freqResolution));
  let harmonicPower = 0;
  let harmonicMags = [];
  for (const hb of harmonicBins) {
    if (hb < spectrum.length) {
      let hp = 0;
      for (let i = Math.max(0, hb - 2); i <= Math.min(spectrum.length - 1, hb + 2); i++) {
        hp += spectrum[i] * spectrum[i];
      }
      harmonicPower += hp;
      harmonicMags.push({ bin: hb, mag: spectrum[hb] || 0, freq: hb * freqResolution });
    }
  }

  // Noise power (everything else)
  let totalPower = 0;
  for (let i = 0; i < spectrum.length; i++) totalPower += spectrum[i] * spectrum[i];
  const noisePower = Math.max(totalPower - signalPower - harmonicPower, 1e-30);

  // SNR
  const snr = 10 * Math.log10(signalPower / noisePower);

  // THD (%)
  const thd = signalPower > 0 ? Math.sqrt(harmonicPower / signalPower) * 100 : 0;

  // SINAD
  const sinad = 10 * Math.log10(signalPower / (noisePower + harmonicPower));

  // SFDR — largest spurious relative to fundamental
  let sfdrDB = 0;
  const fundMag = spectrum[fundBin] || 1e-15;
  for (let i = 1; i < spectrum.length; i++) {
    if (i >= fundBin - 2 && i <= fundBin + 2) continue;
    if (spectrum[i] > 1e-15) {
      const ratio = 20 * Math.log10(fundMag / spectrum[i]);
      if (ratio > sfdrDB) sfdrDB = ratio;
    }
  }

  // ENOB from SINAD
  const enob = (sinad - 1.76) / 6.02;

  // Noise floor (median of spectrum in dBFS)
  const spectrumDB = Array.from(spectrum).map(m => m > 0 ? 20 * Math.log10(m) : -120);
  const sorted = [...spectrumDB].sort((a, b) => a - b);
  const noiseFloor = sorted[Math.floor(sorted.length * 0.3)];

  // RMS
  const rms = Math.sqrt(samples.reduce((acc, v) => acc + v * v, 0) / N);

  // Crest factor
  const peak = Math.max(...Array.from(samples).map(Math.abs));
  const crestFactor = rms > 0 ? 20 * Math.log10(peak / rms) : 0;

  // Quality score (0–100)
  let score = 100;
  score -= Math.max(0, 30 - snr) * 1.5;
  score -= Math.min(thd * 0.8, 30);
  score -= Math.max(0, 60 - sfdrDB) * 0.3;
  score = Math.max(0, Math.min(100, score));

  return {
    snr: +snr.toFixed(1),
    thd: +thd.toFixed(2),
    sinad: +sinad.toFixed(1),
    sfdr: +sfdrDB.toFixed(1),
    enob: +Math.max(0, enob).toFixed(2),
    noiseFloor: +noiseFloor.toFixed(1),
    rms: +rms.toFixed(4),
    crestFactor: +crestFactor.toFixed(2),
    score: +score.toFixed(1),
    harmonicMags,
    signalPower,
    noisePower,
    harmonicPower,
  };
}

// ─── SPECTROGRAM DATA ────────────────────────────────────────────────────────

function computeSpectrogram(samples, sampleRate, windowType, numWindows = 16) {
  const wSize = Math.floor(samples.length / numWindows);
  const result = [];
  for (let w = 0; w < numWindows; w++) {
    const slice = samples.slice(w * wSize, (w + 1) * wSize);
    const padded = new Float64Array(wSize);
    for (let i = 0; i < wSize; i++) padded[i] = slice[i] || 0;
    const windowed = applyWindow(padded, windowType);
    const mag = computeFFT(windowed);
    const db = Array.from(mag).slice(0, 64).map(m => m > 0 ? Math.max(-80, 20 * Math.log10(m)) : -80);
    result.push(db);
  }
  return result;
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

window.SignalEngine = {
  generateSignal,
  applyWindow,
  computeFFT,
  computeMetrics,
  computeSpectrogram,
  SAMPLE_COUNT,
};
