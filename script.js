let isLegalPage = false;
document.querySelectorAll('a[href^="#"]').forEach(anchor => { anchor.addEventListener("click", function (e) { e.preventDefault(); const target = this.getAttribute("href"); if (lenis) { lenis.scrollTo(target); } else { document.querySelector(target).scrollIntoView(); } }); });
function fillMarquee(el, items) { const d = [...items, ...items, ...items, ...items]; d.forEach(t => { const s = document.createElement('span'); s.className = 'marquee-item'; s.innerHTML = t + '<span class="marquee-dot"></span>'; el.appendChild(s) }) }
fillMarquee(document.getElementById('mq1'), ['Local Library', 'Offline First', 'Precision EQ', 'Modular System', 'Lightweight', 'No Ads', 'Full Control', 'Custom Playback', 'Privacy Focused', 'Gapless Playback'])
fillMarquee(document.getElementById('mq2'), ['Android', 'Offline Ready', 'Low Data Usage', 'Custom Modules', 'High Performance', 'Minimal UI', 'Background Playback', 'Smart Caching', 'User Controlled', 'Open Source'])

const viz = document.getElementById('visualizer')
for (let i = 0; i < 38; i++) { const b = document.createElement('div'); b.className = 'viz-bar'; b.style.setProperty('--maxh', (10 + Math.random() * 60) + 'px'); b.style.setProperty('--dur', (0.4 + Math.random() * 0.9) + 's'); b.style.setProperty('--delay', (Math.random() * -1.5) + 's'); viz.appendChild(b) }

const canvas = document.getElementById('webgl')
const isLP = window.matchMedia('(prefers-reduced-motion: reduce)').matches || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || window.innerWidth < 900 || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4)
const isUL = isLP && ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2) || window.innerWidth < 430)
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isUL, alpha: false, powerPreference: 'high-performance' })
const Q = isLP ? 0.0 : 1.0
function applyR() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, Q > .5 ? 2 : isUL ? 1 : 1.25)) }
applyR()
const rs = Q > .5 ? 1 : isUL ? .25 : .65
renderer.setSize(window.innerWidth * rs, window.innerHeight * rs, false)
canvas.style.width = '100%'; canvas.style.height = '100%'
renderer.setClearColor(new THREE.Color(.9, .92, .95), 1)
const sScene = new THREE.Scene(), pScene = new THREE.Scene(), cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
const sU = { u_time: { value: 0 }, u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, u_quality: { value: Q }, u_ultraLow: { value: isUL ? 1 : 0 }, u_themeMix: { value: 0 }, u_deepA: { value: new THREE.Vector3() }, u_midA: { value: new THREE.Vector3() }, u_brightA: { value: new THREE.Vector3() }, u_tintA1: { value: new THREE.Vector3() }, u_tintA2: { value: new THREE.Vector3() }, u_deepB: { value: new THREE.Vector3() }, u_midB: { value: new THREE.Vector3() }, u_brightB: { value: new THREE.Vector3() }, u_tintB1: { value: new THREE.Vector3() }, u_tintB2: { value: new THREE.Vector3() } }
const TP = [{ deep: new THREE.Vector3(.67, .72, .79), mid: new THREE.Vector3(.86, .9, .95), bright: new THREE.Vector3(.985, .99, 1), tint1: new THREE.Vector3(.88, .97, 1), tint2: new THREE.Vector3(1, .93, .98) }, { deep: new THREE.Vector3(.52, .56, .62), mid: new THREE.Vector3(.8, .84, .9), bright: new THREE.Vector3(.98, .985, .995), tint1: new THREE.Vector3(.92, .95, 1), tint2: new THREE.Vector3(.98, .98, 1) }, { deep: new THREE.Vector3(.44, .47, .53), mid: new THREE.Vector3(.72, .76, .82), bright: new THREE.Vector3(.95, .965, .99), tint1: new THREE.Vector3(.84, .89, .98), tint2: new THREE.Vector3(.95, .96, 1) }, { deep: new THREE.Vector3(.6, .66, .72), mid: new THREE.Vector3(.87, .91, .95), bright: new THREE.Vector3(.99, .99, 1), tint1: new THREE.Vector3(.84, .98, .96), tint2: new THREE.Vector3(.99, .9, .98) }]
let tF = 0, tTo = 1, tClock = 0
function setTS(sl, p) { sU[`u_deep${sl}`].value.copy(p.deep); sU[`u_mid${sl}`].value.copy(p.mid); sU[`u_bright${sl}`].value.copy(p.bright); sU[`u_tint${sl}1`].value.copy(p.tint1); sU[`u_tint${sl}2`].value.copy(p.tint2) }
setTS('A', TP[0]); setTS('B', TP[1])
const vsh = `varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position,1.0);}`
const silkFsh = `precision highp float;uniform float u_time,u_quality,u_ultraLow,u_themeMix;uniform vec2 u_resolution;uniform vec3 u_deepA,u_midA,u_brightA,u_tintA1,u_tintA2,u_deepB,u_midB,u_brightB,u_tintB1,u_tintB2;varying vec2 vUv;float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}float noise(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}float fbmH(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.7,1.2,-1.2,1.7);for(int i=0;i<5;i++){v+=a*noise(p);p=m*p+.13;a*=.55;}return v;}float fbmL(vec2 p){float v=0.,a=.55;mat2 m=mat2(1.45,1.05,-1.05,1.45);for(int i=0;i<3;i++){v+=a*noise(p);p=m*p+.12;a*=.58;}return v;}float fbmU(vec2 p){float v=0.,a=.58;mat2 m=mat2(1.3,.9,-.9,1.3);for(int i=0;i<2;i++){v+=a*noise(p);p=m*p+.11;a*=.6;}return v;}float fbmQ(vec2 p){if(u_ultraLow>.5)return fbmU(p);if(u_quality>.5)return fbmH(p);return fbmL(p);}float cloth(vec2 uv,float t){vec2 asp=vec2(u_resolution.x/u_resolution.y,1.),p=(uv-.5)*asp;mat2 rot=mat2(.8138,-.5812,.5812,.8138);vec2 q=rot*p;if(u_ultraLow>.5)return clamp(.52+sin(q.y*12.+q.x*1.15+t*.62)*.18+sin(q.y*21.5-q.x*1.9+t*.98)*.11,0.,1.);vec2 dr=vec2(t*.14,-t*.09),w=vec2(fbmQ(q*1.7+dr),fbmQ(q*1.35-dr.yx+2.4))-.5;q+=vec2(w.x*.22,w.y*.34);float lf=sin(q.y*12.+q.x*1.15+t*.62),mf=sin(q.y*21.5-q.x*1.9+t*.98),ff=sin(q.y*34.+q.x*3.2+t*1.32),ri=pow(abs(sin(q.y*17.5+q.x*1.35+t*1.05)),1.45),mc=fbmQ(q*10.+t*.18)-.5;return clamp(.52+lf*.18+mf*.11+ff*.06+(ri-.5)*.19+mc*.045,0.,1.);}void main(){vec2 uv=vUv;float t=u_time;vec2 asp=vec2(u_resolution.x/u_resolution.y,1.);float px=1.25/min(u_resolution.x,u_resolution.y);vec2 dc=(uv-.5)*asp;float dl=length(dc);vec2 uvP=uv;float ring=0.;if(u_ultraLow<.5){float pT=mod(t,5.6),pD=.72,gate=smoothstep(0.,.07,pT)*(1.-smoothstep(pD-.09,pD,pT));ring=exp(-pow(dl*7.2-pT/pD*6.2,2.)*32.)*gate;uvP=uv+normalize(dc+vec2(.0001,0))*ring*mix(.004,.01,u_quality);}float h=cloth(uvP,t),hx=cloth(uvP+vec2(px,0),t),hy=cloth(uvP+vec2(0,px),t);vec3 N=normalize(vec3((h-hx)*mix(6.8,9.2,u_quality),(h-hy)*mix(6.8,9.2,u_quality),1.));vec3 kL=normalize(vec3(-.36,.54,1.1)),fL=normalize(vec3(.52,-.18,1.)),vD=vec3(0,0,1);float dK=max(dot(N,kL),0.),dF=max(dot(N,fL),0.),sK=pow(max(dot(N,normalize(kL+vD)),0.),mix(82.,128.,u_quality)),sF=pow(max(dot(N,normalize(fL+vD)),0.),mix(136.,220.,u_quality)),fres=pow(1.-max(dot(N,vD),0.),3.2);vec3 deep=mix(u_deepA,u_deepB,u_themeMix),mid=mix(u_midA,u_midB,u_themeMix),bright=mix(u_brightA,u_brightB,u_themeMix),t1=mix(u_tintA1,u_tintB1,u_themeMix),t2=mix(u_tintA2,u_tintB2,u_themeMix);vec3 col=mix(deep,mid,smoothstep(.16,.86,h));col=mix(col,bright,smoothstep(.63,1.04,h+dK*.35));float fM=smoothstep(.44,.98,h)*pow(1.-max(dot(N,vD),0.),1.15);if(u_ultraLow<.5)col+=mix(t2,t1,.5+.5*cos(vec3(0,2.1,4.2)+h*15.+dot(N.xy,vec2(4.,-3.2))+t*.35))*fM*mix(.05,.11,u_quality);if(u_ultraLow<.5){vec2 rA=clamp(uv+N.xy*mix(.018,.034,u_quality),0.,1.);float rHA=cloth(rA,t+.02);col=mix(col,mix(deep*1.02,bright,smoothstep(.2,.84,rHA)),mix(.14,.24,u_quality));}float shafts=0.;if(u_ultraLow<.5){float sA=exp(-pow(uv.x*.72+uv.y*1.02-(.22+sin(t*.06)*.03),2.)*120.),sB=exp(-pow(uv.x*.58+uv.y*1.12-(.74+cos(t*.05)*.028),2.)*140.);shafts=(sA*.85+sB*.65)*smoothstep(1.06,.02,uv.y)*smoothstep(1.25,.25,dl);}col+=mix(t2,t1,.45)*shafts*(.08+dK*.11);float trough=1.-smoothstep(.36,.7,h),ridgeV=smoothstep(.62,1.,h);col-=vec3(.12,.13,.16)*trough*.58;col+=vec3(1.)*ridgeV*.06;vec2 q2=mat2(.8138,-.5812,.5812,.8138)*(uv-.5)*asp;float sp=pow(max(sin(q2.y*44.+q2.x*7.5+t*1.35)*.5+.5,0.),14.),sw=(exp(-pow(uv.y+uv.x*.42-mod(t*.18,1.42)+.18,2.)*240.)*.75+exp(-pow(uv.y+uv.x*.42-mod(t*.13+.58,1.42)+.18,2.)*180.)*.55)*(.45+smoothstep(.58,.98,h+dK*.24)*.55);col+=vec3(1.)*sK*.48+vec3(.95,.98,1.)*sF*.32+vec3(1.)*sw*.16+vec3(.98,1.,1.)*fres*.2+vec3(1.)*sp*.065+vec3(.95,.99,1.)*ring*.22+dF*.04;col*=.86+smoothstep(1.22,.25,dl)*.14;col=max(col,vec3(0));gl_FragColor=vec4(col,1.);}`
const postFsh = `precision highp float;uniform sampler2D u_texture;uniform float u_time,u_quality;uniform vec2 u_resolution;varying vec2 vUv;float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}void main(){vec2 uv=vUv,px=1./u_resolution;vec2 ca=px*mix(.7,1.6,u_quality);vec3 col;col.r=texture2D(u_texture,uv+ca*vec2(1.,.35)).r;col.g=texture2D(u_texture,uv).g;col.b=texture2D(u_texture,uv-ca*vec2(1.,.35)).b;vec3 bL=(texture2D(u_texture,uv+px*vec2(2,0)).rgb+texture2D(u_texture,uv-px*vec2(2,0)).rgb+texture2D(u_texture,uv+px*vec2(0,2)).rgb+texture2D(u_texture,uv-px*vec2(0,2)).rgb)*.25;col+=max(bL-vec3(.72),0.)*mix(.22,.36,u_quality);col+=(hash(uv*u_resolution+fract(u_time*57.))-.5)*mix(.008,.016,u_quality);col=aces(col);col*=.94+smoothstep(1.18,.22,length((uv-.5)*vec2(u_resolution.x/u_resolution.y,1.)))*.1;gl_FragColor=vec4(col,1.);}`
sScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: sU, vertexShader: vsh, fragmentShader: silkFsh })))
const pU = { u_texture: { value: null }, u_time: { value: 0 }, u_resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }, u_quality: { value: Q } }
pScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: pU, vertexShader: vsh, fragmentShader: postFsh })))
function rW() { return Math.floor(window.innerWidth * (Q > .5 ? 1 : isUL ? .25 : .65)) }
function rH() { return Math.floor(window.innerHeight * (Q > .5 ? 1 : isUL ? .25 : .65)) }
let RT = new THREE.WebGLRenderTarget(rW(), rH(), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false })
pU.u_texture.value = RT.texture
window.addEventListener('resize', () => {
  applyR(); const sc = Q > .5 ? 1 : .65; renderer.setSize(window.innerWidth * sc, window.innerHeight * sc, false); canvas.style.width = '100%'; canvas.style.height = '100%'
  sU.u_resolution.value.set(window.innerWidth, window.innerHeight); pU.u_resolution.value.set(window.innerWidth, window.innerHeight)
  RT.dispose(); RT = new THREE.WebGLRenderTarget(rW(), rH(), { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, depthBuffer: false, stencilBuffer: false }); pU.u_texture.value = RT.texture
  initSizes()
})
let elapsed = 0, prevT = performance.now()
function animate(now) {
  const dt = Math.min((now - prevT) * .001, .033); prevT = now; elapsed += dt
  tClock += dt; const tm = tClock > 9 ? Math.min((tClock - 9) / 3.2, 1) : 0
  sU.u_themeMix.value = tm
  if (tm >= 1) { tF = tTo; tTo = (tTo + 1) % TP.length; setTS('A', TP[tF]); setTS('B', TP[tTo]); tClock = 0; sU.u_themeMix.value = 0 }
  sU.u_time.value = elapsed * (Q > .5 ? 1.08 : .95); pU.u_time.value = elapsed
  renderer.setRenderTarget(RT); renderer.render(sScene, cam)
  renderer.setRenderTarget(null); isUL ? renderer.render(sScene, cam) : renderer.render(pScene, cam)
}
const FC = isUL ? 1000 / 20 : isLP ? 1000 / 30 : 0; let LF = 0
  ; (function loop(now) { requestAnimationFrame(loop); if (FC > 0 && now - LF < FC) return; LF = now; animate(now) })(performance.now())
document.addEventListener('visibilitychange', () => { if (!document.hidden) prevT = performance.now() })
document.addEventListener('dragstart', e => e.preventDefault())
document.addEventListener('selectstart', e => e.preventDefault())

gsap.registerPlugin(ScrollTrigger)
let lenis
if (typeof Lenis !== 'undefined') {
  lenis = new Lenis({ lerp: .095, smoothWheel: true })
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add(t => lenis && lenis.raf(t * 1000))
  gsap.ticker.lagSmoothing(0)
}

const logo = document.getElementById('travelling-logo')
const NAV_H = 72

let bigW, smallW, bigTop, smallTop
function initSizes() {
  bigW = Math.min(window.innerWidth * 0.58, 430)
  smallW = 110
  bigTop = window.innerHeight * 0.5
  // smallTop = NAV_H * 0.7
  smallTop = 70
}
initSizes()

// Easing
function eio(t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2 }

let navOpen = false

// const openTL=gsap.timeline({paused:true,defaults:{ease:'back.out(1.5)'}})
// openTL
//   .to(Array.from(navLL), {opacity:1,x:0,stagger:0.07,duration:0.46},0)
//   .to(Array.from(navRL), {opacity:1,x:0,stagger:0.07,duration:0.46},0.06)

// const closeTL=gsap.timeline({paused:true,defaults:{ease:'power2.in'}})
// closeTL
//   .to(Array.from(navRL).reverse(), {opacity:0,x:18,stagger:0.05,duration:0.26},0)
//   .to(Array.from(navLL).reverse(), {opacity:0,x:-18,stagger:0.05,duration:0.26},0.04)

// function openNav(){
//   if(navOpen)return; navOpen=true
//   gsap.to(navBg,{y:'0%',opacity:1,duration:.42,ease:'power3.out'})
//   gsap.to([lineL,lineR],{width:'calc(50% - 68px)',opacity:1,duration:.55,ease:'power3.out',delay:.06})
//   closeTL.pause(0); openTL.restart()
// }
// function closeNav(){
//   if(!navOpen)return; navOpen=false
//   openTL.pause(); closeTL.restart()
//   gsap.to([lineL,lineR],{width:0,opacity:0,duration:.32,ease:'power2.in'})
//   gsap.to(navBg,{y:'-100%',opacity:0,duration:.36,ease:'power2.in',delay:.18})
// }

const TRAV = () => window.innerHeight * 0.38
const OPEN_T = 0.80
const CLOSE_T = 0.52

function updateLogo() {
  if (isLegalPage) return;

  const sy = window.scrollY;
  const rawP = Math.min(sy / TRAV(), 1);
  const p = eio(rawP);

  const w = bigW + (smallW - bigW) * p;
  logo.style.width = w + 'px';

  const cy = bigTop + (smallTop - bigTop) * p;
  logo.style.top = cy + 'px';

  logo.style.animationPlayState = rawP > 0.03 ? 'paused' : 'running';
}

window.addEventListener('scroll', updateLogo, { passive: true })
if (lenis) lenis.on('scroll', updateLogo)
updateLogo()

gsap.utils.toArray('.manifesto-headline .line').forEach((l, i) => gsap.to(l, { y: 0, opacity: 1, duration: 1.1, ease: 'expo.out', delay: i * .12, scrollTrigger: { trigger: '.manifesto', start: 'top 70%', once: true } }))
gsap.to('.manifesto-body', { opacity: 1, y: 0, duration: 1, ease: 'power3.out', delay: .35, scrollTrigger: { trigger: '.manifesto', start: 'top 60%', once: true } })
gsap.utils.toArray('.feature-line').forEach((l, i) => gsap.to(l, { opacity: 1, x: 0, duration: .7, ease: 'power3.out', delay: i * .04, scrollTrigger: { trigger: l, start: 'top 88%', once: true } }))
gsap.utils.toArray('.sound-headline .word').forEach((w, i) => gsap.to(w, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', delay: i * .14, scrollTrigger: { trigger: '#sec-sound', start: 'top 65%', once: true } }))
gsap.utils.toArray('.sound-stat').forEach((s, i) => gsap.to(s, { opacity: 1, y: 0, duration: .7, ease: 'power3.out', delay: .3 + i * .1, scrollTrigger: { trigger: '#sec-sound', start: 'top 55%', once: true } }))
gsap.utils.toArray('.strip-item').forEach((it, i) => gsap.to(it, { opacity: 1, y: 0, duration: .75, ease: 'power3.out', delay: i * .1, scrollTrigger: { trigger: '#sec-strip', start: 'top 80%', once: true } }))
gsap.to('#qt', { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: '#sec-quote', start: 'top 65%', once: true } })
gsap.to('#qs', { opacity: 1, duration: .9, ease: 'power2.out', delay: .45, scrollTrigger: { trigger: '#sec-quote', start: 'top 65%', once: true } })
gsap.to('#ph', { opacity: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: '#sec-platform', start: 'top 70%', once: true } })
gsap.to('#ps', { opacity: 1, y: 0, duration: .9, ease: 'power3.out', delay: .2, scrollTrigger: { trigger: '#sec-platform', start: 'top 65%', once: true } })
gsap.to('#pl', { opacity: 1, duration: .8, ease: 'power2.out', delay: .4, scrollTrigger: { trigger: '#sec-platform', start: 'top 60%', once: true } })

const cache = {};

function loadMarkdown(file) {
  if (cache[file]) return Promise.resolve(cache[file]);

  return fetch(file)
    .then(res => {
      if (!res.ok) throw new Error("Failed to load");
      return res.text();
    })
    .then(md => {
      cache[file] = md;
      return md;
    });
}

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

  // mark legal mode
  isLegalPage = true;

  // hide main content
  document.querySelectorAll("section, .marquee-section").forEach(el => {
    if (el.id !== "legal-page") el.style.display = "none";
  });

  const legal = document.getElementById("legal-page");
  legal.style.display = "block";

  document.getElementById("legal-title").textContent = title;

  loadMarkdown(file)
    .then(md => {
      document.getElementById("legal-content").innerHTML = marked.parse(md);
    })
    .catch(() => {
      document.getElementById("legal-content").innerHTML = "<p>Failed to load content.</p>";
    });

  logo.style.width = smallW + "px";
  logo.style.top = smallTop + "px";
  logo.style.animation = "none";
  logo.style.transform = "translate(-50%, 0)";

  if (lenis) {
    lenis.scrollTo(0, { immediate: true });
  } else {
    window.scrollTo(0, 0);
  }
}