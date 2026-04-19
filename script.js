"use strict";

const PERF_KEYS = {
  tier: "sonexa.perfTier.v1",
  override: "sonexa.perfOverride.v1",
  bench: "sonexa.perfBench.v1",
};

const PERF_TIERS = ["low", "mid", "high"];
const PERF_BENCH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function safeGetItem(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function safeSetItem(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (err) {
  }
}

function safeRemoveItem(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (err) {
  }
}

function normalizeTier(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  const tier = value.toLowerCase().trim();
  return PERF_TIERS.includes(tier) ? tier : null;
}

function tierRank(tier) {
  return PERF_TIERS.indexOf(tier);
}

function lowerTier(a, b) {
  if (!normalizeTier(a)) {
    return normalizeTier(b) || "low";
  }
  if (!normalizeTier(b)) {
    return normalizeTier(a) || "low";
  }
  return tierRank(a) <= tierRank(b) ? a : b;
}

function readTierFromQuery() {
  try {
    const params = new URLSearchParams(window.location.search);
    const queryPerf = params.get("perf");

    if (queryPerf === "auto") {
      safeRemoveItem(PERF_KEYS.override);
      return null;
    }

    const tier = normalizeTier(queryPerf);
    if (tier) {
      safeSetItem(PERF_KEYS.override, tier);
      return tier;
    }
  } catch (err) {
  }

  return null;
}

function readBenchTier() {
  const raw = safeGetItem(PERF_KEYS.bench);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    const tier = normalizeTier(parsed.tier);
    const ts = Number(parsed.ts);
    const probeMs = Number(parsed.probeMs);

    if (!tier || !Number.isFinite(ts)) {
      return null;
    }
    if (Date.now() - ts > PERF_BENCH_MAX_AGE_MS) {
      return null;
    }

    return {
      tier,
      probeMs: Number.isFinite(probeMs) ? probeMs : null,
      ts,
    };
  } catch (err) {
    return null;
  }
}

function writeBenchTier(tier, probeMs) {
  const normalizedTier = normalizeTier(tier);
  if (!normalizedTier) {
    return;
  }

  const payload = {
    tier: normalizedTier,
    probeMs: Number.isFinite(probeMs) ? probeMs : null,
    ts: Date.now(),
  };
  safeSetItem(PERF_KEYS.bench, JSON.stringify(payload));
}

function detectHintTier() {
  const prefersReducedMotion =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) {
    return "low";
  }

  const ua = navigator.userAgent || "";
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const cores = Number(navigator.hardwareConcurrency) || (mobile ? 4 : 8);
  const memory = Number(navigator.deviceMemory) || (mobile ? 4 : 8);
  const connection =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = !!(connection && connection.saveData);
  const effectiveType =
    connection && typeof connection.effectiveType === "string"
      ? connection.effectiveType
      : "";

  if (saveData || effectiveType.includes("2g")) {
    return "low";
  }
  if (cores <= 2 || memory <= 2) {
    return "low";
  }
  if (mobile && (cores <= 4 || memory <= 4 || window.innerWidth < 430)) {
    return "low";
  }
  if (cores <= 4 || memory <= 4 || window.innerWidth < 980) {
    return "mid";
  }

  return "high";
}

function runCpuProbeMs() {
  const iterations = 140000;
  const startedAt = performance.now();
  let acc = 0;

  for (let i = 1; i <= iterations; i++) {
    acc += Math.sqrt((i * 13) % 997);
  }

  if (acc === Number.MIN_VALUE) {
    return 0;
  }

  return performance.now() - startedAt;
}

function tierFromCpuProbe(ms) {
  if (!Number.isFinite(ms)) {
    return "mid";
  }
  if (ms > 44) {
    return "low";
  }
  if (ms > 24) {
    return "mid";
  }
  return "high";
}

function resolvePerfProfile() {
  const queryTier = readTierFromQuery();
  const overrideTier = normalizeTier(queryTier || safeGetItem(PERF_KEYS.override));

  if (overrideTier) {
    safeSetItem(PERF_KEYS.tier, overrideTier);
    return { mode: "manual", tier: overrideTier };
  }

  const hintTier = detectHintTier();
  let tier = hintTier;
  const bench = readBenchTier();

  if (bench) {
    tier = lowerTier(tier, bench.tier);
  } else if (hintTier !== "low") {
    const probeMs = runCpuProbeMs();
    const probeTier = tierFromCpuProbe(probeMs);
    tier = lowerTier(tier, probeTier);
    writeBenchTier(probeTier, probeMs);
  } else {
    writeBenchTier("low", null);
  }

  safeSetItem(PERF_KEYS.tier, tier);
  return { mode: "auto", tier };
}

function getPerfConfig(tier) {
  if (tier === "high") {
    return {
      antialias: true,
      powerPreference: "high-performance",
      renderScale: 1,
      pixelRatioCap: 2,
      shaderQuality: 1,
      postQuality: 1,
      ultraLow: false,
      usePost: true,
      useLenis: true,
      useGsap: true,
      frameCap: 0,
      vizBars: 38,
    };
  }

  if (tier === "mid") {
    return {
      antialias: false,
      powerPreference: "high-performance",
      renderScale: 0.72,
      pixelRatioCap: 1.25,
      shaderQuality: 0.45,
      postQuality: 0.35,
      ultraLow: false,
      usePost: true,
      useLenis: true,
      useGsap: true,
      frameCap: 1000 / 30,
      vizBars: 26,
    };
  }

  return {
    antialias: false,
    powerPreference: "low-power",
    renderScale: 0.34,
    pixelRatioCap: 1,
    shaderQuality: 0,
    postQuality: 0,
    ultraLow: true,
    usePost: false,
    useLenis: false,
    useGsap: false,
    frameCap: 1000 / 20,
    vizBars: 14,
  };
}

function applyTierAttribute(tier) {
  document.documentElement.setAttribute("data-perf", tier);
  safeSetItem(PERF_KEYS.tier, tier);
}

const perfProfile = resolvePerfProfile();
let activeTier = perfProfile.tier;
let perfConfig = getPerfConfig(activeTier);
applyTierAttribute(activeTier);

window.sonexaPerf = {
  get tier() {
    return activeTier;
  },
  get mode() {
    return perfProfile.mode;
  },
  setTier(tier) {
    const normalized = normalizeTier(tier);
    if (!normalized) {
      return;
    }
    safeSetItem(PERF_KEYS.override, normalized);
    window.location.reload();
  },
  setAuto() {
    safeRemoveItem(PERF_KEYS.override);
    window.location.reload();
  },
};

let isLegalPage = false;
let lenis = null;

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener("click", function (e) {
    e.preventDefault();
    const target = this.getAttribute("href");
    const targetNode = target ? document.querySelector(target) : null;
    if (!targetNode) {
      return;
    }

    if (lenis) {
      lenis.scrollTo(target);
      return;
    }

    targetNode.scrollIntoView({ behavior: "smooth" });
  });
});

function fillMarquee(el, items) {
  if (!el) {
    return;
  }

  const doubled = [...items, ...items, ...items, ...items];
  doubled.forEach((txt) => {
    const span = document.createElement("span");
    span.className = "marquee-item";
    span.innerHTML = txt + '<span class="marquee-dot"></span>';
    el.appendChild(span);
  });
}

fillMarquee(document.getElementById("mq1"), [
  "Local Library",
  "Offline First",
  "Precision EQ",
  "Modular System",
  "Lightweight",
  "No Ads",
  "Full Control",
  "Custom Playback",
  "Privacy Focused",
  "Gapless Playback",
]);
fillMarquee(document.getElementById("mq2"), [
  "Android",
  "Offline Ready",
  "Low Data Usage",
  "Custom Modules",
  "High Performance",
  "Minimal UI",
  "Background Playback",
  "Smart Caching",
  "User Controlled",
  "Open Source",
]);

const viz = document.getElementById("visualizer");
function buildVisualizerBars(count) {
  if (!viz) {
    return;
  }

  viz.innerHTML = "";
  for (let i = 0; i < count; i++) {
    const bar = document.createElement("div");
    bar.className = "viz-bar";
    bar.style.setProperty("--maxh", 10 + Math.random() * 60 + "px");
    bar.style.setProperty("--dur", 0.4 + Math.random() * 0.9 + "s");
    bar.style.setProperty("--delay", Math.random() * -1.5 + "s");
    viz.appendChild(bar);
  }
}
buildVisualizerBars(perfConfig.vizBars);

const canvas = document.getElementById("webgl");
const hasThree = typeof window.THREE !== "undefined";

let renderer = null;
let sScene = null;
let pScene = null;
let cam = null;
let sU = null;
let pU = null;
let RT = null;
let tF = 0;
let tTo = 1;
let tClock = 0;

function applyLowFallback() {
  activeTier = "low";
  perfConfig = getPerfConfig("low");
  applyTierAttribute("low");
  buildVisualizerBars(perfConfig.vizBars);
  if (canvas) {
    canvas.style.display = "none";
  }
}

function rtWidth() {
  return Math.max(1, Math.floor(window.innerWidth * perfConfig.renderScale));
}

function rtHeight() {
  return Math.max(1, Math.floor(window.innerHeight * perfConfig.renderScale));
}

function recreateRenderTarget() {
  if (!renderer || !pU) {
    return;
  }

  if (RT) {
    RT.dispose();
  }
  RT = new THREE.WebGLRenderTarget(rtWidth(), rtHeight(), {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    depthBuffer: false,
    stencilBuffer: false,
  });
  pU.u_texture.value = RT.texture;
}

function applyRendererQuality() {
  if (!renderer) {
    return;
  }

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio || 1, perfConfig.pixelRatioCap)
  );
  renderer.setSize(
    window.innerWidth * perfConfig.renderScale,
    window.innerHeight * perfConfig.renderScale,
    false
  );
  if (canvas) {
    canvas.style.width = "100%";
    canvas.style.height = "100%";
  }

  if (sU) {
    sU.u_quality.value = perfConfig.shaderQuality;
    sU.u_ultraLow.value = perfConfig.ultraLow ? 1 : 0;
    sU.u_resolution.value.set(window.innerWidth, window.innerHeight);
  }
  if (pU) {
    pU.u_quality.value = perfConfig.postQuality;
    pU.u_resolution.value.set(window.innerWidth, window.innerHeight);
  }
  recreateRenderTarget();
}

function setThemeSlot(slot, palette) {
  if (!sU) {
    return;
  }
  sU["u_deep" + slot].value.copy(palette.deep);
  sU["u_mid" + slot].value.copy(palette.mid);
  sU["u_bright" + slot].value.copy(palette.bright);
  sU["u_tint" + slot + "1"].value.copy(palette.tint1);
  sU["u_tint" + slot + "2"].value.copy(palette.tint2);
}

function initWebgl() {
  if (!canvas || !hasThree) {
    return;
  }

  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: perfConfig.antialias,
      alpha: false,
      powerPreference: perfConfig.powerPreference,
    });
  } catch (err) {
    renderer = null;
  }

  if (!renderer) {
    applyLowFallback();
    return;
  }

  renderer.setClearColor(new THREE.Color(0.9, 0.92, 0.95), 1);

  sScene = new THREE.Scene();
  pScene = new THREE.Scene();
  cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  sU = {
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_quality: { value: perfConfig.shaderQuality },
    u_ultraLow: { value: perfConfig.ultraLow ? 1 : 0 },
    u_themeMix: { value: 0 },
    u_deepA: { value: new THREE.Vector3() },
    u_midA: { value: new THREE.Vector3() },
    u_brightA: { value: new THREE.Vector3() },
    u_tintA1: { value: new THREE.Vector3() },
    u_tintA2: { value: new THREE.Vector3() },
    u_deepB: { value: new THREE.Vector3() },
    u_midB: { value: new THREE.Vector3() },
    u_brightB: { value: new THREE.Vector3() },
    u_tintB1: { value: new THREE.Vector3() },
    u_tintB2: { value: new THREE.Vector3() },
  };

  const TP = [
    {
      deep: new THREE.Vector3(0.67, 0.72, 0.79),
      mid: new THREE.Vector3(0.86, 0.9, 0.95),
      bright: new THREE.Vector3(0.985, 0.99, 1),
      tint1: new THREE.Vector3(0.88, 0.97, 1),
      tint2: new THREE.Vector3(1, 0.93, 0.98),
    },
    {
      deep: new THREE.Vector3(0.52, 0.56, 0.62),
      mid: new THREE.Vector3(0.8, 0.84, 0.9),
      bright: new THREE.Vector3(0.98, 0.985, 0.995),
      tint1: new THREE.Vector3(0.92, 0.95, 1),
      tint2: new THREE.Vector3(0.98, 0.98, 1),
    },
    {
      deep: new THREE.Vector3(0.44, 0.47, 0.53),
      mid: new THREE.Vector3(0.72, 0.76, 0.82),
      bright: new THREE.Vector3(0.95, 0.965, 0.99),
      tint1: new THREE.Vector3(0.84, 0.89, 0.98),
      tint2: new THREE.Vector3(0.95, 0.96, 1),
    },
    {
      deep: new THREE.Vector3(0.6, 0.66, 0.72),
      mid: new THREE.Vector3(0.87, 0.91, 0.95),
      bright: new THREE.Vector3(0.99, 0.99, 1),
      tint1: new THREE.Vector3(0.84, 0.98, 0.96),
      tint2: new THREE.Vector3(0.99, 0.9, 0.98),
    },
  ];

  setThemeSlot("A", TP[0]);
  setThemeSlot("B", TP[1]);

  const vsh = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`;
  const silkFsh = `precision highp float;uniform float u_time,u_quality,u_ultraLow,u_themeMix;uniform vec2 u_resolution;uniform vec3 u_deepA,u_midA,u_brightA,u_tintA1,u_tintA2,u_deepB,u_midB,u_brightB,u_tintB1,u_tintB2;varying vec2 vUv;float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}float fbmH(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.7,1.2,-1.2,1.7);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p+.13;a*=.55;}return v;}float fbmL(vec2 p){float v=0.,a=.55;mat2 m=mat2(1.45,1.05,-1.05,1.45);for(int i=0;i<3;i++){v+=a*noise(p);p=m*p+.12;a*=.58;}return v;}float fbmU(vec2 p){float v=0.,a=.58;mat2 m=mat2(1.3,.9,-.9,1.3);for(int i=0;i<2;i++){v+=a*noise(p);p=m*p+.11;a*=.6;}return v;}float fbmQ(vec2 p){if(u_ultraLow>.5)return fbmU(p);if(u_quality>.5)return fbmH(p);return fbmL(p);}float cloth(vec2 uv,float t){vec2 asp=vec2(u_resolution.x/u_resolution.y,1.),p=(uv-.5)*asp;mat2 rot=mat2(.8138,-.5812,.5812,.8138);vec2 q=rot*p;if(u_ultraLow>.5)return clamp(.52+sin(q.y*12.+q.x*1.15+t*.62)*.18+sin(q.y*21.5-q.x*1.9+t*.98)*.11,0.,1.);vec2 dr=vec2(t*.14,-t*.09),w=vec2(fbmQ(q*1.7+dr),fbmQ(q*1.35-dr.yx+2.4))-.5;q+=vec2(w.x*.22,w.y*.34);float lf=sin(q.y*12.+q.x*1.15+t*.62),mf=sin(q.y*21.5-q.x*1.9+t*.98),ff=sin(q.y*34.+q.x*3.2+t*1.32),ri=pow(abs(sin(q.y*17.5+q.x*1.35+t*1.05)),1.45),mc=fbmQ(q*10.+t*.18)-.5;return clamp(.52+lf*.18+mf*.11+ff*.06+(ri-.5)*.19+mc*.045,0.,1.);}void main(){vec2 uv=vUv;float t=u_time;vec2 asp=vec2(u_resolution.x/u_resolution.y,1.);float px=1.25/min(u_resolution.x,u_resolution.y);vec2 dc=(uv-.5)*asp;float dl=length(dc);vec2 uvP=uv;float ring=0.;if(u_ultraLow<.5){float pT=mod(t,5.6),pD=.72,gate=smoothstep(0.,.07,pT)*(1.-smoothstep(pD-.09,pD,pT));ring=exp(-pow(dl*7.2-pT/pD*6.2,2.)*32.)*gate;uvP=uv+normalize(dc+vec2(.0001,0))*ring*mix(.004,.01,u_quality);}float h=cloth(uvP,t),hx=cloth(uvP+vec2(px,0),t),hy=cloth(uvP+vec2(0,px),t);vec3 N=normalize(vec3((h-hx)*mix(6.8,9.2,u_quality),(h-hy)*mix(6.8,9.2,u_quality),1.));vec3 kL=normalize(vec3(-.36,.54,1.1)),fL=normalize(vec3(.52,-.18,1.)),vD=vec3(0,0,1);float dK=max(dot(N,kL),0.),dF=max(dot(N,fL),0.),sK=pow(max(dot(N,normalize(kL+vD)),0.),mix(82.,128.,u_quality)),sF=pow(max(dot(N,normalize(fL+vD)),0.),mix(136.,220.,u_quality)),fres=pow(1.-max(dot(N,vD),0.),3.2);vec3 deep=mix(u_deepA,u_deepB,u_themeMix),mid=mix(u_midA,u_midB,u_themeMix),bright=mix(u_brightA,u_brightB,u_themeMix),t1=mix(u_tintA1,u_tintB1,u_themeMix),t2=mix(u_tintA2,u_tintB2,u_themeMix);vec3 col=mix(deep,mid,smoothstep(.16,.86,h));col=mix(col,bright,smoothstep(.63,1.04,h+dK*.35));float fM=smoothstep(.44,.98,h)*pow(1.-max(dot(N,vD),0.),1.15);if(u_ultraLow<.5)col+=mix(t2,t1,.5+.5*cos(vec3(0,2.1,4.2)+h*15.+dot(N.xy,vec2(4.,-3.2))+t*.35))*fM*mix(.05,.11,u_quality);if(u_ultraLow<.5){vec2 rA=clamp(uv+N.xy*mix(.018,.034,u_quality),0.,1.);float rHA=cloth(rA,t+.02);col=mix(col,mix(deep*1.02,bright,smoothstep(.2,.84,rHA)),mix(.14,.24,u_quality));}float shafts=0.;if(u_ultraLow<.5){float sA=exp(-pow(uv.x*.72+uv.y*1.02-(.22+sin(t*.06)*.03),2.)*120.),sB=exp(-pow(uv.x*.58+uv.y*1.12-(.74+cos(t*.05)*.028),2.)*140.);shafts=(sA*.85+sB*.65)*smoothstep(1.06,.02,uv.y)*smoothstep(1.25,.25,dl);}col+=mix(t2,t1,.45)*shafts*(.08+dK*.11);float trough=1.-smoothstep(.36,.7,h),ridgeV=smoothstep(.62,1.,h);col-=vec3(.12,.13,.16)*trough*.58;col+=vec3(1.)*ridgeV*.06;vec2 q2=mat2(.8138,-.5812,.5812,.8138)*(uv-.5)*asp;float sp=pow(max(sin(q2.y*44.+q2.x*7.5+t*1.35)*.5+.5,0.),14.),sw=(exp(-pow(uv.y+uv.x*.42-mod(t*.18,1.42)+.18,2.)*240.)*.75+exp(-pow(uv.y+uv.x*.42-mod(t*.13+.58,1.42)+.18,2.)*180.)*.55)*(.45+smoothstep(.58,.98,h+dK*.24)*.55);col+=vec3(1.)*sK*.48+vec3(.95,.98,1.)*sF*.32+vec3(1.)*sw*.16+vec3(.98,1.,1.)*fres*.2+vec3(1.)*sp*.065+vec3(.95,.99,1.)*ring*.22+dF*.04;col*=.86+smoothstep(1.22,.25,dl)*.14;col=max(col,vec3(0));gl_FragColor=vec4(col,1.);}`;
  const postFsh = `precision highp float;uniform sampler2D u_texture;uniform float u_time,u_quality;uniform vec2 u_resolution;varying vec2 vUv;float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec2 uv=vUv,px=1./u_resolution;vec2 ca=px*mix(.7,1.6,u_quality);vec3 col;col.r=texture2D(u_texture,uv+ca*vec2(1.,.35)).r;col.g=texture2D(u_texture,uv).g;col.b=texture2D(u_texture,uv-ca*vec2(1.,.35)).b;vec3 bL=(texture2D(u_texture,uv+px*vec2(2,0)).rgb+texture2D(u_texture,uv-px*vec2(2,0)).rgb+texture2D(u_texture,uv+px*vec2(0,2)).rgb+texture2D(u_texture,uv-px*vec2(0,2)).rgb)*.25;col+=max(bL-vec3(.72),0.)*mix(.22,.36,u_quality);col+=(hash(uv*u_resolution+fract(u_time*57.))-.5)*mix(.008,.016,u_quality);col=aces(col);col*=.94+smoothstep(1.18,.22,length((uv-.5)*vec2(u_resolution.x/u_resolution.y,1.)))*.1;gl_FragColor=vec4(col,1.);}`;

  sScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: sU,
        vertexShader: vsh,
        fragmentShader: silkFsh,
      })
    )
  );

  pU = {
    u_texture: { value: null },
    u_time: { value: 0 },
    u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    u_quality: { value: perfConfig.postQuality },
  };

  pScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: pU,
        vertexShader: vsh,
        fragmentShader: postFsh,
      })
    )
  );

  applyRendererQuality();

  canvas.addEventListener(
    "webglcontextlost",
    (evt) => {
      evt.preventDefault();
      applyLowFallback();
    },
    false
  );

  canvas.addEventListener(
    "webglcontextrestored",
    () => {
      window.location.reload();
    },
    false
  );

  initWebgl.themePalettes = TP;
}

const logo = document.getElementById("travelling-logo");
const footerAnchor = document.getElementById("footer-logo-anchor");
let logoScrollRawP = 0;
let logoInFooterPhase = false;

if (logo) {
  logo.style.animation = "none";
}

let bigW = 320;
let smallW = 110;
let bigTop = window.innerHeight * 0.5;
let smallTop = 70;

function initSizes() {
  if (!logo) {
    return;
  }

  if (window.innerWidth <= 600) {
    logo.style.width = "";
    bigW = logo.getBoundingClientRect().width || window.innerWidth * 0.7;
  } else {
    bigW = Math.min(window.innerWidth * 0.58, 430);
  }

  smallW = 110;
  bigTop = window.innerHeight * 0.5;
  smallTop = 70;
}

function eio(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

const TRAV = () => window.innerHeight * 0.38;

function updateLogo() {
  if (!logo || isLegalPage) {
    return;
  }

  const sy = window.scrollY;
  const vh = window.innerHeight;
  const rawP = Math.min(sy / TRAV(), 1);
  const p = eio(rawP);

  logoScrollRawP = rawP;

  if (!footerAnchor) {
    logoInFooterPhase = false;
    logo.style.width = bigW + (smallW - bigW) * p + "px";
    logo.style.top = bigTop + (smallTop - bigTop) * p + "px";
    logo.style.left = "50%";
    return;
  }

  const fRect = footerAnchor.getBoundingClientRect();
  const maxScroll = document.body.scrollHeight - vh;
  const distFromBot = Math.max(0, maxScroll - sy);
  const footerRawP = Math.max(0, Math.min(1, 1 - distFromBot / (vh * 0.55)));
  const fp = eio(footerRawP);

  if (footerRawP > 0) {
    logoInFooterPhase = true;

    const targetCX = fRect.left + fRect.width / 2;
    const targetCY = fRect.top + fRect.height / 2;
    const targetW = fRect.width || smallW;
    const isMobile = window.innerWidth <= 600;
    const boostStrength = isMobile ? 0.05 : 0.08;
    const boost = 1 + boostStrength * Math.pow(fp, 2);
    const wBase = smallW + (targetW - smallW) * fp;
    const cx = window.innerWidth / 2 + (targetCX - window.innerWidth / 2) * fp;
    const cy = smallTop + (targetCY - smallTop) * fp;
    const sizeDiff = targetW - wBase;
    const cyOffset = isMobile ? -(sizeDiff * 0.15) : 0;

    logo.style.width = wBase + "px";
    logo.style.left = cx + "px";
    logo.style.top = cy + cyOffset + "px";
    logo.style.transform = "translate(-50%, -50%) scale(" + boost + ")";
  } else {
    logoInFooterPhase = false;

    logo.style.width = bigW + (smallW - bigW) * p + "px";
    logo.style.top = bigTop + (smallTop - bigTop) * p + "px";
    logo.style.left = "50%";
  }
}

function revealStaticStates() {
  const selectors = [
    ".manifesto-headline .line",
    ".manifesto-body",
    ".feature-line",
    ".sound-headline .word",
    ".sound-stat",
    ".strip-item",
    ".quote-text",
    ".quote-source",
    ".platform-headline",
    ".platform-sub",
    ".platform-list",
  ];

  document.querySelectorAll(selectors.join(",")).forEach((el) => {
    el.style.opacity = "1";
    el.style.transform = "none";
  });
}

function initGsapScrollAnimations() {
  gsap.utils.toArray(".manifesto-headline .line").forEach((line, i) => {
    gsap.to(line, {
      y: 0,
      opacity: 1,
      duration: 1.1,
      ease: "expo.out",
      delay: i * 0.12,
      scrollTrigger: {
        trigger: ".manifesto",
        start: "top 70%",
        once: true,
      },
    });
  });

  gsap.to(".manifesto-body", {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "power3.out",
    delay: 0.35,
    scrollTrigger: {
      trigger: ".manifesto",
      start: "top 60%",
      once: true,
    },
  });

  gsap.utils.toArray(".feature-line").forEach((line, i) => {
    gsap.to(line, {
      opacity: 1,
      x: 0,
      duration: 0.7,
      ease: "power3.out",
      delay: i * 0.04,
      scrollTrigger: {
        trigger: line,
        start: "top 88%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".sound-headline .word").forEach((word, i) => {
    gsap.to(word, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "expo.out",
      delay: i * 0.14,
      scrollTrigger: {
        trigger: "#sec-sound",
        start: "top 65%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".sound-stat").forEach((stat, i) => {
    gsap.to(stat, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: "power3.out",
      delay: 0.3 + i * 0.1,
      scrollTrigger: {
        trigger: "#sec-sound",
        start: "top 55%",
        once: true,
      },
    });
  });

  gsap.utils.toArray(".strip-item").forEach((item, i) => {
    gsap.to(item, {
      opacity: 1,
      y: 0,
      duration: 0.75,
      ease: "power3.out",
      delay: i * 0.1,
      scrollTrigger: {
        trigger: "#sec-strip",
        start: "top 80%",
        once: true,
      },
    });
  });

  gsap.to("#qt", {
    opacity: 1,
    y: 0,
    duration: 1.1,
    ease: "expo.out",
    scrollTrigger: {
      trigger: "#sec-quote",
      start: "top 65%",
      once: true,
    },
  });

  gsap.to("#qs", {
    opacity: 1,
    duration: 0.9,
    ease: "power2.out",
    delay: 0.45,
    scrollTrigger: {
      trigger: "#sec-quote",
      start: "top 65%",
      once: true,
    },
  });

  gsap.to("#ph", {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: "expo.out",
    scrollTrigger: {
      trigger: "#sec-platform",
      start: "top 70%",
      once: true,
    },
  });

  gsap.to("#ps", {
    opacity: 1,
    y: 0,
    duration: 0.9,
    ease: "power3.out",
    delay: 0.2,
    scrollTrigger: {
      trigger: "#sec-platform",
      start: "top 65%",
      once: true,
    },
  });

  gsap.to("#pl", {
    opacity: 1,
    duration: 0.8,
    ease: "power2.out",
    delay: 0.4,
    scrollTrigger: {
      trigger: "#sec-platform",
      start: "top 60%",
      once: true,
    },
  });
}

const hasGSAP =
  typeof window.gsap !== "undefined" &&
  typeof window.ScrollTrigger !== "undefined";

if (hasGSAP && perfConfig.useGsap) {
  gsap.registerPlugin(ScrollTrigger);

  if (perfConfig.useLenis && typeof window.Lenis !== "undefined") {
    lenis = new Lenis({
      lerp: activeTier === "mid" ? 0.12 : 0.095,
      smoothWheel: true,
    });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => {
      if (lenis) {
        lenis.raf(time * 1000);
      }
    });
    gsap.ticker.lagSmoothing(0);
  }

  initGsapScrollAnimations();
} else {
  revealStaticStates();
}

initSizes();
updateLogo();

window.addEventListener("scroll", updateLogo, { passive: true });
if (lenis) {
  lenis.on("scroll", updateLogo);
}

initWebgl();

window.addEventListener("resize", () => {
  applyRendererQuality();
  initSizes();
  updateLogo();
});

let elapsed = 0;
let prevT = performance.now();
let lastFrameAt = 0;
const frameCapMs = perfConfig.frameCap;

function animate(now) {
  const dt = Math.min((now - prevT) * 0.001, 0.033);
  prevT = now;
  elapsed += dt;

  if (logo && !isLegalPage && !logoInFooterPhase) {
    const floatAmt = Math.max(0, 1 - Math.min(logoScrollRawP / 0.05, 1));
    const floatY =
      activeTier === "low"
        ? 0
        : Math.sin(elapsed * (2 * Math.PI / 5.5)) * 16 * floatAmt;
    logo.style.transform = "translate(-50%, -50%) translateY(" + floatY + "px)";
  }

  if (!renderer || !sU || !pU || !RT || !sScene || !pScene || !cam) {
    return;
  }

  const TP = initWebgl.themePalettes || [];
  tClock += dt;
  const tm = tClock > 9 ? Math.min((tClock - 9) / 3.2, 1) : 0;
  sU.u_themeMix.value = tm;

  if (tm >= 1 && TP.length > 0) {
    tF = tTo;
    tTo = (tTo + 1) % TP.length;
    setThemeSlot("A", TP[tF]);
    setThemeSlot("B", TP[tTo]);
    tClock = 0;
    sU.u_themeMix.value = 0;
  }

  sU.u_time.value = elapsed * (activeTier === "high" ? 1.08 : 0.95);
  pU.u_time.value = elapsed;

  renderer.setRenderTarget(RT);
  renderer.render(sScene, cam);

  renderer.setRenderTarget(null);
  if (perfConfig.usePost && !perfConfig.ultraLow) {
    renderer.render(pScene, cam);
  } else {
    renderer.render(sScene, cam);
  }
}

function loop(now) {
  requestAnimationFrame(loop);

  if (frameCapMs > 0 && now - lastFrameAt < frameCapMs) {
    return;
  }

  lastFrameAt = now;
  animate(now);
}
requestAnimationFrame(loop);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    prevT = performance.now();
  }
});

document.addEventListener("dragstart", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());

function showLegal(type) {
  let file = "";
  let title = "";

  if (type === "privacy") {
    file = "assets/privacy-policy.md";
    title = "Privacy Policy";
  } else if (type === "tos") {
    file = "assets/tos.md";
    title = "Terms of Service";
  } else if (type === "policy") {
    file = "assets/sonexa-policy.md";
    title = "Sonexa Policy";
  }

  isLegalPage = true;

  document.querySelectorAll("section, .marquee-section").forEach((el) => {
    if (el.id !== "legal-page") {
      el.style.display = "none";
    }
  });

  const legal = document.getElementById("legal-page");
  if (legal) {
    legal.style.display = "block";
  }

  const titleNode = document.getElementById("legal-title");
  if (titleNode) {
    titleNode.textContent = title;
  }

  fetch(file)
    .then((res) => res.text())
    .then((md) => {
      const contentNode = document.getElementById("legal-content");
      if (!contentNode) {
        return;
      }

      if (typeof window.marked !== "undefined" && typeof marked.parse === "function") {
        contentNode.innerHTML = marked.parse(md);
      } else {
        contentNode.textContent = md;
      }
    })
    .catch(() => {
      const contentNode = document.getElementById("legal-content");
      if (contentNode) {
        contentNode.textContent = "Unable to load this document right now.";
      }
    });

  if (logo) {
    logo.style.width = smallW + "px";
    logo.style.top = smallTop + "px";
    logo.style.transform = "translate(-50%, -50%)";
  }

  if (lenis) {
    lenis.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo(0, 0);
  }
}

window.showLegal = showLegal;
