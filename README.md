# ShadowRec PC

Electron + React + FFmpeg tabanlı ekran kaydedici ve video converter.

## Kurulum
```bash
npm install
```

## Geliştirme
```bash
npm start
```

## Build (Windows .exe + MSIX)
```bash
npm run electron-build
```

## FFmpeg
`bin/ffmpeg.exe` dosyasını https://ffmpeg.org/download.html adresinden indirip `bin/` klasörüne koy.

## Özellikler
- Ekran kaydı (720p/1080p/1440p/4K, 30/60fps)
- GPU encode (NVIDIA NVENC, AMD AMF, fallback libx264)
- Video converter (Shorts, Widescreen, 4K, Square, 720p)
- Format desteği (MP4, MKV, WebM, GIF, MP3)
- Hız ayarı (0.5x - 2x)
- Microsoft Store MSIX paketi
