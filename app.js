// EngVocab 3000 - Core Application Logic
(function () {
  'use strict';

  // State Management
  const state = {
    words: [],
    topics: [],
    currentTopic: 'all',
    currentTopicName: 'Tất cả chủ đề',
    filteredWords: [],
    currentIndex: 0,
    isFlipped: false,
    theme: localStorage.getItem('engvocab_theme') || 'dark',
    mastered: new Set(JSON.parse(localStorage.getItem('engvocab_mastered') || '[]')),
    needsReview: new Set(JSON.parse(localStorage.getItem('engvocab_review') || '[]')),
    starred: new Set(JSON.parse(localStorage.getItem('engvocab_starred') || '[]')),
    currentTab: 'flashcard',
    // StandBy settings
    standbyActive: false,
    standbyTimer: null,
    standbyIntervalSec: parseInt(localStorage.getItem('engvocab_standby_sec') || '12', 10),
    standbyAutoVoice: localStorage.getItem('engvocab_standby_voice') === 'true',
    // Notification settings
    notificationEnabled: localStorage.getItem('engvocab_notif_enabled') === 'true',
    notificationIntervalMin: parseInt(localStorage.getItem('engvocab_notif_min') || '30', 10),
    notificationTimer: null,
    // Speech synthesis
    speechRate: 0.9,
    audioCache: {}
  };

  // DOM Elements
  const el = {
    themeBtn: document.getElementById('theme-btn'),
    topicBtn: document.getElementById('topic-btn'),
    currentTopicIcon: document.getElementById('current-topic-icon'),
    currentTopicName: document.getElementById('current-topic-name'),
    currentTopicCount: document.getElementById('current-topic-count'),
    cardCounter: document.getElementById('card-counter'),
    progressFill: document.getElementById('progress-fill'),
    cardWrapper: document.getElementById('card-wrapper'),
    cardTopic: document.getElementById('card-topic'),
    cardWord: document.getElementById('card-word'),
    cardIpa: document.getElementById('card-ipa'),
    cardPhonetic: document.getElementById('card-phonetic'),
    cardStressGuide: document.getElementById('card-stress-guide'),
    cardStar: document.getElementById('card-star'),
    audioNormalBtn: document.getElementById('audio-normal-btn'),
    audioSlowBtn: document.getElementById('audio-slow-btn'),
    backMeaning: document.getElementById('back-meaning'),
    backType: document.getElementById('back-type'),
    backExample: document.getElementById('back-example'),
    audioExampleBtn: document.getElementById('audio-example-btn'),
    btnAgain: document.getElementById('btn-again'),
    btnMastered: document.getElementById('btn-mastered'),
    topicModal: document.getElementById('topic-modal'),
    topicList: document.getElementById('topic-list'),
    topicSearch: document.getElementById('topic-search'),
    closeTopicModal: document.getElementById('close-topic-modal'),
    // Standby
    standbyOverlay: document.getElementById('standby-overlay'),
    standbyClock: document.getElementById('standby-clock'),
    standbyDate: document.getElementById('standby-date'),
    standbyWord: document.getElementById('standby-word'),
    standbyPhonetic: document.getElementById('standby-phonetic'),
    standbyMeaning: document.getElementById('standby-meaning'),
    standbyTopicTag: document.getElementById('standby-topic-tag'),
    standbyAudioToggle: document.getElementById('standby-audio-toggle'),
    standbyCloseBtn: document.getElementById('standby-close-btn'),
    standbyNextBtn: document.getElementById('standby-next-btn'),
    openStandbyBtn: document.getElementById('open-standby-btn'),
    // Settings & Notif modal
    settingsModal: document.getElementById('settings-modal'),
    closeSettingsModal: document.getElementById('close-settings-modal'),
    openSettingsBtn: document.getElementById('open-settings-btn'),
    notifToggle: document.getElementById('notif-toggle'),
    notifIntervalSelect: document.getElementById('notif-interval-select'),
    testNotifBtn: document.getElementById('test-notif-btn'),
    // Wallpaper Modal
    wallpaperModal: document.getElementById('wallpaper-modal'),
    closeWallpaperModal: document.getElementById('close-wallpaper-modal'),
    openWallpaperBtn: document.getElementById('open-wallpaper-btn'),
    wallpaperCanvas: document.getElementById('wallpaper-canvas'),
    downloadWallpaperBtn: document.getElementById('download-wallpaper-btn'),
    // Dictionary List Modal
    dictModal: document.getElementById('dict-modal'),
    closeDictModal: document.getElementById('close-dict-modal'),
    openDictBtn: document.getElementById('open-dict-btn'),
    dictSearch: document.getElementById('dict-search'),
    dictList: document.getElementById('dict-list'),
    // Quiz View
    quizModal: document.getElementById('quiz-modal'),
    closeQuizModal: document.getElementById('close-quiz-modal'),
    openQuizBtn: document.getElementById('open-quiz-btn'),
    quizWord: document.getElementById('quiz-word'),
    quizPhonetic: document.getElementById('quiz-phonetic'),
    quizOptions: document.getElementById('quiz-options'),
    quizScore: document.getElementById('quiz-score'),
    quizAudioBtn: document.getElementById('quiz-audio-btn'),
    // Navigation items
    navItems: document.querySelectorAll('.nav-item')
  };

  // Initialize Data
  function init() {
    // Apply Theme
    document.documentElement.setAttribute('data-theme', state.theme);
    el.themeBtn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';

    // Load Vocabulary
    if (window.VOCABULARY_DATA && window.VOCABULARY_DATA.length > 0) {
      state.words = window.VOCABULARY_DATA;
    }
    if (window.TOPICS_DATA && window.TOPICS_DATA.length > 0) {
      state.topics = window.TOPICS_DATA;
    }

    // Fallback if js globals not populated
    if (state.words.length === 0) {
      fetch('words.json')
        .then((res) => res.json())
        .then((data) => {
          state.words = data;
          finishInit();
        })
        .catch((err) => console.error('Failed to load words.json', err));
    } else {
      finishInit();
    }
  }

  function finishInit() {
    // Restore chosen topic from storage
    const savedTopic = localStorage.getItem('engvocab_topic') || 'all';
    setTopic(savedTopic, false);

    // Setup Event Listeners
    setupEvents();

    // Render Topics in Selector Modal
    renderTopicList();

    // Initialize Notification Timer if active
    if (state.notificationEnabled) {
      setupNotificationTimer();
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.log('SW registration error:', err);
      });
    }

    // Touch Swipe gestures for Flashcard
    setupSwipeGestures();
  }

  // Topic Selection
  function setTopic(topicIdOrName, save = true) {
    state.currentTopic = topicIdOrName;
    if (save) {
      localStorage.setItem('engvocab_topic', topicIdOrName);
    }

    if (topicIdOrName === 'all') {
      state.filteredWords = [...state.words];
      state.currentTopicName = 'Toàn bộ 3000 từ vựng';
      el.currentTopicIcon.textContent = '🌟';
    } else {
      const topicObj = state.topics.find(
        (t) => t.topic === topicIdOrName || t.fromId.toString() === topicIdOrName
      );
      if (topicObj) {
        state.filteredWords = state.words.filter(
          (w) => w.id >= topicObj.fromId && w.id <= topicObj.toId
        );
        state.currentTopicName = topicObj.topic;
        el.currentTopicIcon.textContent = topicObj.icon;
      } else {
        state.filteredWords = state.words.filter((w) => w.topic === topicIdOrName);
        state.currentTopicName = topicIdOrName;
      }
    }

    // Shuffle or sort
    state.currentIndex = 0;
    state.isFlipped = false;
    el.cardWrapper.classList.remove('flipped');

    el.currentTopicName.textContent = state.currentTopicName;
    el.currentTopicCount.textContent = `${state.filteredWords.length} từ`;

    renderCard();
  }

  function renderTopicList(filterText = '') {
    el.topicList.innerHTML = '';

    // "All Topics" option first
    const allDiv = document.createElement('div');
    allDiv.className = `topic-item ${state.currentTopic === 'all' ? 'active' : ''}`;
    allDiv.innerHTML = `
      <div class="topic-item-left">
        <span style="font-size:22px;">🌟</span>
        <div>
          <div class="topic-item-name">Toàn bộ 3000 từ vựng</div>
          <div style="font-size:12px;color:var(--text-secondary);">Học ngẫu nhiên mọi chủ đề</div>
        </div>
      </div>
      <span class="topic-item-count">${state.words.length} từ</span>
    `;
    allDiv.addEventListener('click', () => {
      setTopic('all');
      closeModal(el.topicModal);
    });
    el.topicList.appendChild(allDiv);

    // Filtered topics
    const q = filterText.toLowerCase().trim();
    state.topics.forEach((t) => {
      if (q && !t.topic.toLowerCase().includes(q)) return;

      const item = document.createElement('div');
      item.className = `topic-item ${state.currentTopic === t.topic ? 'active' : ''}`;
      item.innerHTML = `
        <div class="topic-item-left">
          <span style="font-size:22px;">${t.icon}</span>
          <div>
            <div class="topic-item-name">${t.topic}</div>
            <div style="font-size:12px;color:var(--text-secondary);">Từ #${t.fromId} đến #${t.toId}</div>
          </div>
        </div>
        <span class="topic-item-count">${t.count} từ</span>
      `;
      item.addEventListener('click', () => {
        setTopic(t.topic);
        closeModal(el.topicModal);
      });
      el.topicList.appendChild(item);
    });
  }

  // Flashcard Rendering
  function renderCard() {
    if (!state.filteredWords || state.filteredWords.length === 0) {
      el.cardWord.textContent = 'Không có từ';
      el.cardIpa.textContent = '';
      el.cardPhonetic.textContent = '';
      el.cardStressGuide.textContent = '';
      return;
    }

    const word = state.filteredWords[state.currentIndex];
    const total = state.filteredWords.length;
    const currentNum = state.currentIndex + 1;

    // Counter & Progress
    el.cardCounter.textContent = `${currentNum} / ${total}`;
    el.progressFill.style.width = `${(currentNum / total) * 100}%`;

    // Reset Flip
    state.isFlipped = false;
    el.cardWrapper.classList.remove('flipped');

    // Front details
    el.cardTopic.textContent = `${word.icon || '📚'} ${word.topic}`;
    el.cardWord.textContent = word.word;
    el.cardIpa.textContent = word.ipa || '';

    // Render Stress Highlighted Phonetic (e.g. É-lơ-phừnt)
    renderHighlightedPhonetic(word.vnPhonetic, el.cardPhonetic);
    el.cardStressGuide.textContent = word.stressGuide || 'Phát âm tự nhiên';

    // Star icon state
    el.cardStar.textContent = state.starred.has(word.id) ? '⭐' : '☆';
    el.cardStar.style.color = state.starred.has(word.id) ? '#f59e0b' : 'var(--text-muted)';

    // Back details
    el.backMeaning.textContent = word.meaning || 'Chưa cập nhật nghĩa';
    el.backType.textContent = word.type ? `Từ loại: (${word.type})` : '';

    // Example sentence
    const exampleSentence = generateExampleSentence(word);
    el.backExample.textContent = `"${exampleSentence}"`;

    // Auto update wallpaper if modal open
    if (el.wallpaperModal.classList.contains('active')) {
      drawWallpaperCanvas(word);
    }
  }

  // Format and highlight stressed syllable
  function renderHighlightedPhonetic(phoneticStr, containerEl) {
    if (!phoneticStr) {
      containerEl.textContent = '';
      return;
    }
    containerEl.innerHTML = '';
    const parts = phoneticStr.split('-');
    parts.forEach((p, index) => {
      // Check if uppercase syllable (stressed)
      const isUpper = p === p.toUpperCase() && p !== p.toLowerCase();
      const span = document.createElement('span');
      span.textContent = p;
      if (isUpper) {
        span.style.color = '#f59e0b';
        span.style.fontWeight = '900';
        span.style.textDecoration = 'underline';
        span.style.textUnderlineOffset = '4px';
        span.style.fontSize = '1.08em';
      } else {
        span.style.opacity = '0.9';
      }
      containerEl.appendChild(span);
      if (index < parts.length - 1) {
        const hyphen = document.createElement('span');
        hyphen.textContent = ' - ';
        hyphen.style.opacity = '0.4';
        containerEl.appendChild(hyphen);
      }
    });
  }

  function generateExampleSentence(word) {
    const w = word.word;
    const dict = {
      elephant: 'The elephant is known for its remarkable memory.',
      banana: 'Eating a banana gives you instant energy.',
      apple: 'An apple a day keeps the doctor away.',
      chicken: 'We had roast chicken with fresh vegetables for dinner.',
      dog: 'The loyal dog waited happily by the door.',
      cat: 'The cat curled up softly on the warm sofa.',
      coffee: 'A hot cup of coffee helps me focus in the morning.',
      computer: 'I use my computer to work and learn English every day.',
      beautiful: 'The sunset over the beach was absolutely beautiful.',
      delicious: 'The food prepared by the chef was very delicious.'
    };
    return dict[w.toLowerCase()] || `I am learning the word "${w}" today.`;
  }

  // Pronunciation Audio (Web Speech + Oxford API Fallback)
  function playAudio(text, rate = 1.0) {
    if (!text) return;

    // 1. Try Free Dictionary API audio if available
    const cleanWord = text.trim().toLowerCase().replace(/[^a-z]/g, '');
    if (state.audioCache[cleanWord]) {
      const audio = new Audio(state.audioCache[cleanWord]);
      audio.playbackRate = rate;
      audio.play().catch(() => speakWithWebSpeech(text, rate));
      return;
    }

    // 2. Web Speech API (Native iOS Siri / Samantha voice)
    speakWithWebSpeech(text, rate);

    // Fetch API audio in background for future fast caching
    if (!state.audioCache[cleanWord] && cleanWord.length > 1) {
      fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${cleanWord}`)
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data[0]?.phonetics) {
            const phon = data[0].phonetics.find((p) => p.audio && p.audio.length > 0);
            if (phon) {
              state.audioCache[cleanWord] = phon.audio;
            }
          }
        })
        .catch(() => {});
    }
  }

  function speakWithWebSpeech(text, rate = 1.0) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = rate;

    // Pick best English voice on iOS if available
    const voices = window.speechSynthesis.getVoices();
    const enVoice = voices.find(
      (v) =>
        (v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Siri') ||
          v.lang === 'en-US') &&
        !v.name.includes('es-')
    );
    if (enVoice) {
      utterance.voice = enVoice;
    }

    window.speechSynthesis.speak(utterance);
  }

  // Next / Previous Navigation
  function nextWord(isMastered = null) {
    if (state.filteredWords.length === 0) return;
    const currentWord = state.filteredWords[state.currentIndex];

    if (isMastered === true) {
      state.mastered.add(currentWord.id);
      state.needsReview.delete(currentWord.id);
    } else if (isMastered === false) {
      state.needsReview.add(currentWord.id);
      state.mastered.delete(currentWord.id);
    }
    saveProgress();

    state.currentIndex = (state.currentIndex + 1) % state.filteredWords.length;
    renderCard();
  }

  function prevWord() {
    if (state.filteredWords.length === 0) return;
    state.currentIndex =
      (state.currentIndex - 1 + state.filteredWords.length) % state.filteredWords.length;
    renderCard();
  }

  function saveProgress() {
    localStorage.setItem('engvocab_mastered', JSON.stringify(Array.from(state.mastered)));
    localStorage.setItem('engvocab_review', JSON.stringify(Array.from(state.needsReview)));
    localStorage.setItem('engvocab_starred', JSON.stringify(Array.from(state.starred)));
  }

  // StandBy Mode (Màn hình chờ học từ khi sạc điện thoại)
  function startStandby() {
    state.standbyActive = true;
    el.standbyOverlay.classList.add('active');

    updateStandbyClock();
    updateStandbyCard();

    // Start timer for clock
    const clockInterval = setInterval(() => {
      if (!state.standbyActive) {
        clearInterval(clockInterval);
        return;
      }
      updateStandbyClock();
    }, 1000);

    // Auto cycle words
    state.standbyTimer = setInterval(() => {
      if (!state.standbyActive) return;
      nextWord();
      updateStandbyCard();
    }, state.standbyIntervalSec * 1000);
  }

  function stopStandby() {
    state.standbyActive = false;
    el.standbyOverlay.classList.remove('active');
    if (state.standbyTimer) {
      clearInterval(state.standbyTimer);
      state.standbyTimer = null;
    }
  }

  function updateStandbyClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    el.standbyClock.textContent = `${hours}:${minutes}:${seconds}`;

    const days = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dayName = days[now.getDay()];
    el.standbyDate.textContent = `${dayName}, ngày ${now.getDate()} tháng ${now.getMonth() + 1}`;
  }

  function updateStandbyCard() {
    if (!state.filteredWords || state.filteredWords.length === 0) return;
    const word = state.filteredWords[state.currentIndex];

    el.standbyTopicTag.textContent = `${word.icon || '📚'} ${word.topic}`;
    el.standbyWord.textContent = word.word;
    renderHighlightedPhonetic(word.vnPhonetic, el.standbyPhonetic);
    el.standbyMeaning.textContent = word.meaning;

    if (state.standbyAutoVoice) {
      playAudio(word.word, 0.9);
    }
  }

  // Notifications for Lock Screen (Màn hình khóa)
  function setupNotificationTimer() {
    if (state.notificationTimer) {
      clearInterval(state.notificationTimer);
      state.notificationTimer = null;
    }

    if (!state.notificationEnabled) return;

    const intervalMs = state.notificationIntervalMin * 60 * 1000;
    state.notificationTimer = setInterval(() => {
      sendLockScreenNotification();
    }, intervalMs);
  }

  function sendLockScreenNotification() {
    if (Notification.permission !== 'granted') return;
    if (!state.filteredWords || state.filteredWords.length === 0) return;

    // Pick random word from today's topic
    const randomIndex = Math.floor(Math.random() * state.filteredWords.length);
    const word = state.filteredWords[randomIndex];

    const title = `🔔 [${word.word}] ${word.ipa || ''}`;
    const options = {
      body: `👉 Bồi: ${word.vnPhonetic}\n📖 Nghĩa: ${word.meaning}\n💡 ${word.stressGuide}`,
      icon: 'icon.svg',
      badge: 'icon.svg',
      tag: 'vocab-reminder',
      requireInteraction: false
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  }

  // Wallpaper Generator (Xuất ảnh thẻ từ cho iPhone Photo Shuffle)
  function drawWallpaperCanvas(word) {
    const canvas = el.wallpaperCanvas;
    const ctx = canvas.getContext('2d');
    const width = 1170;
    const height = 2532;
    canvas.width = width;
    canvas.height = height;

    // AMOLED Black background
    ctx.fillStyle = '#050811';
    ctx.fillRect(0, 0, width, height);

    // Subtle gradient radial glow
    const grad = ctx.createRadialGradient(width / 2, height / 2 - 100, 50, width / 2, height / 2 - 100, 600);
    grad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    grad.addColorStop(1, 'rgba(5, 8, 17, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Header Tag
    ctx.fillStyle = '#64748b';
    ctx.font = '600 36px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${word.icon || '📚'} ${word.topic}`.toUpperCase(), width / 2, 700);

    // Main Word
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 120px -apple-system, sans-serif';
    ctx.fillText(word.word, width / 2, 880);

    // IPA
    ctx.fillStyle = '#94a3b8';
    ctx.font = '500 52px "Lucida Sans Unicode", -apple-system, sans-serif';
    ctx.fillText(word.ipa || '', width / 2, 980);

    // Vietnamese Phonetic (Stressed) Box
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.roundRect(width / 2 - 380, 1050, 760, 160, 30);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font = '700 30px -apple-system, sans-serif';
    ctx.fillText('PHIÊN ÂM BỒI CÓ TRỌNG ÂM', width / 2, 1105);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 60px -apple-system, sans-serif';
    ctx.fillText(word.vnPhonetic, width / 2, 1175);

    // Stress Guide
    ctx.fillStyle = '#fbbf24';
    ctx.font = '500 36px -apple-system, sans-serif';
    ctx.fillText(`👉 ${word.stressGuide}`, width / 2, 1270);

    // Meaning
    ctx.fillStyle = '#38bdf8';
    ctx.font = '800 72px -apple-system, sans-serif';
    ctx.fillText(word.meaning, width / 2, 1420);

    // Footer Info
    ctx.fillStyle = '#475569';
    ctx.font = '500 32px -apple-system, sans-serif';
    ctx.fillText('EngVocab 3000 • Tiếng Anh Giao Tiếp', width / 2, height - 200);
  }

  // Quiz Mode Logic
  let currentQuizWord = null;
  let quizScore = 0;

  function startQuiz() {
    quizScore = 0;
    el.quizScore.textContent = `Điểm: ${quizScore}`;
    openModal(el.quizModal);
    loadNextQuizQuestion();
  }

  function loadNextQuizQuestion() {
    if (!state.filteredWords || state.filteredWords.length === 0) return;

    // Pick 1 target word
    const target = state.filteredWords[Math.floor(Math.random() * state.filteredWords.length)];
    currentQuizWord = target;

    el.quizWord.textContent = target.word;
    renderHighlightedPhonetic(target.vnPhonetic, el.quizPhonetic);

    // Pick 3 distractors
    const distractors = [];
    const pool = state.filteredWords.filter((w) => w.id !== target.id);
    while (distractors.length < 3 && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      distractors.push(pool.splice(idx, 1)[0].meaning);
    }

    const options = [target.meaning, ...distractors].sort(() => Math.random() - 0.5);

    el.quizOptions.innerHTML = '';
    options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'topic-selector-btn';
      btn.style.marginBottom = '10px';
      btn.style.padding = '16px 20px';
      btn.style.fontSize = '16px';
      btn.style.fontWeight = '600';
      btn.textContent = opt;

      btn.addEventListener('click', () => {
        if (opt === target.meaning) {
          btn.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';
          btn.style.borderColor = '#10b981';
          quizScore += 10;
          el.quizScore.textContent = `Điểm: ${quizScore} 🔥`;
          playAudio(target.word, 1.0);
          setTimeout(loadNextQuizQuestion, 1000);
        } else {
          btn.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
          btn.style.borderColor = '#ef4444';
        }
      });
      el.quizOptions.appendChild(btn);
    });
  }

  // Modal helpers
  function openModal(modalEl) {
    modalEl.classList.add('active');
  }

  function closeModal(modalEl) {
    modalEl.classList.remove('active');
  }

  // Swipe Gestures for iPhone
  function setupSwipeGestures() {
    let touchStartX = 0;
    let touchStartY = 0;
    let touchEndX = 0;
    let touchEndY = 0;

    const card = el.cardWrapper;
    card.addEventListener(
      'touchstart',
      (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      },
      { passive: true }
    );

    card.addEventListener(
      'touchend',
      (e) => {
        touchEndX = e.changedTouches[0].screenX;
        touchEndY = e.changedTouches[0].screenY;
        handleSwipe();
      },
      { passive: true }
    );

    function handleSwipe() {
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;

      // Ignore vertical scrolling
      if (Math.abs(diffY) > Math.abs(diffX)) return;

      if (diffX > 80) {
        // Swiped right -> Mastered
        nextWord(true);
      } else if (diffX < -80) {
        // Swiped left -> Review
        nextWord(false);
      }
    }
  }

  // Setup Event Listeners
  function setupEvents() {
    // Flip Card on Tap
    el.cardWrapper.addEventListener('click', (e) => {
      // Don't flip if clicked audio or star
      if (e.target.closest('.audio-btn') || e.target.closest('#card-star')) return;
      state.isFlipped = !state.isFlipped;
      el.cardWrapper.classList.toggle('flipped', state.isFlipped);
    });

    // Audio Buttons
    el.audioNormalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = state.filteredWords[state.currentIndex];
      if (word) playAudio(word.word, 1.0);
    });

    el.audioSlowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = state.filteredWords[state.currentIndex];
      if (word) playAudio(word.word, 0.7);
    });

    el.audioExampleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = state.filteredWords[state.currentIndex];
      if (word) playAudio(generateExampleSentence(word), 0.9);
    });

    // Star Button
    el.cardStar.addEventListener('click', (e) => {
      e.stopPropagation();
      const word = state.filteredWords[state.currentIndex];
      if (!word) return;
      if (state.starred.has(word.id)) {
        state.starred.delete(word.id);
      } else {
        state.starred.add(word.id);
      }
      saveProgress();
      el.cardStar.textContent = state.starred.has(word.id) ? '⭐' : '☆';
      el.cardStar.style.color = state.starred.has(word.id) ? '#f59e0b' : 'var(--text-muted)';
    });

    // Mastered & Again Buttons
    el.btnMastered.addEventListener('click', () => nextWord(true));
    el.btnAgain.addEventListener('click', () => nextWord(false));

    // Theme Toggle
    el.themeBtn.addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('engvocab_theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
      el.themeBtn.innerHTML = state.theme === 'dark' ? '☀️' : '🌙';
    });

    // Topic Selector Modals
    el.topicBtn.addEventListener('click', () => openModal(el.topicModal));
    el.closeTopicModal.addEventListener('click', () => closeModal(el.topicModal));
    el.topicModal.addEventListener('click', (e) => {
      if (e.target === el.topicModal) closeModal(el.topicModal);
    });
    el.topicSearch.addEventListener('input', (e) => renderTopicList(e.target.value));

    // StandBy View Controls
    el.openStandbyBtn.addEventListener('click', startStandby);
    el.standbyCloseBtn.addEventListener('click', stopStandby);
    el.standbyNextBtn.addEventListener('click', () => {
      nextWord();
      updateStandbyCard();
    });
    el.standbyAudioToggle.addEventListener('click', () => {
      state.standbyAutoVoice = !state.standbyAutoVoice;
      localStorage.setItem('engvocab_standby_voice', state.standbyAutoVoice);
      el.standbyAudioToggle.style.color = state.standbyAutoVoice ? '#38bdf8' : '#94a3b8';
    });

    // Settings Modal
    el.openSettingsBtn.addEventListener('click', () => openModal(el.settingsModal));
    el.closeSettingsModal.addEventListener('click', () => closeModal(el.settingsModal));
    el.settingsModal.addEventListener('click', (e) => {
      if (e.target === el.settingsModal) closeModal(el.settingsModal);
    });

    // Notification Toggles
    el.notifToggle.checked = state.notificationEnabled;
    el.notifToggle.addEventListener('change', async (e) => {
      if (e.target.checked) {
        if ('Notification' in window) {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            state.notificationEnabled = true;
            localStorage.setItem('engvocab_notif_enabled', 'true');
            setupNotificationTimer();
            sendLockScreenNotification();
          } else {
            e.target.checked = false;
            alert('Vui lòng cho phép quyền Thông báo trên iPhone để nhận từ vựng!');
          }
        }
      } else {
        state.notificationEnabled = false;
        localStorage.setItem('engvocab_notif_enabled', 'false');
        if (state.notificationTimer) clearInterval(state.notificationTimer);
      }
    });

    el.notifIntervalSelect.value = state.notificationIntervalMin.toString();
    el.notifIntervalSelect.addEventListener('change', (e) => {
      state.notificationIntervalMin = parseInt(e.target.value, 10);
      localStorage.setItem('engvocab_notif_min', state.notificationIntervalMin.toString());
      if (state.notificationEnabled) setupNotificationTimer();
    });

    el.testNotifBtn.addEventListener('click', () => {
      if (Notification.permission === 'granted') {
        sendLockScreenNotification();
      } else {
        Notification.requestPermission().then((p) => {
          if (p === 'granted') sendLockScreenNotification();
        });
      }
    });

    // Wallpaper Modal
    el.openWallpaperBtn.addEventListener('click', () => {
      const currentWord = state.filteredWords[state.currentIndex];
      if (currentWord) drawWallpaperCanvas(currentWord);
      openModal(el.wallpaperModal);
    });
    el.closeWallpaperModal.addEventListener('click', () => closeModal(el.wallpaperModal));
    el.wallpaperModal.addEventListener('click', (e) => {
      if (e.target === el.wallpaperModal) closeModal(el.wallpaperModal);
    });
    el.downloadWallpaperBtn.addEventListener('click', () => {
      const link = document.createElement('a');
      link.download = `wallpaper-${state.filteredWords[state.currentIndex]?.word || 'vocab'}.png`;
      link.href = el.wallpaperCanvas.toDataURL('image/png');
      link.click();
    });

    // Quiz View
    el.openQuizBtn.addEventListener('click', startQuiz);
    el.closeQuizModal.addEventListener('click', () => closeModal(el.quizModal));
    el.quizModal.addEventListener('click', (e) => {
      if (e.target === el.quizModal) closeModal(el.quizModal);
    });
    el.quizAudioBtn.addEventListener('click', () => {
      if (currentQuizWord) playAudio(currentQuizWord.word, 1.0);
    });

    // Dictionary Search Modal
    el.openDictBtn.addEventListener('click', () => {
      renderDictList();
      openModal(el.dictModal);
    });
    el.closeDictModal.addEventListener('click', () => closeModal(el.dictModal));
    el.dictModal.addEventListener('click', (e) => {
      if (e.target === el.dictModal) closeModal(el.dictModal);
    });
    el.dictSearch.addEventListener('input', (e) => renderDictList(e.target.value));

    // Bottom Navigation switching
    el.navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        el.navItems.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const action = btn.getAttribute('data-nav');
        if (action === 'flashcard') {
          // main flashcard
        } else if (action === 'standby') {
          startStandby();
        } else if (action === 'quiz') {
          startQuiz();
        } else if (action === 'dict') {
          renderDictList();
          openModal(el.dictModal);
        } else if (action === 'settings') {
          openModal(el.settingsModal);
        }
      });
    });
  }

  function renderDictList(q = '') {
    el.dictList.innerHTML = '';
    const query = q.toLowerCase().trim();
    const matches = state.words
      .filter((w) => !query || w.word.toLowerCase().includes(query) || w.meaning.toLowerCase().includes(query))
      .slice(0, 100);

    matches.forEach((w) => {
      const row = document.createElement('div');
      row.className = 'topic-item';
      row.innerHTML = `
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:8px;">
            <strong style="font-size:16px;">${w.word}</strong>
            <span style="font-size:12px;color:var(--text-secondary);">${w.ipa || ''}</span>
          </div>
          <div style="font-size:12px;color:#f59e0b;font-weight:600;margin-top:2px;">${w.vnPhonetic}</div>
          <div style="font-size:13px;color:var(--text-primary);margin-top:2px;">${w.meaning}</div>
        </div>
        <button class="icon-btn" style="width:32px;height:32px;font-size:14px;">🔊</button>
      `;
      row.querySelector('button').addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio(w.word, 1.0);
      });
      row.addEventListener('click', () => {
        // jump to this word in main deck
        const idx = state.filteredWords.findIndex((item) => item.id === w.id);
        if (idx >= 0) {
          state.currentIndex = idx;
        } else {
          // set topic to all and jump
          setTopic('all');
          state.currentIndex = state.filteredWords.findIndex((item) => item.id === w.id);
        }
        renderCard();
        closeModal(el.dictModal);
      });
      el.dictList.appendChild(row);
    });
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
