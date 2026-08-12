import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const gamesDir = join(root, 'packages', 'games', 'classic')

const AUDIO_CONTROLS = `
<div id="gamehubAudioControls" class="gamehub-audio-controls" role="group" aria-label="声音控制">
  <button type="button" data-audio="music" aria-pressed="true" aria-label="关闭背景音乐" title="关闭背景音乐">♫</button>
  <button type="button" data-audio="sfx" aria-pressed="true" aria-label="关闭游戏音效" title="关闭游戏音效">🔊</button>
</div>`

const AUDIO_CSS = `
  .gamehub-audio-controls{position:fixed;top:12px;right:60px;z-index:20;display:flex;gap:6px;align-items:center}
  .gamehub-audio-controls button{width:40px;height:40px;border:1px solid rgba(255,255,255,.15);border-radius:9px;background:rgba(20,28,42,.88);color:inherit;cursor:pointer;font:700 1.05rem/1 Segoe UI,Arial,sans-serif;transition:background .15s,transform .1s,opacity .15s}
  .gamehub-audio-controls button:hover{background:rgba(0,174,236,.82)}
  .gamehub-audio-controls button:active{transform:scale(.94)}
  .gamehub-audio-controls button:focus-visible{outline:3px solid #68dfff;outline-offset:2px}
  .gamehub-audio-controls button[aria-pressed="false"]{opacity:.48;filter:grayscale(1)}
  @media (max-width:520px){.gamehub-audio-controls{right:58px;gap:4px}.gamehub-audio-controls button{width:42px;height:42px}}
  @media (prefers-reduced-motion:reduce){.gamehub-audio-controls button{transition:none}}
`

const AUDIO_RUNTIME = String.raw`
(()=>{
  const AudioContextCtor=window.AudioContext||window.webkitAudioContext;
  const musicNotes=[261.63,329.63,392,523.25,392,329.63,293.66,349.23,440,523.25,440,349.23];
  let audioContext=null,masterGain=null,musicGain=null,musicTimer=null,musicStep=0,musicEnabled=true,sfxEnabled=true;
  function createAudio(){
    if(!AudioContextCtor)return null;
    if(!audioContext){
      try{audioContext=new AudioContextCtor();
        masterGain=audioContext.createGain();masterGain.gain.value=.2;masterGain.connect(audioContext.destination);
        musicGain=audioContext.createGain();musicGain.gain.value=.32;musicGain.connect(masterGain);
      }catch(_error){audioContext=null;masterGain=null;musicGain=null;return null}
    }
    return audioContext;
  }
  function ensureAudio(){
    const ctx=createAudio();
    if(!ctx)return null;
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    if(musicEnabled)startMusic();
    return ctx;
  }
  function tone(freq,duration,type,volume,target){
    const ctx=createAudio();
    if(!ctx||!target)return;
    const osc=ctx.createOscillator(),gain=ctx.createGain(),now=ctx.currentTime;
    osc.type=type||'sine';osc.frequency.setValueAtTime(freq,now);
    gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),now+.012);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
    osc.connect(gain);gain.connect(target);osc.start(now);osc.stop(now+duration+.025);
  }
  function musicTone(freq){
    const ctx=createAudio();
    if(!ctx||!musicGain||document.hidden)return;
    tone(freq,.34,'triangle',.18,musicGain);
  }
  function startMusic(){
    if(!musicEnabled||musicTimer)return;
    if(!createAudio())return;
    const play=()=>{musicTone(musicNotes[musicStep%musicNotes.length]);musicStep++};
    play();musicTimer=window.setInterval(play,420);
  }
  function stopMusic(){
    if(musicTimer){window.clearInterval(musicTimer);musicTimer=null}
  }
  function sfx(kind){
    if(!sfxEnabled)return;
    const ctx=ensureAudio();
    if(!ctx||!masterGain)return;
    if(kind==='tap')tone(480,.055,'sine',.09,masterGain);
    else if(kind==='key')tone(620,.05,'square',.07,masterGain);
    else if(kind==='score'){tone(660,.08,'sine',.14,masterGain);window.setTimeout(()=>tone(880,.12,'sine',.12,masterGain),55)}
    else if(kind==='good'){tone(523.25,.1,'triangle',.14,masterGain);window.setTimeout(()=>tone(783.99,.18,'triangle',.14,masterGain),80)}
    else if(kind==='bad'){tone(180,.2,'sawtooth',.12,masterGain);window.setTimeout(()=>tone(120,.22,'sawtooth',.1,masterGain),90)}
    else if(kind==='win'){[523.25,659.25,783.99,1046.5].forEach((freq,index)=>window.setTimeout(()=>tone(freq,.18,'triangle',.14,masterGain),index*85))}
    else if(kind==='lose'){tone(247,.2,'sine',.13,masterGain);window.setTimeout(()=>tone(165,.3,'sine',.11,masterGain),120)}
    else if(kind==='hit')tone(110,.12,'square',.14,masterGain);
    else if(kind==='toggle')tone(740,.07,'sine',.1,masterGain);
  }
  function setControl(button,enabled,labelOn,labelOff){
    button.setAttribute('aria-pressed',String(enabled));button.setAttribute('aria-label',enabled?labelOff:labelOn);button.title=enabled?labelOff:labelOn;
  }
  function bindControls(){
    document.querySelectorAll('[data-audio]').forEach(button=>button.addEventListener('click',event=>{
      event.stopPropagation();const kind=button.dataset.audio;const enabled=button.getAttribute('aria-pressed')!=='true';
      if(kind==='music'){musicEnabled=enabled;setControl(button,enabled,'开启背景音乐','关闭背景音乐');if(enabled){ensureAudio();startMusic()}else stopMusic()}
      if(kind==='sfx'){sfxEnabled=enabled;setControl(button,enabled,'开启游戏音效','关闭游戏音效');if(enabled){ensureAudio();sfx('toggle')}}
    }));
  }
  function watchFeedback(){
    const scoreNodes=[...document.querySelectorAll('#score,#best,#filled')];
    const mistakeNodes=[...document.querySelectorAll('#mistakes')];
    const resultNodes=[...document.querySelectorAll('#result,#summary,#finalScore')];
    const overlays=[...document.querySelectorAll('#over,#gameover')];
    if(!scoreNodes.length&&!mistakeNodes.length&&!resultNodes.length&&!overlays.length)return;
    const textSnapshot=node=>node.textContent;
    const displaySnapshot=node=>getComputedStyle(node).display;
    const scorePrevious=new Map(scoreNodes.map(node=>[node,textSnapshot(node)]));
    const mistakePrevious=new Map(mistakeNodes.map(node=>[node,textSnapshot(node)]));
    const resultPrevious=new Map(resultNodes.map(node=>[node,textSnapshot(node)]));
    const overlayPrevious=new Map(overlays.map(node=>[node,displaySnapshot(node)]));
    new MutationObserver(()=>{
      let scoreChanged=false,mistakeChanged=false,resultChanged=false;
      scoreNodes.forEach(node=>{const next=textSnapshot(node);if(next!==scorePrevious.get(node)){scorePrevious.set(node,next);scoreChanged=true}});
      mistakeNodes.forEach(node=>{const next=textSnapshot(node);if(next!==mistakePrevious.get(node)){mistakePrevious.set(node,next);mistakeChanged=true}});
      resultNodes.forEach(node=>{const next=textSnapshot(node);if(next!==resultPrevious.get(node)){resultPrevious.set(node,next);resultChanged=true}});
      overlays.forEach(node=>{const next=displaySnapshot(node);const previous=overlayPrevious.get(node);overlayPrevious.set(node,next);if(previous!==next&&next!=='none')resultChanged=true});
      const resultVisible=overlays.length===0||overlays.some(node=>displaySnapshot(node)!=='none');
      if(resultChanged&&resultVisible){const body=document.body.textContent||'';sfx(/胜|成功|清空|完成|过关|赢/.test(body)?'win':'lose')}else if(mistakeChanged)sfx('bad');else if(scoreChanged)sfx('score');
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class']});
  }
  document.addEventListener('pointerdown',event=>{ensureAudio();if(!event.target.closest('#gamehubAudioControls'))sfx('tap')},true);
  document.addEventListener('keydown',event=>{if(['tab','shift','control','alt','meta'].includes(event.key.toLowerCase()))return;ensureAudio();sfx('key')},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMusic();else if(musicEnabled)startMusic()});
  window.gamehubAudio={ensureAudio,startMusic,stopMusic,sfx,getState:()=>({musicEnabled,sfxEnabled,audioState:audioContext?.state||'uninitialized'})};
  bindControls();watchFeedback();
})();
`

const refresh = process.argv.includes('--refresh')
const files = readdirSync(gamesDir).filter(file => file.endsWith('.html')).sort()
for (const file of files) {
  const filePath = join(gamesDir, file)
  const source = readFileSync(filePath, 'utf8')
  if (refresh && source.includes('data-gamehub-audio="v1"')) {
    const refreshed = source.replace(/(<script>\r?\n)\s*\(\(\)=>\{\r?\n  const AudioContextCtor=[\s\S]*?\r?\n\}\)\(\);/, `$1${AUDIO_RUNTIME.trim()}`)
    if (refreshed === source) throw new Error(`Could not refresh audio runtime in ${file}`)
    writeFileSync(filePath, refreshed)
    continue
  }
  if (source.includes('data-gamehub-audio="v1"')) continue
  const withBodyMarker = source.replace(/<body([^>]*)>/i, '<body$1 data-gamehub-audio="v1">')
  const withStyles = withBodyMarker.replace(/<\/style>/i, `${AUDIO_CSS}</style>`)
  const withControls = withStyles.replace(/(<body[^>]*>)/i, `$1${AUDIO_CONTROLS}`)
  const withRuntime = withControls.replace(/<script>/i, `<script>\n${AUDIO_RUNTIME}`)
  if (withRuntime === source) throw new Error(`Could not inject audio runtime into ${file}`)
  writeFileSync(filePath, withRuntime)
}

console.log(`classic game audio injected: ${files.length} packages`)
