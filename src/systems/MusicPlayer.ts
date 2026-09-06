export interface MusicPlayerOptions {
  /** 0 到 1；呼叫端可將它保存為使用者偏好。 */
  volume?: number;
  onVolumeChange?: (value: number) => void;
}

export interface MusicPlayer {
  /** 頁面進入背景時暫停；回到前景不會自行恢復。 */
  visibility: (hidden: boolean) => void;
  dispose: () => void;
  getVolume: () => number;
  setVolume: (value: number) => void;
}

interface Track {
  title: string;
  source: string;
}

const tracks: readonly Track[] = [
  { title: 'Submerged Sunlight（沉入日光）', source: '/audio/submerged-sunlight.m4a' },
  { title: 'Waterline Hush（水線低語）', source: '/audio/waterline-hush.m4a' },
  { title: 'Sun Through Water（穿過水面的陽光）', source: '/audio/sun-through-water.m4a' },
  { title: 'Sun Through Water (1)（穿過水面的陽光（二））', source: '/audio/sun-through-water-2.m4a' },
];

const clampVolume = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

/**
 * 建立本地曲目控制列。模組不寫入全域 CSS，呼叫端可用 music-player 類別掛接樣式。
 */
export function createMusicPlayer(container: HTMLElement, options: MusicPlayerOptions = {}): MusicPlayer {
  const audio = new Audio();
  audio.preload = 'none';
  audio.volume = clampVolume(options.volume ?? 0.5);

  const root = document.createElement('section');
  root.className = 'music-player';
  root.setAttribute('aria-label', '本地音樂播放器');
  const title = document.createElement('p');
  title.className = 'music-player__title';
  title.textContent = '水下選曲';
  const select = document.createElement('select');
  select.className = 'music-player__track';
  select.setAttribute('aria-label', '選擇曲目');
  tracks.forEach((track, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = track.title;
    select.append(option);
  });
  const play = document.createElement('button');
  play.type = 'button';
  play.className = 'music-player__play';
  play.textContent = '播放';
  play.setAttribute('aria-pressed', 'false');
  const volumeLabel = document.createElement('label');
  volumeLabel.className = 'music-player__volume-label';
  volumeLabel.textContent = '音量';
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.className = 'music-player__volume';
  volume.min = '0'; volume.max = '100'; volume.step = '1';
  volume.value = String(Math.round(audio.volume * 100));
  volume.setAttribute('aria-label', '音量');
  volumeLabel.append(volume);
  const loopLabel = document.createElement('label');
  loopLabel.className = 'music-player__loop-label';
  const loop = document.createElement('input');
  loop.type = 'checkbox';
  loop.className = 'music-player__loop';
  loop.setAttribute('aria-label', '循環播放');
  loopLabel.append(loop, document.createTextNode(' 循環播放'));
  const status = document.createElement('p');
  status.className = 'music-player__status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const progress = document.createElement('output');
  progress.className = 'music-player__progress';
  progress.setAttribute('aria-label', '播放進度');
  progress.textContent = '0:00';
  root.append(title, select, play, progress, volumeLabel, loopLabel, status);
  container.append(root);

  let trackIndex = 0;
  let disposed = false;
  let requestId = 0;
  let wantedPlaying = false;

  const render = () => {
    const isPlaying = wantedPlaying && !audio.paused;
    play.textContent = isPlaying ? '暫停' : '播放';
    play.setAttribute('aria-pressed', String(isPlaying));
  };
  const setStatus = (message: string) => { status.textContent = message; };
  const selectedSource = () => new URL(tracks[trackIndex].source, document.baseURI).href;
  const loadSelectedTrack = () => {
    if (audio.currentSrc !== selectedSource()) {
      audio.src = tracks[trackIndex].source;
      audio.load();
    }
  };
  const stop = () => {
    requestId += 1;
    wantedPlaying = false;
    audio.pause();
    render();
  };
  const start = async () => {
    const id = ++requestId;
    wantedPlaying = true;
    setStatus('');
    loadSelectedTrack();
    try {
      await audio.play();
      if (disposed || !wantedPlaying) {
        audio.pause();
        return;
      }
      if (id !== requestId) return;
      render();
    } catch {
      if (!disposed && id === requestId) {
        wantedPlaying = false;
        setStatus('這首音樂暫時無法播放。');
        render();
      }
    }
  };
  const setTrack = (index: number, continuePlaying: boolean) => {
    requestId += 1;
    audio.pause();
    wantedPlaying = false;
    trackIndex = index;
    audio.removeAttribute('src');
    audio.load();
    setStatus(`已選擇：${tracks[trackIndex].title}`);
    render();
    if (continuePlaying) void start();
  };

  const formatTime=(seconds:number)=>`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
  audio.addEventListener('timeupdate',()=>{progress.textContent=`${formatTime(audio.currentTime)} / ${Number.isFinite(audio.duration)?formatTime(audio.duration):'—'}`;});
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => {
    wantedPlaying = false;
    render();
  });
  audio.addEventListener('error', () => {
    if (!disposed && audio.currentSrc === selectedSource()) {
      wantedPlaying = false;
      setStatus('這首音樂暫時無法載入。');
      render();
    }
  });
  select.addEventListener('change', () => setTrack(Number(select.value), wantedPlaying));
  play.addEventListener('click', () => { if (wantedPlaying) stop(); else void start(); });
  volume.addEventListener('input', () => {
    const value = clampVolume(Number(volume.value) / 100);
    audio.volume = value;
    options.onVolumeChange?.(value);
  });
  loop.addEventListener('change', () => { audio.loop = loop.checked; });

  return {
    visibility(hidden) { if (hidden) stop(); },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      audio.removeAttribute('src');
      audio.load();
      root.remove();
    },
    getVolume: () => audio.volume,
    setVolume(value) {
      const next = clampVolume(value);
      audio.volume = next;
      volume.value = String(Math.round(next * 100));
    },
  };
}
