/**
 * app.js — Main application controller
 * AI-Powered Signal Quality Analyzer
 * Model: openai/gpt-oss-20b
 *
 * ⚠️  Set your Groq API key in config.js (never commit real keys).
 *     Create a file called config.js next to this file with:
 *       const GROQ_API_KEY = 'gsk_...your_key_here...';
 *     config.js is listed in .gitignore and will not be committed.
 */

// GROQ_API_KEY is loaded from config.js (see README — not committed to git)
// Fallback to empty string so the app loads without config.js
const GROQ_API_KEY = (typeof __GROQ_API_KEY__ !== 'undefined') ? __GROQ_API_KEY__ : '';
const GROQ_MODEL   = 'openai/gpt-oss-20b';
const GROQ_URL     = 'https://api.groq.com/openai/v1/chat/completions';

// ─── CHART INSTANCES ──────────────────────────────────────────────────────────
let waveformChart, spectrumChart, spectrogramChart, harmonicChart;
let lastMetrics = null;
let lastSignalConfig = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initCharts();
  bindControls();
  setStatus('idle');
});

// ─── CHART INITIALIZATION ─────────────────────────────────────────────────────
function initCharts() {
  const opts = { renderer: 'canvas', locale: 'EN' };

  waveformChart    = echarts.init(document.getElementById('waveformChart'), 'dark', opts);
  spectrumChart    = echarts.init(document.getElementById('spectrumChart'), 'dark', opts);
  spectrogramChart = echarts.init(document.getElementById('spectrogramChart'), 'dark', opts);
  harmonicChart    = echarts.init(document.getElementById('harmonicChart'), 'dark', opts);

  renderEmptyCharts();

  window.addEventListener('resize', () => {
    waveformChart.resize();
    spectrumChart.resize();
    spectrogramChart.resize();
    harmonicChart.resize();
  });
}

function renderEmptyCharts() {
  const emptyBase = (title) => ({
    backgroundColor: 'transparent',
    title: { text: '', textStyle: { color: '#8892b0', fontSize: 11 } },
    grid: { top: 10, right: 16, bottom: 30, left: 48, containLabel: false },
    xAxis: { type: 'category', data: [], axisLine: { lineStyle: { color: '#2e3350' } }, axisLabel: { color: '#8892b0', fontSize: 10 }, splitLine: { show: false } },
    yAxis: { type: 'value', axisLine: { lineStyle: { color: '#2e3350' } }, axisLabel: { color: '#8892b0', fontSize: 10 }, splitLine: { lineStyle: { color: '#1e2235' } } },
    series: [],
  });
  waveformChart.setOption(emptyBase());
  spectrumChart.setOption(emptyBase());
  harmonicChart.setOption(emptyBase());
  spectrogramChart.setOption({ backgroundColor: 'transparent' });
}

// ─── BIND UI CONTROLS ─────────────────────────────────────────────────────────
function bindControls() {
  document.getElementById('frequency').addEventListener('input', e => {
    document.getElementById('freqVal').textContent = e.target.value + ' Hz';
  });
  document.getElementById('amplitude').addEventListener('input', e => {
    document.getElementById('ampVal').textContent = parseFloat(e.target.value).toFixed(2);
  });
  document.getElementById('noiseLevel').addEventListener('input', e => {
    document.getElementById('noiseVal').textContent = e.target.value + '%';
  });

  document.getElementById('analyzeBtn').addEventListener('click', runAnalysis);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('aiBtn').addEventListener('click', runAIAnalysis);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function getConfig() {
  return {
    signalType:     document.getElementById('signalType').value,
    frequency:      parseFloat(document.getElementById('frequency').value),
    amplitude:      parseFloat(document.getElementById('amplitude').value),
    noiseLevel:     parseFloat(document.getElementById('noiseLevel').value),
    sampleRate:     parseInt(document.getElementById('sampleRate').value),
    windowFunc:     document.getElementById('windowFunc').value,
    distortionType: document.getElementById('distortionType').value,
  };
}

function setStatus(state, label) {
  const dot = document.getElementById('statusDot');
  const lbl = document.getElementById('statusLabel');
  dot.className = 'status-dot';
  if (state === 'idle')    { dot.classList.add('');       lbl.textContent = label || 'Idle'; }
  if (state === 'active')  { dot.classList.add('active'); lbl.textContent = label || 'Analyzing…'; }
  if (state === 'loading') { dot.classList.add('loading'); lbl.textContent = label || 'AI Thinking…'; }
  if (state === 'error')   { dot.classList.add('error');  lbl.textContent = label || 'Error'; }
}

// ─── MAIN ANALYSIS ────────────────────────────────────────────────────────────
function runAnalysis() {
  const cfg = getConfig();
  setStatus('active', 'Analyzing…');

  // Generate signal
  const samples = SignalEngine.generateSignal(
    cfg.signalType, cfg.frequency, cfg.amplitude,
    cfg.noiseLevel, cfg.sampleRate, cfg.distortionType
  );

  // Apply window & FFT
  const windowed = SignalEngine.applyWindow(samples, cfg.windowFunc);
  const spectrum  = SignalEngine.computeFFT(windowed);

  // Compute metrics
  const metrics = SignalEngine.computeMetrics(samples, spectrum, cfg.sampleRate, cfg.frequency);

  // Spectrogram
  const spectrogram = SignalEngine.computeSpectrogram(samples, cfg.sampleRate, cfg.windowFunc);

  // Save for AI
  lastMetrics      = metrics;
  lastSignalConfig = cfg;

  // Render
  renderWaveform(samples, cfg.sampleRate);
  renderSpectrum(spectrum, cfg.sampleRate);
  renderSpectrogram(spectrogram, cfg.sampleRate);
  renderHarmonics(metrics, cfg.frequency, cfg.sampleRate);
  updateMetrics(metrics);

  setStatus('active', 'Ready');
  setTimeout(() => setStatus('idle', 'Analysis complete'), 1200);
}

// ─── CHART RENDERERS ──────────────────────────────────────────────────────────

function renderWaveform(samples, sampleRate) {
  // Downsample to 512 points for display
  const step = Math.max(1, Math.floor(samples.length / 512));
  const data = [];
  const labels = [];
  for (let i = 0; i < samples.length; i += step) {
    labels.push((i / sampleRate * 1000).toFixed(2));
    data.push(+samples[i].toFixed(5));
  }

  waveformChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1e2235', borderColor: '#2e3350', textStyle: { color: '#e8eaf6', fontSize: 11 } },
    grid: { top: 8, right: 16, bottom: 30, left: 48 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#8892b0', fontSize: 9, interval: Math.floor(labels.length / 5),
        formatter: v => v + 'ms' },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8892b0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { lineStyle: { color: '#1e2235', type: 'dashed' } },
    },
    series: [{
      type: 'line',
      data,
      showSymbol: false,
      lineStyle: { color: '#3b82f6', width: 1.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [{ offset: 0, color: 'rgba(59,130,246,0.25)' }, { offset: 1, color: 'rgba(59,130,246,0)' }] } },
    }],
  });
}

function renderSpectrum(spectrum, sampleRate) {
  const freqRes = sampleRate / (spectrum.length * 2);
  const maxBins = Math.min(spectrum.length, 300);
  const labels = [];
  const data = [];
  for (let i = 1; i < maxBins; i++) {
    labels.push((i * freqRes).toFixed(0));
    const db = spectrum[i] > 0 ? 20 * Math.log10(spectrum[i]) : -120;
    data.push(+Math.max(-120, db).toFixed(2));
  }

  spectrumChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1e2235', borderColor: '#2e3350',
      textStyle: { color: '#e8eaf6', fontSize: 11 },
      formatter: p => `${p[0].name} Hz<br/>${p[0].value} dBFS` },
    grid: { top: 8, right: 16, bottom: 30, left: 50 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#8892b0', fontSize: 9, interval: Math.floor(labels.length / 6),
        formatter: v => v + 'Hz' },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', min: -120, max: 0,
      axisLabel: { color: '#8892b0', fontSize: 10, formatter: v => v + 'dB' },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { lineStyle: { color: '#1e2235', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data,
      barWidth: '100%',
      itemStyle: {
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: '#7c3aed' },
            { offset: 1, color: '#3b82f6' },
          ]},
      },
    }],
  });
}

function renderSpectrogram(spectrogram, sampleRate) {
  const numT = spectrogram.length;
  const numF = spectrogram[0].length;
  const data = [];
  for (let t = 0; t < numT; t++) {
    for (let f = 0; f < numF; f++) {
      data.push([t, f, spectrogram[t][f]]);
    }
  }

  spectrogramChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { show: false },
    grid: { top: 8, right: 60, bottom: 30, left: 40 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: numT }, (_, i) => `${i}`),
      axisLabel: { color: '#8892b0', fontSize: 9 },
      axisLine: { lineStyle: { color: '#2e3350' } },
      name: 'Time',
      nameTextStyle: { color: '#8892b0', fontSize: 9 },
    },
    yAxis: {
      type: 'category',
      data: Array.from({ length: numF }, (_, i) => `${Math.round(i * sampleRate / (spectrogram[0].length * 2 * 8))}`),
      axisLabel: { color: '#8892b0', fontSize: 9 },
      axisLine: { lineStyle: { color: '#2e3350' } },
      name: 'Freq',
      nameTextStyle: { color: '#8892b0', fontSize: 9 },
    },
    visualMap: {
      min: -80, max: 0,
      calculable: false,
      orient: 'vertical',
      right: 4, top: 'center',
      textStyle: { color: '#8892b0', fontSize: 9 },
      inRange: { color: ['#0f1117','#1e3a5f','#3b82f6','#7c3aed','#ef4444','#fbbf24'] },
    },
    series: [{
      type: 'heatmap',
      data,
      emphasis: { itemStyle: { borderColor: '#fff', borderWidth: 1 } },
    }],
  });
}

function renderHarmonics(metrics, freq, sampleRate) {
  const labels = ['Fund.', '2nd H', '3rd H', '4th H', '5th H'];
  const freqLabels = [freq, freq * 2, freq * 3, freq * 4, freq * 5].map(f => `${f.toFixed(0)} Hz`);
  const fundBin = Math.round(freq / (sampleRate / SignalEngine.SAMPLE_COUNT));

  // Magnitudes from harmonicMags (already in linear)
  const hmMags = metrics.harmonicMags || [];
  const allMags = [
    Math.sqrt(metrics.signalPower),
    ...hmMags.slice(0, 4).map(h => h.mag),
  ];
  while (allMags.length < 5) allMags.push(0);

  const dbData = allMags.map((m, i) => {
    const db = m > 0 ? 20 * Math.log10(m) : -120;
    return {
      value: +Math.max(-120, db).toFixed(2),
      itemStyle: { color: i === 0 ? '#3b82f6' : '#ef4444' },
    };
  });

  harmonicChart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', backgroundColor: '#1e2235', borderColor: '#2e3350',
      textStyle: { color: '#e8eaf6', fontSize: 11 },
      formatter: p => `${freqLabels[p[0].dataIndex]}<br/>${p[0].value} dBFS` },
    grid: { top: 8, right: 16, bottom: 36, left: 50 },
    xAxis: {
      type: 'category', data: labels,
      axisLabel: { color: '#8892b0', fontSize: 10 },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value', min: -120, max: 0,
      axisLabel: { color: '#8892b0', fontSize: 10, formatter: v => v + 'dB' },
      axisLine: { lineStyle: { color: '#2e3350' } },
      splitLine: { lineStyle: { color: '#1e2235', type: 'dashed' } },
    },
    series: [{
      type: 'bar',
      data: dbData,
      barMaxWidth: 40,
    }],
  });
}

// ─── METRICS UI UPDATE ────────────────────────────────────────────────────────

function updateMetrics(m) {
  const set = (id, val, unit, threshGood, threshWarn, cardId) => {
    document.getElementById(id).textContent = val;
    const card = document.getElementById(cardId);
    card.classList.remove('good', 'warn', 'bad');
    if (threshGood !== null) {
      const n = parseFloat(val);
      if (n >= threshGood) card.classList.add('good');
      else if (n >= threshWarn) card.classList.add('warn');
      else card.classList.add('bad');
    }
  };

  set('snrVal',       m.snr,         'dB',   30,  15,  'm-snr');
  set('thdVal',       m.thd,         '%',    null, null,'m-thd');
  colorTHD(m.thd);
  set('sinadVal',     m.sinad,       'dB',   30,  15,  'm-sinad');
  set('sfdrVal',      m.sfdr,        'dBc',  60,  30,  'm-sfdr');
  set('enobVal',      m.enob,        'bits', 10,  6,   'm-enob');
  set('noiseFloorVal',m.noiseFloor,  'dBFS', null, null,'m-noise');
  set('rmsVal',       m.rms,         'V',    null, null,'m-rms');
  set('crestVal',     m.crestFactor, 'dB',   null, null,'m-crest');

  // Quality score bar
  const scoreEl = document.getElementById('qualityScore');
  const barEl   = document.getElementById('qualityBar');
  scoreEl.textContent = m.score + '/100';
  barEl.style.width = m.score + '%';
}

function colorTHD(thd) {
  const card = document.getElementById('m-thd');
  card.classList.remove('good', 'warn', 'bad');
  if (thd < 1)       card.classList.add('good');
  else if (thd < 5)  card.classList.add('warn');
  else               card.classList.add('bad');
}

// ─── CLEAR ───────────────────────────────────────────────────────────────────

function clearAll() {
  renderEmptyCharts();
  lastMetrics = null;
  lastSignalConfig = null;

  ['snrVal','thdVal','sinadVal','sfdrVal','enobVal','noiseFloorVal','rmsVal','crestVal'].forEach(id => {
    document.getElementById(id).textContent = '—';
  });
  ['m-snr','m-thd','m-sinad','m-sfdr','m-enob','m-noise','m-rms','m-crest'].forEach(id => {
    document.getElementById(id).classList.remove('good','warn','bad');
  });
  document.getElementById('qualityScore').textContent = '—';
  document.getElementById('qualityBar').style.width = '0%';

  document.getElementById('aiPlaceholder').classList.remove('hidden');
  document.getElementById('aiResult').classList.add('hidden');
  document.getElementById('aiContent').innerHTML = '';

  setStatus('idle', 'Cleared');
}

// ─── AI ANALYSIS ─────────────────────────────────────────────────────────────

async function runAIAnalysis() {
  if (!lastMetrics) {
    alert('Please run signal analysis first before requesting AI insights.');
    return;
  }

  setStatus('loading', 'AI Thinking…');
  const aiBtn = document.getElementById('aiBtn');
  aiBtn.disabled = true;

  document.getElementById('aiPlaceholder').classList.add('hidden');
  const aiResult = document.getElementById('aiResult');
  const aiThinking = document.getElementById('aiThinking');
  const aiContent = document.getElementById('aiContent');

  aiResult.classList.remove('hidden');
  aiThinking.classList.remove('hidden');
  aiContent.innerHTML = '';

  const cfg = lastSignalConfig;
  const m   = lastMetrics;

  const prompt = buildAIPrompt(cfg, m);

  try {
    const response = await fetch(GROQ_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `You are an expert RF/DSP signal quality engineer. Analyze the given signal metrics and provide structured technical insights. Be precise, technical, and actionable. Format your response using HTML with <h3> for section headers and <ul><li> for bullet points. Use these badge classes for ratings: <span class="ai-badge badge-good">GOOD</span>, <span class="ai-badge badge-warn">WARNING</span>, <span class="ai-badge badge-bad">CRITICAL</span>, <span class="ai-badge badge-info">INFO</span>.`,
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || 'No response from model.';

    aiThinking.classList.add('hidden');
    aiContent.innerHTML = aiText;
    setStatus('active', 'AI Analysis Complete');
    setTimeout(() => setStatus('idle', 'Done'), 2000);
  } catch (err) {
    aiThinking.classList.add('hidden');
    aiContent.innerHTML = `<span style="color:#ef4444">⚠ AI Error: ${escapeHtml(err.message)}</span>`;
    setStatus('error', 'AI Error');
  } finally {
    aiBtn.disabled = false;
  }
}

function buildAIPrompt(cfg, m) {
  return `Analyze the following signal quality measurement results and provide expert insights:

**Signal Configuration:**
- Type: ${cfg.signalType}
- Frequency: ${cfg.frequency} Hz
- Amplitude: ${cfg.amplitude}
- Sample Rate: ${cfg.sampleRate} Hz
- Noise Level: ${cfg.noiseLevel}%
- Window Function: ${cfg.windowFunc}
- Distortion Type: ${cfg.distortionType}

**Measured Quality Metrics:**
- SNR (Signal-to-Noise Ratio): ${m.snr} dB
- THD (Total Harmonic Distortion): ${m.thd}%
- SINAD: ${m.sinad} dB
- SFDR (Spurious-Free Dynamic Range): ${m.sfdr} dBc
- ENOB (Effective Number of Bits): ${m.enob} bits
- Noise Floor: ${m.noiseFloor} dBFS
- RMS Voltage: ${m.rms} V
- Crest Factor: ${m.crestFactor} dB
- Overall Quality Score: ${m.score}/100

Please provide:
1. A brief overall quality assessment with rating badge
2. Key findings and what each metric indicates about the signal
3. Identified issues or anomalies
4. Root cause analysis (especially relating to the distortion type and noise level)
5. Recommendations to improve signal quality
6. Application suitability (e.g., audio, RF, ADC testing, communications)`;
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
