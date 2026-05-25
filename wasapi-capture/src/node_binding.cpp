#include <napi.h>
#include "wasapi.h"
// Global capture instance
static WasapiCapture* captureInstance = nullptr;
// Initialize WASAPI
Napi::Value Initialize(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (captureInstance) {
        delete captureInstance;
        captureInstance = nullptr;
    }
    captureInstance = new WasapiCapture();
    bool success = captureInstance->Initialize();
    if (!success) {
        delete captureInstance;
        captureInstance = nullptr;
        Napi::Error::New(env, "WASAPI Initialize failed").ThrowAsJavaScriptException();
        return env.Null();
    }
    Napi::Object info_obj = Napi::Object::New(env);
    info_obj.Set("sampleRate", Napi::Number::New(env, captureInstance->GetSampleRate()));
    info_obj.Set("channels",   Napi::Number::New(env, captureInstance->GetChannels()));
    info_obj.Set("bits",       Napi::Number::New(env, captureInstance->GetBits()));
    info_obj.Set("isFloat",    Napi::Boolean::New(env, captureInstance->GetIsFloat()));  // ⭐ YENİ
    return info_obj;
}
// Start capture
Napi::Value Start(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (!captureInstance) {
        Napi::Error::New(env, "Not initialized").ThrowAsJavaScriptException();
        return env.Null();
    }
    bool success = captureInstance->Start();
    return Napi::Boolean::New(env, success);
}
// Stop capture
Napi::Value Stop(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (captureInstance) {
        captureInstance->Stop();
    }
    return env.Undefined();
}
// Get captured audio data
Napi::Value GetData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (!captureInstance) {
        return Napi::Buffer<uint8_t>::New(env, 0);
    }
    auto data = captureInstance->GetData();
    if (data.empty()) {
        return Napi::Buffer<uint8_t>::New(env, 0);
    }
    auto buffer = Napi::Buffer<uint8_t>::Copy(env, data.data(), data.size());
    return buffer;
}
// Cleanup
Napi::Value Cleanup(const Napi::CallbackInfo& info) {
    if (captureInstance) {
        delete captureInstance;
        captureInstance = nullptr;
    }
    return info.Env().Undefined();
}
// Module init
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("initialize", Napi::Function::New(env, Initialize));
    exports.Set("start",      Napi::Function::New(env, Start));
    exports.Set("stop",       Napi::Function::New(env, Stop));
    exports.Set("getData",    Napi::Function::New(env, GetData));
    exports.Set("cleanup",    Napi::Function::New(env, Cleanup));
    return exports;
}
NODE_API_MODULE(wasapi_capture, Init)
