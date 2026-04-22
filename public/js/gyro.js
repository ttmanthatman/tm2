/**
 * TeamChat 姿态感知模块
 * 输出完整三轴姿态 alpha / beta / gamma (平滑后, 无截断)
 *
 *   alpha : 0 ~ 360  罗盘方位角 (磁北=0, 顺时针)
 *   beta  : -180 ~ 180  前后俯仰 (平放=0, 竖直=90)
 *   gamma : -90 ~ 90   左右横滚
 *
 * 优先使用 deviceorientationabsolute (含磁力计校准);
 * 不支持时降级到 deviceorientation。
 *
 * 用法:
 *   Gyro.onOrientation(function(alpha, beta, gamma) { ... });
 *   await Gyro.start();
 *   Gyro.stop();
 */
(function() {
  'use strict';

  var _listeners = [];
  var _active    = false;

  /* ---- 原始读数 ---- */
  var _rA = 0, _rB = 0, _rG = 0;
  /* ---- 平滑后 ---- */
  var _sA = 0, _sB = 0, _sG = 0;

  var _rafId  = null;
  var _ready  = false;
  var _warmup = 0;
  var WARMUP  = 8;
  var SMOOTH  = 0.12;
  var _useAbs = false;

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
        .then(function(s) { resolve(s === 'granted'); })
        .catch(function() { resolve(false); });
    });
  }

  /* ======== 事件处理 ======== */
  function _onEvent(e) {
    var a = e.alpha, b = e.beta, g = e.gamma;
    if (a === null && b === null && g === null) return;

    /* iOS webkitCompassHeading: 磁北真方位, 比 alpha 更准 */
    if (e.webkitCompassHeading != null) a = e.webkitCompassHeading;

    _rA = a || 0;
    _rB = b || 0;
    _rG = g || 0;

    if (!_ready) {
      _warmup++;
      if (_warmup >= WARMUP) {
        _sA = _rA; _sB = _rB; _sG = _rG;
        _ready = true;
      }
    }
  }

  /* 环形角度平滑 (处理 0↔360 边界) */
  function _lerpAng(cur, tgt, k) {
    var d = tgt - cur;
    if (d > 180)  d -= 360;
    if (d < -180) d += 360;
    var r = cur + d * k;
    if (r < 0)   r += 360;
    if (r >= 360) r -= 360;
    return r;
  }

  /* ======== rAF 循环 ======== */
  function _loop() {
    if (_ready) {
      _sA = _lerpAng(_sA, _rA, SMOOTH);
      _sB += (_rB - _sB) * SMOOTH;
      _sG += (_rG - _sG) * SMOOTH;

      for (var i = 0; i < _listeners.length; i++) {
        _listeners[i](_sA, _sB, _sG);
      }
    }
    _rafId = requestAnimationFrame(_loop);
  }

  /* ======== 公开 API ======== */
  function start() {
    if (_active) return Promise.resolve(true);
    if (!isSupported()) return Promise.resolve(false);

    return requestPermission().then(function(ok) {
      if (!ok) return false;
      _ready = false; _warmup = 0;

      /* 优先 absolute (含磁力计校准) */
      _useAbs = false;
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', _onEvent, true);
        _useAbs = true;
      }
      window.addEventListener('deviceorientation', _onEvent, true);

      _rafId = requestAnimationFrame(_loop);
      _active = true;
      return true;
    });
  }

  function stop() {
    if (!_active) return;
    if (_useAbs) window.removeEventListener('deviceorientationabsolute', _onEvent, true);
    window.removeEventListener('deviceorientation', _onEvent, true);
    if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
    _active = false; _ready = false;
  }

  function onOrientation(fn)  { if (typeof fn === 'function') _listeners.push(fn); }
  function offOrientation(fn) { _listeners = _listeners.filter(function(f){ return f !== fn; }); }

  window.Gyro = {
    isSupported:      isSupported,
    needsPermission:  needsPermission,
    requestPermission: requestPermission,
    start:            start,
    stop:             stop,
    onOrientation:    onOrientation,
    offOrientation:   offOrientation,
    get active()      { return _active; }
  };
})();
