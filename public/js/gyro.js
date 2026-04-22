/**
 * TeamChat 陀螺仪模块
 * 提供归一化倾斜值 tiltX/tiltY (-1 ~ +1) 供动态气泡 / 视差壁纸使用
 *
 * tiltX: 左倾 -1 ← 0 → +1 右倾  (gamma)
 * tiltY: 前倾 -1 ← 0 → +1 后倾  (beta, 以自然握持角度为零)
 *
 * 用法:
 *   Gyro.onTilt(function(tx, ty) { ... });
 *   await Gyro.start();        // iOS 会触发权限弹窗
 *   Gyro.stop();
 */
(function() {
  'use strict';

  var _listeners = [];
  var _active    = false;

  /* ---- 原始读数 ---- */
  var _rawX = 0, _rawY = 0;
  /* ---- 平滑后输出 ---- */
  var _smoothX = 0, _smoothY = 0;

  /* ---- 自适应基线 (自然握持姿态) ---- */
  var _baseGamma = 0;
  var _baseBeta  = 55;          /* 默认假设手机举在面前约 55° */
  var _baseReady = false;
  var _baseSamples = [];
  var BASE_WARMUP = 15;         /* 前 N 帧用来建立基线 */
  var BASE_DRIFT  = 0.002;      /* 基线缓慢跟随 (防止长时间漂移) */

  var SMOOTH   = 0.10;          /* lerp 因子, 越小越丝滑 */
  var MAX_TILT = 30;            /* ±30° 映射到 ±1 */

  var _rafId = null;

  /* ======== 能力检测 ======== */
  function isSupported() {
    return 'DeviceOrientationEvent' in window;
  }
  function needsPermission() {
    return typeof DeviceOrientationEvent !== 'undefined' &&
           typeof DeviceOrientationEvent.requestPermission === 'function';
  }

  /* ======== iOS 权限 ======== */
  function requestPermission() {
    return new Promise(function(resolve) {
      if (!needsPermission()) { resolve(true); return; }
      DeviceOrientationEvent.requestPermission()
        .then(function(state) { resolve(state === 'granted'); })
        .catch(function()     { resolve(false); });
    });
  }

  /* ======== 事件处理 ======== */
  function _onOrientation(e) {
    var beta  = e.beta;       /* -180 ~ 180 */
    var gamma = e.gamma;      /*  -90 ~  90 */
    if (beta === null || gamma === null) return;

    /* --- 基线校准 (前 N 帧取中位数) --- */
    if (!_baseReady) {
      _baseSamples.push({ b: beta, g: gamma });
      if (_baseSamples.length >= BASE_WARMUP) {
        _baseSamples.sort(function(a,b){ return a.b - b.b; });
        _baseBeta = _baseSamples[Math.floor(BASE_WARMUP/2)].b;
        _baseSamples.sort(function(a,b){ return a.g - b.g; });
        _baseGamma = _baseSamples[Math.floor(BASE_WARMUP/2)].g;
        _baseReady = true;
        _baseSamples = null;    /* 释放 */
      }
      return;   /* 校准期间不输出 */
    }

    /* --- 基线缓慢跟随 (防长时间漂移) --- */
    _baseBeta  += (beta  - _baseBeta)  * BASE_DRIFT;
    _baseGamma += (gamma - _baseGamma) * BASE_DRIFT;

    /* --- 归一化到 -1 ~ +1 --- */
    _rawX = Math.max(-1, Math.min(1, (gamma - _baseGamma) / MAX_TILT));
    _rawY = Math.max(-1, Math.min(1, (beta  - _baseBeta)  / MAX_TILT));
  }

  /* ======== rAF 循环: 平滑 + 通知 ======== */
  function _loop() {
    _smoothX += (_rawX - _smoothX) * SMOOTH;
    _smoothY += (_rawY - _smoothY) * SMOOTH;

    /* 极小值归零, 避免无意义的持续更新 */
    var ax = Math.abs(_smoothX), ay = Math.abs(_smoothY);
    if (ax < 0.005) _smoothX = 0;
    if (ay < 0.005) _smoothY = 0;

    for (var i = 0; i < _listeners.length; i++) {
      _listeners[i](_smoothX, _smoothY);
    }
    _rafId = requestAnimationFrame(_loop);
  }

  /* ======== 公开 API ======== */
  function start() {
    if (_active) return Promise.resolve(true);
    if (!isSupported()) return Promise.resolve(false);

    return requestPermission().then(function(ok) {
      if (!ok) return false;
      _baseReady = false;
      _baseSamples = [];
      _rawX = _rawY = _smoothX = _smoothY = 0;
      window.addEventListener('deviceorientation', _onOrientation, true);
      _rafId = requestAnimationFrame(_loop);
      _active = true;
      return true;
    });
  }

  function stop() {
    if (!_active) return;
    window.removeEventListener('deviceorientation', _onOrientation, true);
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _active = false;
    _rawX = _rawY = _smoothX = _smoothY = 0;
    _baseReady = false;
    _baseSamples = [];
  }

  function onTilt(fn)  { if (typeof fn === 'function') _listeners.push(fn); }
  function offTilt(fn) { _listeners = _listeners.filter(function(f){ return f !== fn; }); }

  /* 手动重置基线 (下次自动重新采集) */
  function recalibrate() {
    _baseReady = false;
    _baseSamples = [];
    _rawX = _rawY = _smoothX = _smoothY = 0;
  }

  window.Gyro = {
    isSupported:     isSupported,
    needsPermission: needsPermission,
    requestPermission: requestPermission,
    start:           start,
    stop:            stop,
    onTilt:          onTilt,
    offTilt:         offTilt,
    recalibrate:     recalibrate,
    get active()     { return _active; }
  };
})();
