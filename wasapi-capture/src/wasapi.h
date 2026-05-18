#pragma once
#include <windows.h>
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <vector>
#include <cstdint>

class WasapiCapture {
public:
    WasapiCapture();
    ~WasapiCapture();

    bool Initialize();
    bool Start();
    void Stop();
    std::vector<uint8_t> GetData();
    void Cleanup();

    uint32_t GetSampleRate();
    uint32_t GetChannels();
    uint32_t GetBits();

private:
    IMMDeviceEnumerator *pEnumerator;
    IMMDevice           *pDevice;
    IAudioClient        *pAudioClient;
    IAudioCaptureClient *pCaptureClient;
    bool isCapturing;
    uint32_t sampleRate;
    uint32_t channels;
    uint32_t bitsPerSample;
};
