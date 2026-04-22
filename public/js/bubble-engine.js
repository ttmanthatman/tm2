/**
 * TeamChat CSS 3D 气泡引擎
 * 将姿态数据转换为 CSS 自定义属性，由浏览器 GPU 合成器渲染
 *
 * 写入的 CSS 变量 (挂在 :root):
 *   --b3-rx        rotateX 角度 (deg)     俯仰倾斜
 *   --b3-ry        rotateY 角度 (deg)     横滚倾斜
 *   --b3-shadow-x  投影 X 偏移 (px)       光的反方向
 *   --b3-shadow-y  投影 Y 偏移 (px)
 *   --b3-light     亮度系数 (0.85~1.15)   面向光时亮、背光时暗
 *   --b3-spec-x    高光 X 位置 (%)
 *   --b3-spec-y    高光 Y 位置 (%)
 *
 * 依赖: Gyro (gyro.js)
 *
 * API:
 *   BubbleEngine.start(intensity)  — intensity: 0~100, 控制效果强度
 *   BubbleEngine.stop()
 */
(function() {
  'use strict';

  var _active = false, _sub = null;
  var _baseA = null;
  var _intensity = 0.6;  /* 0~1 */
  var D2R = Math.PI / 180;
  var root = null;

  function _onGyro(alpha, beta, gamma) {
    if (!root) root = document.documentElement.style;
    if (_baseA === null) _baseA = alpha;

    /* 罗盘偏移 */
    var ad = alpha - _baseA;
    if (ad > 180) ad -= 360; if (ad < -180) ad += 360;

    var bRad = beta * D2R;
    var gRad = gamma * D2R;
    var aRad = ad * D2R;

    /* 屏幕空间光向量 (sin/cos 天然无上限) */
    var rawLx = Math.sin(gRad);
    var rawLy = -Math.cos(bRad);
    var ca = Math.cos(aRad), sa = Math.sin(aRad);
    var lx = rawLx * ca + rawLy * sa;
    var ly = -rawLx * sa + rawLy * ca;

    var t = _intensity;

    /* ---- CSS 变量输出 ---- */

    /* 透视倾斜: 气泡跟随手机微微倾斜 */
    var rx = (ly * 4 * t).toFixed(2);    /* 最多 ±4~6° */
    var ry = (-lx * 5 * t).toFixed(2);

    /* 阴影: 光的反方向 */
    var sx = (-lx * 6 * t).toFixed(1);
    var sy = (-ly * 8 * t).toFixed(1);

    /* 亮度: 面向光源稍亮，背光稍暗 */
    var light = (1.0 + ly * 0.12 * t).toFixed(3);

    /* 高光位置 */
    var specX = (50 + lx * 40 * t).toFixed(1);
    var specY = (35 + ly * 30 * t).toFixed(1);

    root.setProperty('--b3-rx', rx + 'deg');
    root.setProperty('--b3-ry', ry + 'deg');
    root.setProperty('--b3-shadow-x', sx + 'px');
    root.setProperty('--b3-shadow-y', sy + 'px');
    root.setProperty('--b3-light', light);
    root.setProperty('--b3-spec-x', specX + '%');
    root.setProperty('--b3-spec-y', specY + '%');
  }

  function start(intensity) {
    if (_active) return;
    _intensity = Math.max(0, Math.min(1, (intensity || 60) / 100));
    _baseA = null;
    _sub = _onGyro;
    if (window.Gyro) { Gyro.on(_sub); Gyro.start(); }
    _active = true;
  }

  function stop() {
    if (!_active) return;
    if (window.Gyro && _sub) Gyro.off(_sub);
    _sub = null; _active = false; _baseA = null;
    /* 重置变量 */
    if (root) {
      root.setProperty('--b3-rx', '0deg');
      root.setProperty('--b3-ry', '0deg');
      root.setProperty('--b3-shadow-x', '0px');
      root.setProperty('--b3-shadow-y', '4px');
      root.setProperty('--b3-light', '1');
      root.setProperty('--b3-spec-x', '30%');
      root.setProperty('--b3-spec-y', '20%');
    }
  }

  window.BubbleEngine = { start: start, stop: stop, get active() { return _active; } };
})();
