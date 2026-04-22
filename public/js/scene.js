/**
 * TeamChat 3D 背景引擎
 * Three.js 渲染层，叠加在聊天背景之上、消息之下
 *
 * 依赖: THREE (CDN r128), Gyro (gyro.js)
 *
 * API:
 *   Scene3D.init(container)     — 创建 canvas + 启动渲染
 *   Scene3D.setTheme(name)      — 'starfield' | 'aurora' | 'none'
 *   Scene3D.destroy()           — 清理
 */
(function() {
  'use strict';

  var _canvas, _renderer, _camera, _scene, _clock;
  var _container = null;
  var _rafId = null;
  var _theme = 'none';
  var _objs = [];           /* 当前主题的可清理对象 */
  var _gyroSub = null;
  var _camTarget = { x: 0, y: 0, z: 0 };  /* 目标旋转 */
  var _baseAlpha = null;
  var D2R = Math.PI / 180;

  /* ======== 初始化 ======== */
  function init(container) {
    if (!window.THREE) { console.warn('Scene3D: THREE.js not loaded'); return; }
    if (_renderer) return;  /* 已初始化 */

    _container = container || document.querySelector('.messages-wrapper');
    if (!_container) return;

    _canvas = document.createElement('canvas');
    _canvas.className = 'scene3d-canvas';
    _canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;';
    _container.insertBefore(_canvas, _container.firstChild);

    var w = _container.clientWidth, h = _container.clientHeight;

    _renderer = new THREE.WebGLRenderer({ canvas: _canvas, alpha: true, antialias: false });
    _renderer.setSize(w, h);
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    _camera = new THREE.PerspectiveCamera(60, w / h, 1, 2000);
    _camera.position.z = 500;

    _scene = new THREE.Scene();
    _clock = new THREE.Clock();

    /* 监听姿态 */
    _gyroSub = function(a, b, g) {
      if (_baseAlpha === null) _baseAlpha = a;
      var ad = a - _baseAlpha;
      if (ad > 180) ad -= 360; if (ad < -180) ad += 360;
      _camTarget.y = -ad * D2R * 0.3;
      _camTarget.x = -(b - 60) * D2R * 0.15;
      _camTarget.z = g * D2R * 0.08;
    };
    if (window.Gyro) Gyro.on(_gyroSub);

    window.addEventListener('resize', _onResize);
    _loop();
  }

  /* ======== 渲染循环 ======== */
  function _loop() {
    _rafId = requestAnimationFrame(_loop);
    if (!_renderer) return;

    var dt = _clock.getDelta();

    /* 平滑跟随目标旋转 */
    _camera.rotation.x += (_camTarget.x - _camera.rotation.x) * 0.06;
    _camera.rotation.y += (_camTarget.y - _camera.rotation.y) * 0.06;
    _camera.rotation.z += (_camTarget.z - _camera.rotation.z) * 0.04;

    /* 主题动画 */
    if (_theme === 'starfield') _animStarfield(dt);
    else if (_theme === 'aurora') _animAurora(dt);

    _renderer.render(_scene, _camera);
  }

  function _onResize() {
    if (!_container || !_renderer) return;
    var w = _container.clientWidth, h = _container.clientHeight;
    _renderer.setSize(w, h);
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
  }

  /* ======== 主题: 星空 ======== */
  var _starPoints, _starTime = 0;

  function _buildStarfield() {
    _clearTheme();
    var N = 4000;
    var pos = new Float32Array(N * 3);
    var colors = new Float32Array(N * 3);
    var sizes = new Float32Array(N);

    for (var i = 0; i < N; i++) {
      /* 均匀分布在球壳内 */
      var r = 200 + Math.random() * 800;
      var theta = Math.random() * Math.PI * 2;
      var phi = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
      pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i*3+2] = r * Math.cos(phi);

      /* 随机淡蓝/白/淡紫色调 */
      var t = Math.random();
      colors[i*3]   = 0.7 + t * 0.3;       /* R */
      colors[i*3+1] = 0.75 + t * 0.25;     /* G */
      colors[i*3+2] = 0.9 + t * 0.1;       /* B */

      sizes[i] = 1.5 + Math.random() * 3;
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    /* 圆形粒子纹理 (程序生成) */
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var cx = cv.getContext('2d');
    var grad = cx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = grad;
    cx.fillRect(0, 0, 64, 64);
    var tex = new THREE.CanvasTexture(cv);

    var mat = new THREE.PointsMaterial({
      size: 3,
      map: tex,
      vertexColors: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });

    _starPoints = new THREE.Points(geo, mat);
    _scene.add(_starPoints);
    _objs.push(_starPoints, geo, mat, tex);
    _starTime = 0;
  }

  function _animStarfield(dt) {
    if (!_starPoints) return;
    _starTime += dt;
    /* 极慢自转 */
    _starPoints.rotation.y = _starTime * 0.02;
    _starPoints.rotation.x = Math.sin(_starTime * 0.01) * 0.05;
    /* 呼吸: 整体透明度微波动 */
    _starPoints.material.opacity = 0.55 + Math.sin(_starTime * 0.5) * 0.15;
  }

  /* ======== 主题: 极光 ======== */
  var _auroraGroup, _auroraTime = 0;

  function _buildAurora() {
    _clearTheme();
    _auroraGroup = new THREE.Group();
    _scene.add(_auroraGroup);
    _objs.push(_auroraGroup);

    /* 多层半透明色带 */
    var layers = [
      { color: 0x00ff88, y: 100, width: 800, opacity: 0.15 },
      { color: 0x4488ff, y: 140, width: 700, opacity: 0.12 },
      { color: 0xaa44ff, y: 60,  width: 900, opacity: 0.10 },
    ];

    for (var k = 0; k < layers.length; k++) {
      var L = layers[k];
      var segs = 80;
      var geo = new THREE.PlaneGeometry(L.width, 200, segs, 1);
      var mat = new THREE.MeshBasicMaterial({
        color: L.color, transparent: true, opacity: L.opacity,
        side: THREE.DoubleSide, depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      var mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, L.y, -300);
      mesh.userData = { baseY: L.y, segs: segs, phase: k * 1.2 };
      _auroraGroup.add(mesh);
      _objs.push(geo, mat);
    }

    /* 小粒子做萤火点缀 */
    var N = 800;
    var pp = new Float32Array(N * 3);
    for (var i = 0; i < N; i++) {
      pp[i*3]   = (Math.random() - 0.5) * 1200;
      pp[i*3+1] = Math.random() * 300 - 50;
      pp[i*3+2] = (Math.random() - 0.5) * 600 - 200;
    }
    var pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    var pm = new THREE.PointsMaterial({
      size: 2, color: 0x88ffcc, transparent: true, opacity: 0.5,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    var pts = new THREE.Points(pg, pm);
    _auroraGroup.add(pts);
    _objs.push(pg, pm);

    _auroraTime = 0;
  }

  function _animAurora(dt) {
    if (!_auroraGroup) return;
    _auroraTime += dt;

    /* 波动极光色带 */
    _auroraGroup.children.forEach(function(child) {
      if (child.geometry && child.userData.segs) {
        var posArr = child.geometry.attributes.position.array;
        var segs = child.userData.segs + 1;
        var ph = child.userData.phase;
        for (var i = 0; i < segs; i++) {
          var frac = i / (segs - 1);
          /* 上排顶点 (每段 2 个顶点: 上/下) */
          var idx = i * 2 * 3 + 1; /* y of top vertex */
          posArr[idx] = 100 + Math.sin(_auroraTime * 0.4 + frac * 6 + ph) * 40
                            + Math.sin(_auroraTime * 0.7 + frac * 3) * 20;
        }
        child.geometry.attributes.position.needsUpdate = true;
      }
    });
  }

  /* ======== 清理 ======== */
  function _clearTheme() {
    for (var i = 0; i < _objs.length; i++) {
      var o = _objs[i];
      if (o.parent) o.parent.remove(o);
      if (o.dispose) o.dispose();
    }
    _objs = [];
    _starPoints = null;
    _auroraGroup = null;
  }

  /* ======== 公开 ======== */
  function setTheme(name) {
    _theme = name || 'none';
    if (_theme === 'starfield') _buildStarfield();
    else if (_theme === 'aurora') _buildAurora();
    else _clearTheme();
  }

  function destroy() {
    _clearTheme();
    if (_gyroSub && window.Gyro) Gyro.off(_gyroSub);
    _gyroSub = null;
    window.removeEventListener('resize', _onResize);
    if (_rafId) cancelAnimationFrame(_rafId);
    if (_renderer) { _renderer.dispose(); _renderer = null; }
    if (_canvas && _canvas.parentNode) _canvas.parentNode.removeChild(_canvas);
    _canvas = null; _camera = null; _scene = null; _container = null;
    _theme = 'none'; _baseAlpha = null;
  }

  window.Scene3D = {
    init: init,
    setTheme: setTheme,
    destroy: destroy,
    get theme() { return _theme; }
  };
})();
