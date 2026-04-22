/**
 * TeamChat 姿态感知模块 v2
 *
 * 输出完整三轴姿态 (alpha, beta, gamma) + 桌面端鼠标降级
 * 优先 deviceorientationabsolute (含磁力计校准)
 *
 * API:
 *   Gyro.on(fn)        — fn(alpha, beta, gamma)  每帧回调
 *   Gyro.off(fn)
 *   await Gyro.start() — 启动 (iOS 弹权限)，返回 true/false
 *   Gyro.stop()
 *   Gyro.hasDevice      — 是否有陀螺仪 (start 后才准)
 */
(function() {
  'use strict';
  var _cbs = [], _active = false, _rafId = null;

  /* --- 原始 & 平滑 --- */
  var _rA = 0, _rB = 0, _rG = 0;
  var _sA = 0, _sB = 0, _sG = 0;
  var _ready = false, _warmup = 0;
  var WARMUP = 6, K = 0.14;          /* lerp 因子 */
  var _useAbs = false, _hasDevice = false;

  /* --- 桌面鼠标降级 --- */
  var _mouseActive = false;
  var _mx = 0, _my = 0;              /* 归一化 -1~1 */

  /* ======== 检测 ======== */
  function isSupported() { return 'DeviceOrientationEvent' in window; }
  function needsPerm() {
    return typeof DeviceOrientationEvent !== 'undefined' &&
           typeof DeviceOrientationEvent.requestPermission === 'function';
  }
  function reqPerm() {
    return new Promise(function(ok) {
      if (!needsPerm()) return ok(true);
      DeviceOrientationEvent.requestPermission()
        .then(function(s) { ok(s === 'granted'); })
        .catch(function() { ok(false); });
    });
  }

  /* ======== 事件 ======== */
  function _onDev(e) {
    var a = e.alpha, b = e.beta, g = e.gamma;
    if (a === null && b === null && g === null) return;
    if (e.webkitCompassHeading != null) a = e.webkitCompassHeading;
    _rA = a || 0; _rB = b || 0; _rG = g || 0;
    _hasDevice = true;
    if (!_ready) { _warmup++; if (_warmup >= WARMUP) { _sA=_rA; _sB=_rB; _sG=_rG; _ready=true; } }
  }

  function _onMouse(e) {
    var w = window.innerWidth, h = window.innerHeight;
    _mx = (e.clientX / w - 0.5) * 2;   /* -1 ~ +1 */
    _my = (e.clientY / h - 0.5) * 2;
  }

  /* 环形 lerp (0/360 边界) */
  function _la(c, t) {
    var d = t - c;
    if (d > 180) d -= 360; if (d < -180) d += 360;
    var r = c + d * K;
    if (r < 0) r += 360; if (r >= 360) r -= 360;
    return r;
  }

  /* ======== 主循环 ======== */
  function _loop() {
    if (_ready) {
      _sA = _la(_sA, _rA);
      _sB += (_rB - _sB) * K;
      _sG += (_rG - _sG) * K;
      for (var i = 0; i < _cbs.length; i++) _cbs[i](_sA, _sB, _sG);
    } else if (_mouseActive) {
      /* 桌面: 鼠标映射为伪姿态 */
      var fakeA = 180, fakeB = 60 + _my * 25, fakeG = _mx * 30;
      _sA += (fakeA - _sA) * K;
      _sB += (fakeB - _sB) * K;
      _sG += (fakeG - _sG) * K;
      for (var j = 0; j < _cbs.length; j++) _cbs[j](_sA, _sB, _sG);
    }
    _rafId = requestAnimationFrame(_loop);
  }

  /* ======== 公开 ======== */
  function start() {
    if (_active) return Promise.resolve(true);

    return reqPerm().then(function(ok) {
      if (!ok && !isSupported()) {
        /* 纯桌面: 启用鼠标降级 */
        _mouseActive = true;
        _ready = false;
        window.addEventListener('mousemove', _onMouse);
        _rafId = requestAnimationFrame(_loop);
        _active = true;
        return true;
      }
      if (!ok) return false;

      _ready = false; _warmup = 0; _hasDevice = false;
      _useAbs = false;
      if ('ondeviceorientationabsolute' in window) {
        window.addEventListener('deviceorientationabsolute', _onDev, true);
        _useAbs = true;
      }
      window.addEventListener('deviceorientation', _onDev, true);
      _rafId = requestAnimationFrame(_loop);
      _active = true;

      /* 500ms 后如果没收到设备事件, 切换到鼠标降级 */
      setTimeout(function() {
        if (_active && !_hasDevice && !_ready) {
          _mouseActive = true;
          window.addEventListener('mousemove', _onMouse);
        }
      }, 500);

      return true;
    });
  }

  function stop() {
    if (!_active) return;
    if (_useAbs) window.removeEventListener('deviceorientationabsolute', _onDev, true);
    window.removeEventListener('deviceorientation', _onDev, true);
    window.removeEventListener('mousemove', _onMouse);
    if (_rafId) cancelAnimationFrame(_rafId);
    _active = false; _ready = false; _mouseActive = false;
    _hasDevice = false;
  }

  function on(fn) { if (typeof fn === 'function') _cbs.push(fn); }
  function off(fn) { _cbs = _cbs.filter(function(f){ return f !== fn; }); }

  window.Gyro = {
    isSupported: isSupported,
    needsPermission: needsPerm,
    requestPermission: reqPerm,
    start: start, stop: stop, on: on, off: off,
    get active() { return _active; },
    get hasDevice() { return _hasDevice; }
  };
})();
