const shell = document.querySelector('#browserShell');
const before = document.querySelector('.before-state');
const after = document.querySelector('.after-state');
const track = document.querySelector('#fixedTrack');
const position = document.querySelector('#position');
const edgeCue = document.querySelector('.edge-cue');
const prev = document.querySelector('#prev');
const next = document.querySelector('#next');
let activeIndex = 0;

function cardStep(){
  const first = track.querySelector('img');
  return first ? first.getBoundingClientRect().width + 12 : 292;
}

function updatePosition(index){
  activeIndex = Math.max(0, Math.min(4, index));
  position.textContent = `${String(activeIndex + 1).padStart(2,'0')} / 05`;
  edgeCue.textContent = `ещё ${4 - activeIndex}`;
  edgeCue.style.opacity = activeIndex === 4 ? '0' : '1';
  prev.disabled = activeIndex === 0;
  next.disabled = activeIndex === 4;
}

function go(index){
  updatePosition(index);
  track.scrollTo({ left:activeIndex * cardStep(), behavior:'smooth' });
}

document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-mode]').forEach(item => {
    const selected = item === button;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  const isBefore = button.dataset.mode === 'before';
  before.hidden = !isBefore;
  after.hidden = isBefore;
  history.replaceState(null,'',`?state=${isBefore ? 'before' : 'after'}`);
}));

document.querySelectorAll('[data-viewport]').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('[data-viewport]').forEach(item => {
    const selected = item === button;
    item.classList.toggle('active', selected);
    item.setAttribute('aria-pressed', String(selected));
  });
  shell.classList.toggle('mobile', button.dataset.viewport === 'mobile');
  shell.classList.toggle('desktop', button.dataset.viewport === 'desktop');
  go(0);
}));

prev.addEventListener('click', () => go(activeIndex - 1));
next.addEventListener('click', () => go(activeIndex + 1));
track.addEventListener('keydown', event => {
  if(event.key === 'ArrowRight'){ event.preventDefault(); go(activeIndex + 1); }
  if(event.key === 'ArrowLeft'){ event.preventDefault(); go(activeIndex - 1); }
});
track.addEventListener('scroll', () => {
  window.clearTimeout(track.scrollTimer);
  track.scrollTimer = window.setTimeout(() => updatePosition(Math.round(track.scrollLeft / cardStep())), 80);
}, {passive:true});

if(new URLSearchParams(location.search).get('state') === 'before') document.querySelector('[data-mode="before"]').click();
else updatePosition(0);
