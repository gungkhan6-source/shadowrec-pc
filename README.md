# ShadowRec PC

A desktop screen recorder and video conversion application built with Electron, React, and FFmpeg.

ShadowRec PC is part of the NovaRec Studio ecosystem, providing a modern Windows-focused recording and video processing experience.

## ✨ Features

- 🖥️ Screen recording
- 🎮 Game and desktop capture support
- 🎥 720p, 1080p, 1440p and 4K recording
- ⚡ 30/60 FPS recording
- 🚀 GPU hardware encoding
  - NVIDIA NVENC
  - AMD AMF
  - CPU fallback with libx264
- 🔄 Video conversion
- 📐 Multiple video presets
  - Shorts
  - Widescreen
  - Square
  - 720p
  - 4K
- 🎞️ Format support
  - MP4
  - MKV
  - WebM
  - GIF
  - MP3
- ⏩ Playback speed control
  - 0.5x
  - 1x
  - 1.5x
  - 2x
- 📦 Windows `.exe` and MSIX packaging

## 🛠️ Technologies

- Electron
- React
- JavaScript
- FFmpeg
- C++
- CSS
- Node.js

## 🚀 Installation

Clone the repository:

```bash
git clone https://github.com/gungkhan6-source/shadowrec-pc.git
cd shadowrec-pc

Install dependencies:

💻 Development

Start the application in development mode:

npm start

📦 Build

Create Windows .exe and MSIX packages:

npm run electron-build

🎬 FFmpeg

ShadowRec PC uses FFmpeg for video processing and conversion.

Download FFmpeg and place ffmpeg.exe inside:

bin/ffmpeg.exe

🏗️ Architecture
ShadowRec PC
│
├── Electron
│   └── Desktop application
│
├── React
│   └── User interface
│
├── FFmpeg
│   └── Video processing
│
└── Native modules
    └── Hardware-accelerated capture

🎯 Project Status

ShadowRec PC is under active development as part of the NovaRec Studio ecosystem.

Future development may include:

Advanced recording controls
Streaming integration
More hardware encoders
Performance optimizations
Additional video processing tools
Improved Windows integration
🔗 Related Projects
ShadowRec — Native high-performance capture pipeline
ShadowRec Game Capture — Native game capture component
📄 License

See the repository license for details.

