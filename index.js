const X = 0;
const Y = 1;
const Z = 2;
const SPEED = 3;

const { max, min, PI, sin, cos} = Math;

const canvas = document.querySelector("canvas");
const gl = canvas.getContext("webgl", { antialias: false });

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

resize();

window.addEventListener('resize', resize);

const keys = {};

window.addEventListener('keydown', event => keys[event.code] = true);
window.addEventListener('keyup', event => keys[event.code] = false);

gl.viewport(0, 0, canvas.width, canvas.height);

const program = gl.createProgram();

{
  const vertexShaderText =
  `precision highp float;
  attribute vec2 aPosition;

  void main(){
      gl_Position = vec4(aPosition, 1.0, 1.0);
  }`;

  const vertexShaderObj = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShaderObj, vertexShaderText);
  gl.compileShader(vertexShaderObj);
  gl.attachShader(program, vertexShaderObj);
};

{
  const fragmentShaderText = 
  `
  precision highp float;
  uniform float Time;
  uniform vec2 Resolution;
  uniform vec2 CameraLockAt;
  uniform vec4 CameraPosition;

  vec3 RGB(float t) {
    return vec3(-1.+3.*abs(mod(t*2.+vec3(0,4./3.,2./3.),2.)-1.));
  }

  void main(){
    float aspectRatio = Resolution.x / Resolution.y;
    vec3 uv = vec3((gl_FragCoord.xy / Resolution.xy - 0.5) * vec2(aspectRatio, 1), 1.0);

    float w = uv.z * cos(CameraLockAt.y) + uv.y * sin(CameraLockAt.y);

    vec3 rayDir = normalize(
      vec3(
        uv.x * cos(CameraLockAt.x) + w    * sin(CameraLockAt.x),
        uv.y * cos(CameraLockAt.y) - uv.z * sin(CameraLockAt.y),
        w    * cos(CameraLockAt.x) - uv.x * sin(CameraLockAt.x)
      )
    );

    vec3 ray = vec3(CameraPosition.xyz);

    for(int i = 0; i < 700; i++) {
      float square = max(abs(ray.x), abs(ray.z));
      float box = max(square, abs(ray.y))-0.5;
      float sdBox = sign(-box+ 0.0001);
      vec3 boxColor = vec3(1.0, 0.0, 0.0);

      float sphere = length(ray-vec3( 1.0 * sin(Time * 0.1) * 2.5, 0.0, 1.0 * cos(Time * 0.1) * 2.5))-0.5;

      float sdSphere = sign(-sphere+ 0.0001);
      vec3 sphereColor = vec3(1.0, 0.1, 1.0);

      float surface = abs(ray.y + 0.5);
      float sdSurface = sign(-surface+ 0.0001);
      float depth = length(ray - CameraPosition.xyz);
      //float radiusColor = 0.5 + 0.5 * sin( min(sphere, box) * 45.5+1.0*8.0) * (1.05 / depth*2.0);
      float radiusColor = length(box);
      vec3 surfaceColor = vec3(clamp(RGB(radiusColor), 0.0, 1.0));

      float scene = min(min(surface, box), sphere);

      vec3 color = vec3(max(
        sdSphere * sphereColor,
        max(sdBox * boxColor, sdSurface * surfaceColor)
      ));

      if(scene < 0.0002) {
        gl_FragColor = vec4( color , 1.0);
        break;
      } else {
        float depth = length(ray - CameraPosition.xyz);
        if(depth > 50.0) {
          gl_FragColor = vec4(0.0, 0.9, 1.0, 1.0);
          break;
        }
      };
      ray += rayDir * scene;
      gl_FragColor = vec4(0.0, 0.9, 1.0, 1.0);
    };
  }`;

  const fragmentShaderObj = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShaderObj, fragmentShaderText);
  gl.compileShader(fragmentShaderObj);
  gl.attachShader(program, fragmentShaderObj);    
};

gl.linkProgram(program);
gl.useProgram(program);

const vertexBuffer = gl.createBuffer();

gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  //(R, G, B),     (X, Y)
  1.0, 0.0, 0.0, -1.0, -1.0,
  0.0, 1.0, 0.0, -1.0, +3.0,
  0.0, 0.0, 1.0, +3.0, -1.0,
]), gl.STATIC_DRAW);

const vertexSize = (3 + 2) * Float32Array.BYTES_PER_ELEMENT;

// const aColor = gl.getAttribLocation(program, 'aColor');
// gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, vertexSize, 0 * Float32Array.BYTES_PER_ELEMENT);
// gl.enableVertexAttribArray(aColor);

const aPosition = gl.getAttribLocation(program, 'aPosition');
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, vertexSize, 3 * Float32Array.BYTES_PER_ELEMENT);
gl.enableVertexAttribArray(aPosition);

const Resolution = gl.getUniformLocation(program, 'Resolution');
gl.uniform2fv(Resolution, [canvas.width, canvas.height]);

const canvasObserver = new ResizeObserver(() => {
  console.log("Resice")
  const Resolution = gl.getUniformLocation(program, 'Resolution');
  gl.uniform2fv(Resolution, [canvas.width, canvas.height]);
});

canvasObserver.observe(canvas);

const perf = performance;

const CameraPosition = new Float32Array([0, 0, -3, 0.01]);
const CameraPositionUnif = gl.getUniformLocation(program, 'CameraPosition');
gl.uniform4fv(CameraPositionUnif, CameraPosition);

const CameraLockAt = new Float32Array([0, 0]);
const CameraLockAtUnif = gl.getUniformLocation(program, 'CameraLockAt');
gl.uniform2fv(CameraLockAtUnif, CameraLockAt);

const Time = gl.getUniformLocation(program, 'Time');
gl.uniform1f(Time, 0.0);

canvas.addEventListener("click", canvas.requestPointerLock);

canvas.addEventListener('mousemove', event => {
  if (document.pointerLockElement) {
    const sensi = (PI/2) / 1000;
    CameraLockAt[X] += event.movementX * sensi;
    CameraLockAt[Y] += event.movementY * sensi;

    CameraLockAt[Y] = min(max(CameraLockAt[1], -PI / 2), PI / 2);
    gl.uniform2fv(CameraLockAtUnif, CameraLockAt);
  };
});

const pre = document.querySelector('pre');

const loop = () => {

  const LockAtX = sin(CameraLockAt[X]);
  const LockAtZ = cos(CameraLockAt[X]);

  pre.textContent = `${CameraLockAt[X]}\n${CameraLockAt[Y]}`;

  if (keys.KeyW) {
    CameraPosition[X] += LockAtX * CameraPosition[SPEED];
    CameraPosition[Z] += LockAtZ * CameraPosition[SPEED];
  };

  if (keys.KeyS) {
    CameraPosition[X] -= LockAtX * CameraPosition[SPEED];
    CameraPosition[Z] -= LockAtZ * CameraPosition[SPEED];
  };

  if (keys.KeyD) {
    CameraPosition[X] += LockAtZ * CameraPosition[SPEED];
    CameraPosition[Z] -= LockAtX * CameraPosition[SPEED];
  };

  if (keys.KeyA) {
    CameraPosition[X] -= LockAtZ * CameraPosition[SPEED];
    CameraPosition[Z] += LockAtX * CameraPosition[SPEED];
  };

  if (keys.Space) {
    CameraPosition[Y] += CameraPosition[SPEED]
  };

  if (keys.ShiftLeft) {
    CameraPosition[Y] -= CameraPosition[SPEED]
  };

  gl.uniform1f(Time, perf.now() / 1000);
  gl.uniform4fv(CameraPositionUnif, CameraPosition);

  gl.drawArrays(gl.TRIANGLES, 0, 3);
  requestAnimationFrame(loop);
};

loop();
