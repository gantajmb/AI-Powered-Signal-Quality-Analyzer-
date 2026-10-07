# AI-Powered Signal Quality Analyzer

A browser-based signal quality analyzer that combines real-time DSP processing with AI-powered analysis using the **Groq API** (`openai/gpt-oss-20b`).

## Features

- **6 signal types** — Sine, Square, Sawtooth, Triangle, Noise, Composite
- **4 distortion modes** — Harmonic, Intermodulation, Clipping, Jitter
- **4 window functions** — Hann, Hamming, Blackman, Rectangular
- **Cooley-Tukey FFT** (1024-point, radix-2)
- **9 quality metrics** — SNR, THD, SINAD, SFDR, ENOB, Noise Floor, RMS, Crest Factor, Quality Score
- **4 live charts** — Waveform, Spectrum, Spectrogram, Harmonic Profile (via ECharts 5)
- **AI Deep Analysis** — Expert signal quality report from `openai/gpt-oss-20b` via Groq

## Quick Start

### 1. Add your Groq API key

Copy the example config and fill in your key:

```bash
cp config.example.js config.js
```

Edit `config.js`:
```js
const __GROQ_API_KEY__ = 'gsk_...your_key_here...';
```

Get a free key at https://console.groq.com/keys

### 2. Run locally

Open `index.html` directly in your browser for signal analysis (charts + metrics work offline).

For AI analysis (requires API call), serve with a local HTTP server:

```bash
# Python
python -m http.server 8080

# Node.js
npx serve .
```

Then open http://localhost:8080

## Project Structure

```
.
+-- index.html          # Main app shell (3-panel layout)
+-- style.css           # Dark theme design system
+-- signal.js           # DSP engine (FFT, generators, metrics)
+-- app.js              # App controller + ECharts + Groq API
+-- config.example.js   # API key template (safe to commit)
+-- config.js           # Your real API key (git-ignored)
+-- .gitignore
```

## Usage

1. Select signal type, frequency, amplitude, noise level
2. Choose sample rate, window function, and distortion type
3. Click **? Analyze Signal** — all 4 charts and 9 metrics update instantly
4. Click **?? AI Deep Analysis** — get expert insights from `openai/gpt-oss-20b`

## Tech Stack

| Layer | Technology |
|---|---|
| Charts | ECharts 5.4.3 |
| DSP | Vanilla JS (Cooley-Tukey FFT) |
| AI | Groq API — `openai/gpt-oss-20b` |
| UI | Pure HTML/CSS (no framework) |

## Security Note

`config.js` is listed in `.gitignore` and will never be committed. Never put API keys directly in source files.
