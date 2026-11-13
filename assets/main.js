const root = document.documentElement;
root.classList.add('js');

const header = document.querySelector('.site-header');
const hero = document.querySelector('.hero');
const nav = document.querySelector('.main-nav');
const menuButton = document.querySelector('.menu-toggle');
const navLinks = [...nav.querySelectorAll('a')];
const sections = navLinks.map(link => document.querySelector(link.hash)).filter(Boolean);
const motionButton = document.querySelector('.motion-toggle');
const motionLabel = document.querySelector('.motion-label');
const photoMain = document.querySelector('.photo-main');
const photoDetail = document.querySelector('.photo-detail');
const ticker = document.querySelector('.ticker');
const driftingCards = [...document.querySelectorAll('[data-drift]')];
const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
let savedMotion = null;
try { savedMotion = localStorage.getItem('senyu-motion'); } catch { /* Private browsing can make storage unavailable. */ }
let motionEnabled = savedMotion ? savedMotion === 'on' : !motionPreference.matches;
let frameRequested = false;

function closeMenu() {
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-label', '展开导航');
  nav.classList.remove('is-open');
}

menuButton.addEventListener('click', () => {
  const expanded = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(expanded));
  menuButton.setAttribute('aria-label', expanded ? '收起导航' : '展开导航');
  nav.classList.toggle('is-open', expanded);
});
navLinks.forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('click', event => {
  if (!header.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && nav.classList.contains('is-open')) {
    closeMenu();
    menuButton.focus();
  }
});
window.matchMedia('(min-width: 761px)').addEventListener('change', event => {
  if (event.matches) closeMenu();
});

const reveals = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -35px 0px', threshold: 0.08 });
  reveals.forEach(element => revealObserver.observe(element));
} else {
  reveals.forEach(element => element.classList.add('is-visible'));
}

function updateScroll() {
  frameRequested = false;
  const scrollY = Math.max(0, window.scrollY);
  const viewportHeight = window.innerHeight;
  const pageHeight = root.scrollHeight - viewportHeight;
  root.style.setProperty('--page-progress', pageHeight > 0 ? Math.min(1, scrollY / pageHeight) : 0);
  header.classList.toggle('is-scrolled', scrollY > 60);

  let currentSection = sections[0];
  for (const section of sections) {
    if (section.getBoundingClientRect().top <= viewportHeight * 0.42) currentSection = section;
  }
  for (const link of navLinks) {
    const active = link.hash === `#${currentSection.id}`;
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  }

  if (!motionEnabled) return;
  const tickerTop = ticker.getBoundingClientRect().top;
  ticker.style.setProperty('--ticker-x', `${-Math.max(0, viewportHeight - tickerTop) * 0.14}px`);
  for (const card of driftingCards) {
    if (card.hidden) continue;
    const rect = card.getBoundingClientRect();
    if (rect.top > viewportHeight || rect.bottom < 0) continue;
    const distance = (rect.top + rect.height / 2 - viewportHeight / 2) * 0.025 * Number(card.dataset.drift);
    card.style.setProperty('--album-shift', `${Math.max(-13, Math.min(13, distance))}px`);
  }
  const heroHeight = hero.offsetHeight;
  if (scrollY < heroHeight + viewportHeight * 0.1) {
    const progress = Math.min(1, scrollY / heroHeight);
    hero.style.setProperty('--hero-y', `${Math.min(scrollY * 0.13, 110)}px`);
    hero.style.setProperty('--hero-content-y', `${-scrollY * 0.09}px`);
    hero.style.setProperty('--hero-content-opacity', Math.max(0, 1 - progress * 1.35));
  }
  const photoRect = photoMain.getBoundingClientRect();
  if (photoRect.top < viewportHeight && photoRect.bottom > 0) {
    const offset = (photoRect.top + photoRect.height / 2 - viewportHeight / 2) * 0.035;
    photoMain.style.setProperty('--photo-y', `${Math.max(-20, Math.min(20, offset))}px`);
    photoDetail.style.setProperty('--detail-y', `${Math.max(-16, Math.min(16, -offset))}px`);
  }
}

function requestScrollFrame() {
  if (frameRequested) return;
  frameRequested = true;
  requestAnimationFrame(updateScroll);
}

function applyMotionPreference() {
  root.classList.toggle('motion-off', !motionEnabled);
  motionButton.setAttribute('aria-pressed', String(!motionEnabled));
  motionButton.setAttribute('aria-label', motionEnabled ? '暂停动态效果' : '开启动态效果');
  motionLabel.textContent = motionEnabled ? '让日子慢一点' : '画面已暂停';
  requestScrollFrame();
}

motionButton.addEventListener('click', () => {
  motionEnabled = !motionEnabled;
  savedMotion = motionEnabled ? 'on' : 'off';
  try { localStorage.setItem('senyu-motion', savedMotion); } catch { /* The page works without saved preferences. */ }
  applyMotionPreference();
});
motionPreference.addEventListener('change', event => {
  if (savedMotion !== null) return;
  motionEnabled = !event.matches;
  applyMotionPreference();
});
window.addEventListener('scroll', requestScrollFrame, { passive: true });
window.addEventListener('resize', requestScrollFrame, { passive: true });
window.addEventListener('load', requestScrollFrame, { once: true });
applyMotionPreference();

const photoDialog = document.querySelector('.photo-dialog');
const dialogPhoto = document.querySelector('.dialog-photo');
const dialogCaption = document.querySelector('#dialog-caption');
const dialogCounter = document.querySelector('.dialog-counter');
const previousPhoto = document.querySelector('.dialog-prev');
const nextPhoto = document.querySelector('.dialog-next');
const photoGroups = new Map();
let currentPhotos = [];
let currentPhotoIndex = 0;

document.querySelectorAll('[data-photo]').forEach(button => {
  const group = button.dataset.album || button.dataset.photo;
  if (!photoGroups.has(group)) photoGroups.set(group, []);
  photoGroups.get(group).push(button);
  button.addEventListener('click', () => {
    currentPhotos = photoGroups.get(group);
    currentPhotoIndex = currentPhotos.indexOf(button);
    showCurrentPhoto();
    photoDialog.showModal();
    document.body.classList.add('dialog-is-open');
  });
});

function showCurrentPhoto() {
  const button = currentPhotos[currentPhotoIndex];
  if (!button) return;
  dialogPhoto.src = button.dataset.photo;
  dialogPhoto.alt = button.querySelector('img')?.alt || button.dataset.caption;
  dialogCaption.textContent = button.dataset.caption;
  dialogCounter.textContent = `${currentPhotoIndex + 1} / ${currentPhotos.length}`;
  previousPhoto.hidden = currentPhotos.length < 2;
  nextPhoto.hidden = currentPhotos.length < 2;
}

function changePhoto(direction) {
  currentPhotoIndex = (currentPhotoIndex + direction + currentPhotos.length) % currentPhotos.length;
  showCurrentPhoto();
}
previousPhoto.addEventListener('click', () => changePhoto(-1));
nextPhoto.addEventListener('click', () => changePhoto(1));
document.addEventListener('keydown', event => {
  if (!photoDialog.open || currentPhotos.length < 2) return;
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    changePhoto(event.key === 'ArrowLeft' ? -1 : 1);
  }
});
document.querySelector('.dialog-close').addEventListener('click', () => photoDialog.close());
photoDialog.addEventListener('click', event => {
  if (event.target === photoDialog) photoDialog.close();
});
photoDialog.addEventListener('close', () => document.body.classList.remove('dialog-is-open'));

const filterButtons = [...document.querySelectorAll('[data-filter]')];
const albumCards = [...document.querySelectorAll('[data-category]')];
const albumGrid = document.querySelector('.album-grid');
const albumCount = document.querySelector('.album-count');
const gameVideo = document.querySelector('.game-video');
const gamePlay = document.querySelector('.game-play');
const gamePlayLabel = document.querySelector('.game-play-label');
const gameStatus = document.querySelector('.game-status');

function showVideoError() {
  gamePlay.hidden = false;
  gamePlay.disabled = false;
  gamePlayLabel.textContent = '重新播放';
  gamePlay.setAttribute('aria-label', '重新播放游戏视频');
  gameStatus.hidden = false;
  gameStatus.textContent = '视频暂时没加载出来，可以重试，或点击旁边的“单独打开视频”。';
}

gamePlay.addEventListener('click', async () => {
  gamePlay.disabled = true;
  gamePlayLabel.textContent = '正在加载…';
  gameStatus.hidden = true;
  if (gameVideo.error) gameVideo.load();
  if (gameVideo.ended) gameVideo.currentTime = 0;
  try {
    await gameVideo.play();
  } catch (error) {
    if (error.name !== 'AbortError') showVideoError();
  } finally {
    gamePlay.disabled = false;
  }
});
gameVideo.addEventListener('playing', () => {
  gamePlay.hidden = true;
  gamePlay.disabled = false;
  gameStatus.hidden = true;
});
gameVideo.addEventListener('pause', () => {
  gamePlay.hidden = false;
  gamePlay.disabled = false;
  gamePlayLabel.textContent = gameVideo.ended ? '再看一次' : '继续播放';
  gamePlay.setAttribute('aria-label', gameVideo.ended ? '重新播放游戏视频' : '继续播放游戏视频');
  gameStatus.hidden = true;
});
gameVideo.addEventListener('ended', () => {
  gamePlay.hidden = false;
  gamePlayLabel.textContent = '再看一次';
  gamePlay.setAttribute('aria-label', '重新播放游戏视频');
});
gameVideo.addEventListener('error', showVideoError);

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const selectedCategory = button.dataset.filter;
    for (const option of filterButtons) {
      const selected = option === button;
      option.classList.toggle('is-active', selected);
      option.setAttribute('aria-pressed', String(selected));
    }
    let visibleCount = 0;
    for (const card of albumCards) {
      const visible = selectedCategory === 'all' || card.dataset.category === selectedCategory;
      card.hidden = !visible;
      if (visible) {
        visibleCount++;
        card.classList.add('is-visible');
      } else if (card.contains(gameVideo)) gameVideo.pause();
    }
    albumGrid.classList.toggle('is-filtered', selectedCategory !== 'all');
    albumCount.textContent = `${String(visibleCount).padStart(2, '0')} 段生活`;
    requestScrollFrame();
  });
});
document.querySelector('#copyright-year').textContent = new Date().getFullYear();
