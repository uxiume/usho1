(function () {
  "use strict";

  var canvas = null;
  var dispose = null;
  var storageKey = "usho-ripple";
  var assetBase = document.currentScript ? new URL(".", document.currentScript.src).href : "./assets/";

  function enabled() {
    return localStorage.getItem(storageKey) !== "off";
  }

  function shader(gl, type, source) {
    var value = gl.createShader(type);
    if (!value) throw new Error("shader");
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(value) || "shader");
    return value;
  }

  function program(gl, vertex, fragment, uniforms) {
    var value = gl.createProgram();
    var vertexShader = shader(gl, gl.VERTEX_SHADER, vertex);
    var fragmentShader = shader(gl, gl.FRAGMENT_SHADER, fragment);
    if (!value) throw new Error("program");
    gl.attachShader(value, vertexShader);
    gl.attachShader(value, fragmentShader);
    gl.linkProgram(value);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(value) || "program");
    return {
      id: value,
      position: gl.getAttribLocation(value, "aPosition"),
      uniforms: Object.fromEntries(uniforms.map(function (name) { return [name, gl.getUniformLocation(value, name)]; }))
    };
  }

  function simulationType(gl) {
    var candidates = [];
    var half = gl.getExtension("OES_texture_half_float");
    if (gl.getExtension("OES_texture_float")) candidates.push(gl.FLOAT);
    if (half) candidates.push(half.HALF_FLOAT_OES);
    var texture = gl.createTexture();
    var framebuffer = gl.createFramebuffer();
    if (!texture || !framebuffer) return null;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    var type = candidates.find(function (candidate) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, candidate, null);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    }) || null;
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return type;
  }

  function start() {
    if (canvas || !enabled() || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    canvas = document.createElement("canvas");
    canvas.className = "water-field-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    document.documentElement.dataset.waterRipple = "webgl";

    var gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false, stencil: false });
    if (!gl) return stop();
    var textureType = simulationType(gl);
    if (!textureType) return stop();

    var vertex = "attribute vec2 aPosition;varying vec2 vUv;void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}";
    var dropFragment = "precision highp float;const float PI=3.141592653589793;uniform sampler2D uRipple;uniform vec2 uCenter;uniform float uRadius;uniform float uStrength;varying vec2 vUv;void main(){vec4 info=texture2D(uRipple,vUv);vec2 center=uCenter*.5+.5;float drop=max(0.,1.-length(vUv-center)/uRadius);drop=.5-cos(drop*PI)*.5;info.r+=drop*uStrength;gl_FragColor=info;}";
    var updateFragment = "precision highp float;uniform sampler2D uRipple;uniform vec2 uDelta;varying vec2 vUv;void main(){vec4 info=texture2D(uRipple,vUv);vec2 dx=vec2(uDelta.x,0.);vec2 dy=vec2(0.,uDelta.y);float average=(texture2D(uRipple,vUv-dx).r+texture2D(uRipple,vUv+dx).r+texture2D(uRipple,vUv-dy).r+texture2D(uRipple,vUv+dy).r)*.25;info.g+=(average-info.r)*2.;info.g*=.995;info.r+=info.g;gl_FragColor=info;}";
    var renderFragment = "precision highp float;uniform sampler2D uRipple;uniform sampler2D uBackground;uniform vec2 uDelta;uniform vec2 uContainerRatio;uniform vec3 uHighlight;uniform float uWaveOpacity;varying vec2 vUv;void main(){vec2 centered=vUv*2.-1.;vec2 rc=centered*uContainerRatio*.5+.5;vec2 bc=vec2(vUv.x,1.-vUv.y);float h=texture2D(uRipple,rc).r;float hx=texture2D(uRipple,vec2(rc.x+uDelta.x,rc.y)).r;float hy=texture2D(uRipple,vec2(rc.x,rc.y+uDelta.y)).r;vec3 dx=vec3(uDelta.x,hx-h,0.);vec3 dy=vec3(0.,hy-h,uDelta.y);vec2 offset=-normalize(cross(dy,dx)).xz;vec4 pattern=texture2D(uBackground,clamp(bc+offset*.03,vec2(.001),vec2(.999)));float wave=smoothstep(.001,.075,abs(h)+length(vec2(hx-h,hy-h))*12.);float specular=pow(max(0.,dot(offset,normalize(vec2(-.6,1.)))),4.)*wave;gl_FragColor=vec4(pattern.rgb+uHighlight*specular*uWaveOpacity,pattern.a);}";

    var dropProgram;
    var updateProgram;
    var renderProgram;
    try {
      dropProgram = program(gl, vertex, dropFragment, ["uRipple", "uCenter", "uRadius", "uStrength"]);
      updateProgram = program(gl, vertex, updateFragment, ["uRipple", "uDelta"]);
      renderProgram = program(gl, vertex, renderFragment, ["uRipple", "uBackground", "uDelta", "uContainerRatio", "uHighlight", "uWaveOpacity"]);
    } catch {
      return stop();
    }

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.clearColor(0, 0, 0, 0);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var simSize = 256;
    var targets = [];
    var read = 0;
    var write = 1;
    var width = 1;
    var height = 1;
    var frame = 0;
    var lastX = -1000;
    var lastY = -1000;
    var lastTime = 0;
    var patternReady = false;
    var patternDirty = true;
    var patternTexture = gl.createTexture();
    var patternCanvas = document.createElement("canvas");
    var patternContext = patternCanvas.getContext("2d");
    var maskCanvas = document.createElement("canvas");
    var maskContext = maskCanvas.getContext("2d");
    var patternImage = new Image();

    gl.bindTexture(gl.TEXTURE_2D, patternTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([5, 9, 13, 255]));

    function target() {
      var texture = gl.createTexture();
      var framebuffer = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, simSize, simSize, 0, gl.RGBA, textureType, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      return { texture: texture, framebuffer: framebuffer };
    }

    function deleteTargets() {
      targets.forEach(function (item) { gl.deleteTexture(item.texture); gl.deleteFramebuffer(item.framebuffer); });
      targets = [];
    }

    function draw(info) {
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.vertexAttribPointer(info.position, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(info.position);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    function resize() {
      var dpr = Math.min(2, devicePixelRatio || 1);
      width = Math.max(1, innerWidth);
      height = Math.max(1, innerHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      deleteTargets();
      targets = [target(), target()];
      read = 0;
      write = 1;
      patternDirty = true;
    }

    function uploadPattern() {
      if (!patternReady || !patternContext || !maskContext) return false;
      if (!patternDirty) return true;
      var dark = document.documentElement.dataset.theme !== "light";
      var scale = Math.min(2, 4096 / Math.max(width, height));
      var textureWidth = Math.max(1, Math.round(width * scale));
      var textureHeight = Math.max(1, Math.round(height * scale));
      patternCanvas.width = maskCanvas.width = textureWidth;
      patternCanvas.height = maskCanvas.height = textureHeight;
      var gradient = patternContext.createLinearGradient(0, 0, textureWidth, textureHeight);
      gradient.addColorStop(0, dark ? "#071019" : "#f7f3ec");
      gradient.addColorStop(.5, dark ? "#081926" : "#eaf7f4");
      gradient.addColorStop(1, dark ? "#05070d" : "#f5eddf");
      patternContext.fillStyle = gradient;
      patternContext.fillRect(0, 0, textureWidth, textureHeight);
      maskContext.clearRect(0, 0, textureWidth, textureHeight);
      var tileWidth = Math.max(92, 356 * textureWidth / Math.max(1, width));
      var tileHeight = Math.max(190, 732 * textureHeight / Math.max(1, height));
      for (var y = -tileHeight; y < textureHeight + tileHeight; y += tileHeight) {
        for (var x = -tileWidth; x < textureWidth + tileWidth; x += tileWidth) maskContext.drawImage(patternImage, x, y, tileWidth, tileHeight);
      }
      maskContext.globalCompositeOperation = "source-in";
      maskContext.fillStyle = dark ? "#69d8e7" : "#1d6c86";
      maskContext.fillRect(0, 0, textureWidth, textureHeight);
      maskContext.globalCompositeOperation = "source-over";
      patternContext.globalAlpha = dark ? .58 : .72;
      patternContext.drawImage(maskCanvas, 0, 0);
      patternContext.globalAlpha = 1;
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, patternCanvas);
      patternDirty = false;
      return true;
    }

    function update() {
      gl.viewport(0, 0, simSize, simSize);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[write].framebuffer);
      gl.useProgram(updateProgram.id);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[read].texture);
      gl.uniform1i(updateProgram.uniforms.uRipple, 0);
      gl.uniform2f(updateProgram.uniforms.uDelta, 1 / simSize, 1 / simSize);
      draw(updateProgram);
      read = 1 - read;
      write = 1 - write;
    }

    function render() {
      if (!uploadPattern()) return;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.enable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(renderProgram.id);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[read].texture);
      gl.uniform1i(renderProgram.uniforms.uRipple, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, patternTexture);
      gl.uniform1i(renderProgram.uniforms.uBackground, 1);
      gl.uniform2f(renderProgram.uniforms.uDelta, 1 / simSize, 1 / simSize);
      gl.uniform2f(renderProgram.uniforms.uContainerRatio, width / Math.max(width, height), height / Math.max(width, height));
      gl.uniform3f(renderProgram.uniforms.uHighlight, document.documentElement.dataset.theme === "light" ? 0 : .91, document.documentElement.dataset.theme === "light" ? .5 : .99, 1);
      gl.uniform1f(renderProgram.uniforms.uWaveOpacity, document.documentElement.dataset.theme === "light" ? .26 : .3);
      draw(renderProgram);
      gl.disable(gl.BLEND);
    }

    function loop() {
      frame = 0;
      if (!canvas || !enabled()) return;
      update();
      render();
      frame = requestAnimationFrame(loop);
    }

    function drop(x, y, radius, strength) {
      if (targets.length !== 2) return;
      gl.viewport(0, 0, simSize, simSize);
      gl.bindFramebuffer(gl.FRAMEBUFFER, targets[write].framebuffer);
      gl.useProgram(dropProgram.id);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, targets[read].texture);
      var longest = Math.max(width, height);
      gl.uniform1i(dropProgram.uniforms.uRipple, 0);
      gl.uniform2f(dropProgram.uniforms.uCenter, (2 * x - width) / longest, (height - 2 * y) / longest);
      gl.uniform1f(dropProgram.uniforms.uRadius, radius / longest);
      gl.uniform1f(dropProgram.uniforms.uStrength, strength);
      draw(dropProgram);
      read = 1 - read;
      write = 1 - write;
    }

    function pointerMove(event) {
      if (event.pointerType === "touch") return;
      var now = performance.now();
      var distance = Math.hypot(event.clientX - lastX, event.clientY - lastY);
      if (now - lastTime < 16 || distance < 8) return;
      drop(event.clientX, event.clientY, 20, .01);
      lastX = event.clientX;
      lastY = event.clientY;
      lastTime = now;
    }

    function pointerDown(event) {
      drop(event.clientX, event.clientY, 30, .14);
    }

    var observer = new MutationObserver(function () { patternDirty = true; });
    patternImage.onload = function () { patternReady = true; patternDirty = true; };
    patternImage.src = assetBase + "tg-pattern.svg";
    resize();
    addEventListener("resize", resize);
    addEventListener("pointermove", pointerMove, { passive: true });
    addEventListener("pointerdown", pointerDown, { passive: true });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    frame = requestAnimationFrame(loop);

    dispose = function () {
      cancelAnimationFrame(frame);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", pointerMove);
      removeEventListener("pointerdown", pointerDown);
      observer.disconnect();
      deleteTargets();
      canvas.remove();
      canvas = null;
      dispose = null;
      delete document.documentElement.dataset.waterRipple;
    };
  }

  function stop() {
    if (dispose) dispose();
    else if (canvas) {
      canvas.remove();
      canvas = null;
      delete document.documentElement.dataset.waterRipple;
    }
  }

  function sync() {
    if (enabled()) start();
    else stop();
  }

  addEventListener("usho:ripple-change", sync);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", sync, { once: true });
  else sync();
})();
