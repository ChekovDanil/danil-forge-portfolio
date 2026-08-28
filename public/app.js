import { Mesh, Program, Renderer, Triangle, Vec2 } from './vendor/ogl/index.js';
const { animate, inView, scroll, stagger } = window.Motion;

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const compact = matchMedia('(max-width: 840px)').matches;

function setupWave(selector) {
  const shell = document.querySelector(selector);
  const canvas = shell?.querySelector('canvas');
  if (!shell || !canvas || reduced || compact) {
    shell?.classList.add('static-wave');
    return;
  }

  try {
    const renderer = new Renderer({ canvas, alpha: true, antialias: false, dpr: Math.min(devicePixelRatio, 1.5) });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position,0.,1.);}`,
      fragment: `
        precision highp float;
        uniform float uTime; uniform vec2 uPointer; varying vec2 vUv;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
        float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.03+17.1;a*=.5;}return v;}
        void main(){
          vec2 uv=vUv; vec2 p=(uv-.5)*vec2(1.5,1.);
          p+=uPointer*.065;
          float t=uTime*.085;
          float n=fbm(p*2.2+vec2(t,-t*.7));
          float ribbon=exp(-abs(p.y+.15*sin(p.x*2.35+n*2.1)-.16*n)*8.2);
          float ribbon2=exp(-abs(p.y-.24+.11*sin(p.x*3.1-n*1.8+t*.9))*11.0);
          float ribbon3=exp(-abs(p.y+.30+.08*sin(p.x*2.7+n*1.4-t*.7))*13.0);
          float haze=fbm(p*1.25+vec2(-t*.4,t*.55));
          vec3 pearl=vec3(.70,.78,.92), violet=vec3(.31,.18,.74), cyan=vec3(.16,.55,.82);
          vec3 col=mix(violet,cyan,smoothstep(.2,.9,n)); col=mix(col,pearl,ribbon*.82+ribbon2*.34);
          float alpha=(ribbon*.68+ribbon2*.28+ribbon3*.18+haze*.12)*smoothstep(1.08,.08,length(p));
          gl_FragColor=vec4(col,alpha);
        }`,
      uniforms: { uTime: { value: 0 }, uPointer: { value: new Vec2() } },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new Mesh(gl, { geometry, program });
    let running = true;
    const resize = () => renderer.setSize(shell.clientWidth, shell.clientHeight);
    const pointer = (event) => program.uniforms.uPointer.value.set(event.clientX / innerWidth - .5, event.clientY / innerHeight - .5);
    const frame = (time) => { if (running) { program.uniforms.uTime.value = time * .001; renderer.render({ scene: mesh }); } requestAnimationFrame(frame); };
    new ResizeObserver(resize).observe(shell);
    new IntersectionObserver(([entry]) => { running = entry.isIntersecting && !document.hidden; }).observe(shell);
    document.addEventListener('visibilitychange', () => { running = !document.hidden && shell.getBoundingClientRect().bottom > 0; });
    addEventListener('pointermove', pointer, { passive: true });
    resize(); requestAnimationFrame(frame);
    shell.dataset.renderer = 'ogl';
  } catch {
    shell.classList.add('static-wave');
  }
}

function setupMotion() {
  if (reduced) return;
  document.documentElement.classList.add('motion-ready');
  animate('[data-hero]', { opacity: [0, 1], y: [32, 0], filter: ['blur(10px)', 'blur(0px)'] }, { duration: .9, delay: stagger(.1), easing: [0.22, 1, 0.36, 1] });
  inView('[data-reveal]', (element) => {
    animate(element, { opacity: [0, 1], y: [44, 0] }, { duration: .78, easing: [0.22, 1, 0.36, 1] });
  }, { amount: .14 });
  const progress = document.querySelector('.page-progress');
  if (progress) scroll(animate(progress, { scaleX: [0, 1] }, { easing: 'linear' }));
  document.querySelectorAll('[data-magnetic]').forEach((button) => {
    button.addEventListener('pointermove', (event) => {
      const box = button.getBoundingClientRect();
      animate(button, { x: (event.clientX - box.left - box.width / 2) * .12, y: (event.clientY - box.top - box.height / 2) * .12 }, { duration: .25 });
    });
    button.addEventListener('pointerleave', () => animate(button, { x: 0, y: 0 }, { duration: .45, easing: [0.22, 1, 0.36, 1] }));
  });
}

function setupAura() {
  const aura = document.querySelector('.cursor-aura');
  if (!aura || reduced || !matchMedia('(pointer:fine)').matches) return;
  addEventListener('pointermove', (event) => {
    aura.style.setProperty('--x', `${event.clientX}px`);
    aura.style.setProperty('--y', `${event.clientY}px`);
    aura.classList.add('visible');
  }, { passive: true });
}

setupWave('.hero-webgl');
setupWave('.capability-webgl');
setupMotion();
setupAura();
