#include "wasapi.h"
#include <mmdeviceapi.h>
#include <audioclient.h>
#include <functiondiscoverykeys_devpkey.h>
#include <comdef.h>

#define REFTIMES_PER_SEC 10000000
#define REFTIMES_PER_MILLISEC 10000

WasapiCapture::WasapiCapture() 
    : pEnumerator(nullptr), pDevice(nullptr), pAudioClient(nullptr),
      pCaptureClient(nullptr), isCapturing(false), sampleRate(44100),
      channels(2), bitsPerSample(16) {}

WasapiCapture::~WasapiCapture() {
    Stop();
    Cleanup();
}

bool WasapiCapture::Initialize() {
    HRESULT hr = CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    if (FAILED(hr) && hr != RPC_E_CHANGED_MODE) return false;

    hr = CoCreateInstance(
        __uuidof(MMDeviceEnumerator), nullptr, CLSCTX_ALL,
        __uuidof(IMMDeviceEnumerator), (void**)&pEnumerator
    );
    if (FAILED(hr)) return false;

    // Varsayılan render (hoparlör) cihazını al — loopback için
    hr = pEnumerator->GetDefaultAudioEndpoint(eRender, eConsole, &pDevice);
    if (FAILED(hr)) return false;

    hr = pDevice->Activate(__uuidof(IAudioClient), CLSCTX_ALL, nullptr, (void**)&pAudioClient);
    if (FAILED(hr)) return false;

    WAVEFORMATEX *pwfx = nullptr;
    hr = pAudioClient->GetMixFormat(&pwfx);
    if (FAILED(hr)) return false;

    sampleRate = pwfx->nSamplesPerSec;
    channels = pwfx->nChannels;
    bitsPerSample = 16;

    // LOOPBACK modu — sistem sesini yakala
    hr = pAudioClient->Initialize(
        AUDCLNT_SHAREMODE_SHARED,
        AUDCLNT_STREAMFLAGS_LOOPBACK,
        REFTIMES_PER_SEC,
        0,
        pwfx,
        nullptr
    );
    CoTaskMemFree(pwfx);
    if (FAILED(hr)) return false;

    hr = pAudioClient->GetService(__uuidof(IAudioCaptureClient), (void**)&pCaptureClient);
    if (FAILED(hr)) return false;

    return true;
}

bool WasapiCapture::Start() {
    if (!pAudioClient) return false;
    HRESULT hr = pAudioClient->Start();
    if (FAILED(hr)) return false;
    isCapturing = true;
    return true;
}

void WasapiCapture::Stop() {
    if (pAudioClient && isCapturing) {
        pAudioClient->Stop();
        isCapturing = false;
    }
}

std::vector<uint8_t> WasapiCapture::GetData() {
    std::vector<uint8_t> result;
    if (!pCaptureClient || !isCapturing) return result;

    UINT32 packetLength = 0;
    HRESULT hr = pCaptureClient->GetNextPacketSize(&packetLength);
    if (FAILED(hr)) return result;

    while (packetLength != 0) {
        BYTE *pData;
        UINT32 numFramesAvailable;
        DWORD flags;

        hr = pCaptureClient->GetBuffer(&pData, &numFramesAvailable, &flags, nullptr, nullptr);
        if (FAILED(hr)) break;

        if (!(flags & AUDCLNT_BUFFERFLAGS_SILENT)) {
            size_t dataSize = numFramesAvailable * channels * (bitsPerSample / 8);
            result.insert(result.end(), pData, pData + dataSize);
        }

        hr = pCaptureClient->ReleaseBuffer(numFramesAvailable);
        if (FAILED(hr)) break;

        hr = pCaptureClient->GetNextPacketSize(&packetLength);
        if (FAILED(hr)) break;
    }

    return result;
}

void WasapiCapture::Cleanup() {
    if (pCaptureClient) { pCaptureClient->Release(); pCaptureClient = nullptr; }
    if (pAudioClient)   { pAudioClient->Release();   pAudioClient = nullptr; }
    if (pDevice)        { pDevice->Release();         pDevice = nullptr; }
    if (pEnumerator)    { pEnumerator->Release();     pEnumerator = nullptr; }
    CoUninitialize();
}

uint32_t WasapiCapture::GetSampleRate() { return sampleRate; }
uint32_t WasapiCapture::GetChannels()   { return channels; }
uint32_t WasapiCapture::GetBits()       { return bitsPerSample; }
