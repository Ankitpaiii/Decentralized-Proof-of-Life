<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/React-19.2-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Ethers.js-6.x-3C3C3D?style=for-the-badge&logo=ethereum&logoColor=white" alt="Ethers" />
</p>

<h1 align="center">🛡️ Decentralized Proof-of-Life Authentication System</h1>

<p align="center">
  <strong>A privacy-first, client-side biometric authentication protocol combining Web3 wallet identity with real-time facial liveness detection.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-project-structure">Project Structure</a> •
  <a href="#-how-it-works">How It Works</a> •
  <a href="#-security">Security</a>
</p>

---

## 🚀 Features

| Feature | Description |
|---------|-------------|
| **Decentralized Identity** | MetaMask wallet address as the primary identifier — no centralized accounts |
| **Facial Biometrics** | 128-dimensional face encodings via face-api.js (TinyFaceDetector + FaceNet) |
| **Liveness Detection** | 6 interactive challenges — smile, head turn (L/R), look up/down, mouth open |
| **Identity Hard-Fail** | Face similarity gate — verification always fails if the face doesn't match the registered identity |
| **Anti-Spoofing** | Challenge randomization, replay protection, rate limiting, timing validation |
| **Privacy-First** | Only mathematical face descriptors stored — raw images never leave the browser |
| **Token-Based Access** | Time-bound Proof-of-Life (POL) tokens with 5-minute expiry windows |
| **Multi-Factor Scoring** | Weighted confidence scoring — identity match (35%), challenge accuracy (25%), liveness (25%), face detection (15%) |
| **Secure Re-registration** | Face data can only be overwritten after successful identity verification |
| **Client-Side Storage** | IndexedDB persistence — all data stays on the user's device |

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                          │
│                                                                     │
│  ┌──────────┐   ┌──────────────┐   ┌──────────────┐               │
│  │ MetaMask │◄──│ Wallet       │──►│ User Store   │── IndexedDB   │
│  │ Provider │   │ Service      │   │ (Persistence)│               │
│  └──────────┘   └──────────────┘   └──────────────┘               │
│                        │                    ▲                       │
│                        ▼                    │                       │
│  ┌──────────────────────────────────────────┴──────────────────┐   │
│  │                    APP STATE MACHINE                         │   │
│  │  Landing ──► Register ──► Verify ──► Dashboard              │   │
│  └─────────────────────┬──────────────────────────────────────┘   │
│                        │                                           │
│         ┌──────────────┼──────────────┐                           │
│         ▼              ▼              ▼                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                    │
│  │ Face       │ │ Liveness   │ │ Challenge  │                    │
│  │ Encoding   │ │ Detection  │ │ Generator  │                    │
│  │ Service    │ │ Engine     │ │            │                    │
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘                    │
│         │              │              │                           │
│         ▼              ▼              ▼                           │
│  ┌──────────────────────────────────────────┐                    │
│  │           SECURITY LAYER                 │                    │
│  │  Anti-Replay │ Scoring │ Token Manager   │                    │
│  └──────────────────────────────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Verification Flow

```
┌───────────┐     ┌───────────┐     ┌───────────┐     ┌───────────┐
│   INIT    │────►│  CAMERA   │────►│ CHALLENGE │────►│ ANALYZING │
│           │     │           │     │           │     │           │
│ • Wallet  │     │ • Stream  │     │ • Random  │     │ • Face    │
│   check   │     │   init    │     │   action  │     │   match   │
│ • User    │     │ • Model   │     │ • 10s     │     │ • Score   │
│   lookup  │     │   load    │     │   timer   │     │   calc    │
│ • Rate    │     │ • Face    │     │ • Live    │     │ • Token   │
│   limit   │     │   detect  │     │   detect  │     │   issue   │
└───────────┘     └───────────┘     └───────────┘     └─────┬─────┘
                                                            │
                                    ┌───────────┐           │
                                    │  RESULTS  │◄──────────┘
                                    │           │
                                    │ • Score   │
                                    │   display │
                                    │ • Pass /  │
                                    │   Fail    │
                                    │ • Token   │
                                    │   access  │
                                    └───────────┘
```

### Confidence Scoring Model

```
                    ┌─────────────────────────────────┐
                    │     MULTI-FACTOR SCORING         │
                    ├─────────────────────────────────┤
                    │                                   │
                    │  Identity Match ──── 35% weight   │
                    │  Challenge Accuracy ─ 25% weight  │
                    │  Liveness Score ───── 25% weight   │
                    │  Face Detection ──── 15% weight   │
                    │                                   │
                    ├─────────────────────────────────┤
                    │  ⚠️ Identity < 50% → HARD FAIL    │
                    │  ≥ 95%  →  Excellent (Pass ✅)    │
                    │  ≥ 85%  →  Good (Pass ✅)         │
                    │  ≥ 75%  →  Acceptable (Pass ✅)   │
                    │  < 75%  →  Failed (Fail ❌)       │
                    └─────────────────────────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 19.2 + Vite 7.3 | UI framework & build tooling |
| **Face AI** | face-api.js (TensorFlow.js) | Face detection, landmarks, recognition, expressions |
| **Web3** | ethers.js v6 | MetaMask wallet connection & message signing |
| **Storage** | IndexedDB | Client-side persistence for user data & sessions |
| **Tokens** | sessionStorage | Time-bound POL token management |
| **IDs** | uuid v13 | Cryptographic session & challenge identifiers |

---

## 📦 Getting Started

### Prerequisites

- **Node.js** ≥ 18.x
- **MetaMask** browser extension ([Install](https://metamask.io/download/))
- **Webcam** access (for face detection)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ankitpaiii/Decentralized-Proof-of-Life.git
cd Decentralized-Proof-of-Life

# Install dependencies
npm install

# Start development server
npm run dev
```

Open **http://localhost:5173** in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

---

## 📁 Project Structure

```
src/
├── components/                  # React UI Components
│   ├── LandingPage.jsx          # Hero section, features, CTAs
│   ├── WalletConnect.jsx        # MetaMask connection interface
│   ├── CameraCapture.jsx        # WebRTC camera with face quality checks
│   ├── RegistrationFlow.jsx     # Multi-step registration orchestrator
│   ├── VerificationScreen.jsx   # Full verification flow controller
│   ├── ChallengeDisplay.jsx     # Liveness challenge instruction display
│   ├── Timer.jsx                # SVG circular countdown timer
│   ├── ConfidenceScore.jsx      # Animated score gauge & breakdown
│   └── Dashboard.jsx            # Authenticated dashboard with token info
│
├── services/                    # Core Business Logic
│   ├── walletService.js         # MetaMask integration via ethers.js
│   ├── faceEncodingService.js   # face-api.js model loading & face ops
│   ├── challengeGenerator.js    # Random liveness challenge generation
│   ├── livenessDetection.js     # EAR blink, smile, head pose detection
│   ├── antiReplay.js            # Challenge dedup, rate limiting, timing
│   ├── tokenManager.js          # POL token issuance & validation
│   ├── scoring.js               # Multi-factor confidence scoring
│   └── userStore.js             # IndexedDB persistence layer
│
├── App.jsx                      # Root component & state machine router
├── main.jsx                     # Application entry point
└── index.css                    # Design system (dark theme, glassmorphism)

public/
└── models/                      # Pre-trained face-api.js models
    ├── tiny_face_detector_model-*
    ├── face_landmark_68_model-*
    ├── face_recognition_model-*
    └── face_expression_model-*
```

---

## 🔄 How It Works

### 1. Registration (One-Time)

```
User ──► Connect MetaMask Wallet
     ──► Grant Camera Access
     ──► Face Quality Validation (lighting, distance, angle)
     ──► Capture 5 Frames → Average 128-D Descriptor
     ──► Store Encoding in IndexedDB (keyed by wallet address)
```

### 2. Verification (Recurring)

```
User ──► Connect Wallet (identity check)
     ──► Camera Initialization + Model Loading
     ──► Random Liveness Challenge (e.g., "Turn Head Left")
     ──► 10-Second Timer Countdown
     ──► Real-Time Face Detection + Challenge Monitoring
     ──► Anti-Replay Validation (dedup, timing, rate limit)
     ──► Face Match Against Stored Encoding (hard-fail if < 50%)
     ──► Multi-Factor Confidence Scoring
     ──► POL Token Issuance (if score ≥ 75% AND identity verified)
```

### 3. Dashboard Access

```
Token Valid ──► View Identity Information
           ──► Verification History & Statistics
           ──► Token Countdown Timer
           ──► Access Secure Resources
           ──► Re-verify, Re-register Face, or Revoke Token
```

---

## 🔐 Security

### Threat Mitigation

| Threat | Countermeasure |
|--------|---------------|
| **Photo/Video Replay** | Randomized liveness challenges requiring real-time facial actions |
| **Challenge Replay** | UUID-based challenge IDs with single-use enforcement |
| **Brute Force** | Per-wallet rate limiting (max 5 attempts per 60s window) |
| **Token Theft** | 5-minute expiry, wallet-bound tokens, session-scoped storage |
| **Timing Attacks** | Minimum/maximum verification duration validation |
| **Data Theft** | All biometric data stored client-side only; no server transmission |
| **Identity Spoofing** | Hard-fail gate — different face always rejected regardless of other scores |
| **Unauthorized Re-registration** | Face data overwrite only available after successful identity verification |
| **MetaMask Auto-Reconnect** | Permission revocation on logout prevents silent re-authorization |

### Privacy Guarantees

- ✅ **Zero raw image storage** — only 128-dimensional mathematical descriptors
- ✅ **No server communication** — fully client-side processing
- ✅ **User-controlled data** — stored in browser's IndexedDB, deletable at any time
- ✅ **No tracking** — no analytics, cookies, or third-party services

---

## 🎨 Design System

The application features a premium dark theme with:

- **Glassmorphism** — frosted glass cards with backdrop blur
- **Gradient accents** — violet-to-cyan linear gradients
- **Typography** — Inter (UI) + JetBrains Mono (code/addresses)
- **Animations** — 15+ keyframe animations (fadeIn, slideUp, pulse, shimmer, float)
- **Responsive** — fully adaptive from 320px to 1200px+

---

## 📊 Liveness Challenge Types

| Challenge | Detection Method | Threshold |
|-----------|-----------------|-----------|
| `SMILE` | Expression analysis (`happy` score) | > 0.6 for 1.5 seconds |
| `TURN_LEFT` | Head pose yaw estimation | Yaw < -20° |
| `TURN_RIGHT` | Head pose yaw estimation | Yaw > 20° |
| `OPEN_MOUTH` | Mouth Aspect Ratio (MAR) | MAR > 0.35 |
| `LOOK_UP` | Head pose pitch estimation | Pitch < -10° |
| `LOOK_DOWN` | Head pose pitch estimation | Pitch > 10° |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  <strong>Built with ❤️ for the decentralized future</strong>
</p>
