// ===========================================
// script.js — diagnostics + robust rendering
// ===========================================

window.resetDeck = function () {
  window.deck = window.__DECK_SNAPSHOT__.map((card) => ({ ...card }));
};

const MUSIC_TRACKS = [
  "music/andy-spragg-01-chunky.mp3",
  "music/andy-spragg-02-rain.mp3",
  "music/andy-spragg-03-picky.mp3",
  "music/andy-spragg-04-basshumm.mp3",
  "music/andy-spragg-05-buzzedaldrin.mp3",
];

let currentMusicTrackIndex = -1;
let musicRetryPending = false;
let musicRetryHandler = null;
let musicEnabled = true;
let tooltipsEnabled = true;

function clearMusicRetry() {
  if (musicRetryHandler) {
    document.removeEventListener("pointerdown", musicRetryHandler);
    document.removeEventListener("keydown", musicRetryHandler);
  }
  musicRetryHandler = null;
  musicRetryPending = false;
}

function queueMusicRetry() {
  if (!musicEnabled || musicRetryPending) return;
  musicRetryPending = true;

  musicRetryHandler = () => {
    clearMusicRetry();
    if (musicEnabled) startBackgroundMusic();
  };

  document.addEventListener("pointerdown", musicRetryHandler, { once: true });
  document.addEventListener("keydown", musicRetryHandler, { once: true });
}

function chooseRandomMusicTrack() {
  if (MUSIC_TRACKS.length === 1) return 0;

  let nextIndex;
  do {
    nextIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
  } while (nextIndex === currentMusicTrackIndex);

  return nextIndex;
}

async function playRandomMusicTrack() {
  const audio = document.getElementById("backgroundMusic");
  if (!audio || !musicEnabled) return;

  currentMusicTrackIndex = chooseRandomMusicTrack();
  audio.src = MUSIC_TRACKS[currentMusicTrackIndex];
  audio.volume = 0.35;

  try {
    await audio.play();
  } catch (error) {
    console.warn(
      "[DSG] Music playback is waiting for another user interaction.",
      error,
    );
    queueMusicRetry();
  }
}

async function startBackgroundMusic() {
  const audio = document.getElementById("backgroundMusic");
  if (!audio || !musicEnabled || !audio.paused) return;

  if (!audio.getAttribute("src")) {
    playRandomMusicTrack();
    return;
  }

  try {
    await audio.play();
  } catch (error) {
    console.warn(
      "[DSG] Music playback is waiting for another user interaction.",
      error,
    );
    queueMusicRetry();
  }
}

function updateMusicToggleUI() {
  const toggle = document.getElementById("musicToggle");
  if (!toggle) return;

  toggle.classList.toggle("is-off", !musicEnabled);
  toggle.setAttribute("aria-pressed", String(musicEnabled));
  toggle.textContent = musicEnabled ? "MUSIC: ON" : "MUSIC: OFF";
  toggle.title = musicEnabled ? "Turn music off" : "Turn music on";
}

function setMusicEnabled(enabled) {
  musicEnabled = enabled;
  const audio = document.getElementById("backgroundMusic");

  if (musicEnabled) {
    startBackgroundMusic();
  } else {
    clearMusicRetry();
    if (audio) audio.pause();
  }

  updateMusicToggleUI();
}

const backgroundMusic = document.getElementById("backgroundMusic");
if (backgroundMusic) {
  backgroundMusic.addEventListener("ended", () => {
    if (musicEnabled) playRandomMusicTrack();
  });
}

const musicToggle = document.getElementById("musicToggle");
if (musicToggle) {
  musicToggle.addEventListener("click", () => {
    setMusicEnabled(!musicEnabled);
  });
}
updateMusicToggleUI();

function updateTooltipsToggleUI() {
  const toggle = document.getElementById("tooltipsToggle");
  if (!toggle) return;

  toggle.classList.toggle("is-off", !tooltipsEnabled);
  toggle.setAttribute("aria-pressed", String(tooltipsEnabled));
  toggle.textContent = tooltipsEnabled ? "TOOLTIPS: ON" : "TOOLTIPS: OFF";
  toggle.title = tooltipsEnabled
    ? "Turn tooltips off"
    : "Turn tooltips on";
}

function setTooltipsEnabled(enabled) {
  tooltipsEnabled = enabled;
  if (!tooltipsEnabled) hideEventActionTooltip();
  updateTooltipsToggleUI();
}

const tooltipsToggle = document.getElementById("tooltipsToggle");
if (tooltipsToggle) {
  tooltipsToggle.addEventListener("click", () => {
    setTooltipsEnabled(!tooltipsEnabled);
  });
}
updateTooltipsToggleUI();

let sfxAudioContext = null;

function getSfxAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sfxAudioContext) sfxAudioContext = new AudioContextClass();
  return sfxAudioContext;
}

function playSfxTone(
  context,
  {
    start = context.currentTime,
    frequency,
    endFrequency = frequency,
    duration,
    volume,
    wave = "sine",
  },
) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(frequency, start);
  oscillator.frequency.exponentialRampToValueAtTime(
    endFrequency,
    start + duration,
  );
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function playSkipFlick(context, start) {
  const duration = 0.065;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index++) {
    const fade = 1 - index / samples.length;
    samples[index] = (Math.random() * 2 - 1) * fade;
  }

  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  source.buffer = buffer;
  filter.type = "highpass";
  filter.frequency.setValueAtTime(850, start);
  gain.gain.setValueAtTime(0.018, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(context.destination);
  source.start(start);
}

function playCardSfx(kind) {
  const context = getSfxAudioContext();
  if (!context) return;

  const scheduleSound = () => {
    const start = context.currentTime;
    const backgroundMusic = document.getElementById("backgroundMusic");

    // Briefly make room in the mix so the cue remains audible on small speakers.
    if (backgroundMusic && !backgroundMusic.paused) {
      const normalMusicVolume = 0.35;
      backgroundMusic.volume = 0.22;
      window.setTimeout(() => {
        backgroundMusic.volume = normalMusicVolume;
      }, 180);
    }

    if (kind === "choice") {
      playSfxTone(context, {
        start,
        frequency: 440,
        endFrequency: 523.25,
        duration: 0.075,
        volume: 0.075,
      });
      playSfxTone(context, {
        start: start + 0.045,
        frequency: 659.25,
        duration: 0.085,
        volume: 0.055,
      });
    } else if (kind === "event") {
      playSfxTone(context, {
        start,
        frequency: 196,
        endFrequency: 146.83,
        duration: 0.12,
        volume: 0.085,
        wave: "triangle",
      });
    } else if (kind === "skip") {
      playSkipFlick(context, start);
      playSfxTone(context, {
        start,
        frequency: 220,
        endFrequency: 110,
        duration: 0.065,
        volume: 0.065,
        wave: "triangle",
      });
    } else {
      playSfxTone(context, {
        start,
        frequency: 329.63,
        endFrequency: 440,
        duration: 0.085,
        volume: 0.075,
        wave: "triangle",
      });
    }
  };

  if (context.state === "suspended") {
    context.resume().then(scheduleSound).catch(() => {});
  } else {
    scheduleSound();
  }
}

function getCardSfxType(card) {
  if (CHOICE_CARD_OPTIONS[card.id]) return "choice";
  return card.type === "event" ? "event" : "action";
}

// close intre screen
document.getElementById("closeIntro").addEventListener("click", () => {
  startBackgroundMusic();
  const intro = document.getElementById("intro");
  intro.style.opacity = 0;
  intro.style.transition = "opacity 0.4s ease";
  setTimeout(() => (intro.style.display = "none"), 400);
});

// feedback button
document.getElementById("feedbackButton").addEventListener("click", () => {
  window.open(
    "https://docs.google.com/forms/d/e/1FAIpQLSeTkcLmuXXczUbDJPjv2-Dqp1tEeQAXnwiQE5kL2iYgmfYl5w/viewform?usp=publish-editor",
    "_blank",
  );
});

// play again
document.getElementById("resetButton").addEventListener("click", () => {
  gameResultsShown = false;
  activeHandIndex = 0;
  cardTransitionInProgress = false;
  closeSkipConfirmation();
  window.playerChoices = {};
  skippedChoiceCardIds.clear();
  resetSkipToken();
  clearEventImpactNotices();
  // reset players
  playerName = pickRandom(playerNames);
  AI1Name = pickRandom(ai1Names);
  AI2Name = generateAI2Name();

  player = {
    name: playerName,
    hand: [],
    progress: 1,
    sustainability: 0,
    technophilia: 0,
    choicesMade: 0,
    actionsPlayed: new Set(),
    eventsPlayed: new Set(),
  };
  AI1 = {
    name: AI1Name,
    hand: [],
    progress: 1,
    sustainability: 0,
    actionsPlayed: new Set(),
    eventsPlayed: new Set(),
  };
  AI2 = {
    name: AI2Name,
    hand: [],
    progress: 1,
    sustainability: 0,
    actionsPlayed: new Set(),
    eventsPlayed: new Set(),
  };
  updateIntroCompanyName();

  // empty aiLog
  const aiLogDiv = el("aiLog");
  aiLogDiv.innerHTML = "";

  //reset deck
  window.resetDeck();
  if (Array.isArray(window.deck) && window.deck.length > 0) {
    initCardLookup();
    prepareSubdecks();
    dealOpeningHands();
    console.log(
      "[DSG] Dealt hands — player:",
      player.hand.length,
      "AI1:",
      AI1.hand.length,
      "AI2:",
      AI2.hand.length,
    );
    console.log("[DSG] Top of deck after deal:", deck.slice(-3));
  } else {
    console.warn("[DSG] Skipping deal because deck is missing/empty.");
  }

  renderPlayerHand();
  updateGameInfo();
  updatePlayedLists();
  updateSkipUI();

  // Set AI labels (matches YOUR HTML IDs). Falls back to alternative IDs if present.
  const a1Header = el("ai1ActionsHeader") || el("ai1ActionsLabel");
  const a1EHeader = el("ai1EventsHeader") || el("ai1EventsLabel");
  const a2Header = el("ai2ActionsHeader") || el("ai2ActionsLabel");
  const a2EHeader = el("ai2EventsHeader") || el("ai2EventsLabel");

  if (a1Header) a1Header.textContent = `${AI1.name} Actions Played`;
  if (a1EHeader) a1EHeader.textContent = `${AI1.name} Events Played`;
  if (a2Header) a2Header.textContent = `${AI2.name} Actions Played`;
  if (a2EHeader) a2EHeader.textContent = `${AI2.name} Events Played`;

  console.log("[DSG] Boot end");

  const intro = document.getElementById("outro");
  intro.style.opacity = 0;
  intro.style.transition = "opacity 0.4s ease";
  setTimeout(() => (intro.style.display = "none"), 400);
});

// --- Random name pools ---
const playerNames = [
  "The Von Spigot Studio",
  "LEAF Consulting",
  "Haunted Hill Inc.",
  "First City Bank",
  "Baker Baker & McKenzie LLP",
  "The Museum of Lost Socks",
  "Live Laugh Love Larp Lol Logout",
  "The World Wrestling Consortium",
];

const ai1Names = [
  "Business Systems Systems",
  "Lozenge AI",
  "Digital Sales Insight",
  "Hypercircle",
  "Noxio Box Toxic Storage Solutions",
  "Adjaye Jones & Cronk LLP",
  "Distributed Fusion Inc",
  "B.Well",
  "Total Cashflow Solutions",
  "The Data Doulas",
];

// --- Helpers ---
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function el(id) {
  return document.getElementById(id);
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

let skipAvailable = true;
let skipArmed = false;
let skipReplacementInProgress = false;
let skipPointerX = 0;
let skipPointerY = 0;
let activeHandIndex = 0;
let cardTransitionInProgress = false;
let suppressCardClickUntil = 0;
let lastTouchTap = { time: 0, index: -1 };

function updateSkipUI() {
  const token = el("skipToken");
  const cursorBadge = el("skipCursor");

  if (token) {
    token.disabled = !skipAvailable;
    token.classList.toggle("is-armed", skipArmed);
    token.setAttribute("aria-pressed", String(skipArmed));
    token.textContent = "SKIP";
    token.title = !skipAvailable
      ? "The one-use skip has been used"
      : "Skip the current card (or double-tap the card)";
  }

  document.body.classList.toggle("skip-armed", skipArmed);

  if (cursorBadge) {
    cursorBadge.style.display = skipArmed ? "block" : "none";
    cursorBadge.style.left = `${skipPointerX}px`;
    cursorBadge.style.top = `${skipPointerY}px`;
  }
}

function setSkipArmed(armed) {
  skipArmed = skipAvailable && armed;
  updateSkipUI();
}

function resetSkipToken() {
  skipAvailable = true;
  skipArmed = false;
  updateSkipUI();
}

function consumeSkipToken() {
  skipAvailable = false;
  skipArmed = false;
  updateSkipUI();
}

function restoreSkipToken() {
  skipAvailable = true;
  skipArmed = false;
  updateSkipUI();
}

const skipToken = el("skipToken");
if (skipToken) {
  skipToken.addEventListener("click", () => {
    if (skipAvailable) requestSkipConfirmation(activeHandIndex);
  });
}

let pendingSkipIndex = null;

function closeSkipConfirmation() {
  const modal = el("skipConfirmModal");
  if (!modal) return;
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  pendingSkipIndex = null;
}

function requestSkipConfirmation(index = activeHandIndex) {
  if (!skipAvailable || skipReplacementInProgress) return;
  const selectedCard = player?.hand?.[index];
  const modal = el("skipConfirmModal");
  const question = el("skipConfirmQuestion");
  if (!selectedCard || !modal || !question) return;
  pendingSkipIndex = index;
  const cardName = selectedCard.name.replace(/^\d+:\s*/, "");
  const subplotWarning = selectedCard.isSubplot
    ? " This will also end this story thread."
    : "";
  question.textContent = `Discard “${cardName}” and draw a replacement? This uses your one available skip.${subplotWarning}`;
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
  requestAnimationFrame(() => el("cancelSkipButton")?.focus());
}

el("cancelSkipButton")?.addEventListener("click", closeSkipConfirmation);
el("confirmSkipButton")?.addEventListener("click", () => {
  const index = pendingSkipIndex;
  closeSkipConfirmation();
  if (index !== null) skipPlayerCard(index);
});
el("skipConfirmModal")?.addEventListener("click", (event) => {
  if (event.target === event.currentTarget) closeSkipConfirmation();
});

window.addEventListener("pointermove", (event) => {
  skipPointerX = event.clientX;
  skipPointerY = event.clientY;
  if (skipArmed) updateSkipUI();
});

window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (el("skipConfirmModal")?.style.display === "flex") closeSkipConfirmation();
  else if (skipArmed) setSkipArmed(false);
});

function generateAI2Name() {
  const buzzwords = [
    "Synergy",
    "Quantum",
    "Hyper",
    "Total",
    "Future",
    "Ultra",
    "Virtual",
    "Dynamic",
    "Cloud",
    "Carbon",
    "Crypto",
    "Green",
  ];
  const techTerms = [
    "Solutions",
    "Systems",
    "Analytics",
    "Intelligence",
    "Optimisation",
    "Flow",
    "Interface",
    "Blockchain",
    "Fusion",
    "Comms",
    "Matrix",
    "Ops",
  ];
  const suffixes = [
    "Inc.",
    "LLP",
    "LLC",
    "Group",
    "Associates",
    "Holdings",
    "Consortium",
    "Syndicate",
    "Unlimited",
    "Worldwide",
    "Partners",
  ];
  const wildcard = [
    "Lozenge",
    "Entropy",
    "Biscuit",
    "Tapioca",
    "Algo",
    "Flavour",
    "Mince",
    "Pigment",
    "Pentimento",
    "Pimento",
    "Taramasalata",
    "Hummus",
    "Sludge",
    "Algorithm",
    "Gunk",
    "Echo",
    "Vapor",
    "Goblin",
  ];
  const p = Math.random();
  if (p < 0.33)
    return `${pickRandom(buzzwords)} ${pickRandom(techTerms)} ${pickRandom(suffixes)}`;
  if (p < 0.66)
    return `${pickRandom(wildcard)} ${pickRandom(buzzwords)} ${pickRandom(suffixes)}`;
  return `${pickRandom(buzzwords)} ${pickRandom(wildcard)} ${pickRandom(techTerms)} ${pickRandom(suffixes)}`;
}


// --- Player choices ---
const CHOICE_CARD_OPTIONS = {
  33: {
    imagePath: "images/choice-33-earth-stars.jpg",
    prompt: (companyName) =>
      `Does ${companyName} prefer general-purpose AI systems, or smaller, domain-specific AI systems?`,
    options: [
      {
        value: "general-purpose",
        label: "General-purpose AI systems",
        correlatedActionId: 18,
      },
      {
        value: "domain-specific",
        label: "Smaller, domain-specific AI systems",
        correlatedActionId: 6,
      },
    ],
  },
  34: {
    imagePath: "images/choice-34-connected-device.jpg",
    prompt: (companyName) =>
      `Where does most of ${companyName}'s compute take place?`,
    options: [
      {
        value: "machine-meshes",
        label: "On devices and local machine meshes",
        correlatedActionId: 25,
      },
      {
        value: "cloud-computing",
        label: "In remotely accessible cloud computing",
        correlatedActionId: 3,
      },
    ],
  },
  35: {
    imagePath: "images/choice-35-organic-mushroom.jpg",
    prompt: (companyName) =>
      `Which unexpected technology is working rather well for ${companyName}?`,
    options: [
      {
        value: "space-data-centres",
        label: "Data centres in space and on the Moon",
        correlatedActionId: 7,
      },
      {
        value: "organic-data-centres",
        label: "Organic data centres powered partly by algae and mud batteries",
        correlatedActionId: 24,
      },
    ],
  },
  36: {
    imagePath: "images/choice-36-leaf-cable.jpg",
    prompt: (companyName) =>
      `Which environmental priority matters more to ${companyName}?`,
    options: [
      {
        value: "sustainable-ai",
        label: "Reducing the impacts of AI itself",
        correlatedActionId: 1,
      },
      {
        value: "ai-for-sustainability",
        label: "Using AI to achieve wider environmental benefits",
        correlatedActionId: 17,
      },
    ],
  },
  37: {
    imagePath: "images/choice-37-wifi-heart.jpg",
    prompt: (companyName) =>
      `Are most workers at ${companyName} a bit cyborg, or very cyborg?`,
    options: [
      {
        value: "a-bit-cyborg",
        label: "A bit cyborg",
        correlatedActionId: 13,
      },
      {
        value: "very-cyborg",
        label: "Very cyborg",
        correlatedActionId: 21,
      },
    ],
  },
  100: {
    imagePath: "images/tarot-23.jpg",
    prompt:
      "One of your employees has become a celebrity merely through the quality of their react emojis on social media. Their reacts have caught the public imagination.",
    options: [
      {
        value: "own-the-association",
        label: "Proudly own the association.",
      },
      {
        value: "keep-your-distance",
        label: "Keep your distance.",
      },
    ],
  },
  101: {
    imagePath: "images/tarot-8.jpg",
    prompt:
      "Tech giant Pineapple Inc. is collapsing after building too many data centres. Where do you take your organisation’s compute next?",
    options: [
      {
        value: "another-hyperscaler",
        label: "Pivot to Glamazon Inc. or Giggle Inc.",
        correlatedActionId: 8,
      },
      {
        value: "open-and-on-site",
        label: "Pivot to open-source and on-site alternatives.",
        correlatedActionId: 25,
      },
    ],
  },
  102: {
    imagePath: "images/tarot-24.jpg",
    prompt:
      "Solarpunk data gardens with on-site renewable energy are proliferating. They sound hopeful, but they are not really competing with the hyperscalers’ business model.",
    options: [
      {
        value: "affiliate",
        label: "Affiliate — it sounds promising.",
        correlatedActionId: 27,
      },
      {
        value: "steer-clear",
        label:
          "Steer clear — it isn’t really competing with the hyperscalers’ business model.",
        correlatedActionId: 32,
      },
    ],
  },
  127: {
    imagePath: "images/tarot-22.jpg",
    prompt:
      "The AI systems you use run on physical hardware whose rental price swings with volatile energy markets. Your supplier uses a highly federated architecture, switching your organisation between large and small models as costs change.",
    options: [
      {
        value: "predictable-assistance",
        label:
          "You have to switch. Workers need predictable AI assistance so they can form good working habits.",
        correlatedActionId: 13,
      },
      {
        value: "federated-efficiency",
        label:
          "Using smaller models when energy prices are high sounds sensible. Stick with the supplier.",
        correlatedActionId: 4,
      },
    ],
  },
  128: {
    imagePath: "images/tarot-6.jpg",
    prompt:
      "You receive an intriguing pitch from a de-AI-ification consultancy. AI has a way of creating dependencies, they argue, and can be difficult to remove. But did you know even a honeybee can remove its sting without dying, if it is given careful time and space?\n\nThe consultancy specialises in gently extracting AI systems and replacing them with human processes, more specialised software, or other tools.",
    options: [
      {
        value: "free-audit",
        label: "Try the free audit, and then maybe take it from there.",
      },
      {
        value: "decline-audit",
        label:
          "No thanks. Besides, you noticed they had generative-AI art on their own website.",
      },
    ],
  },
  129: {
    imagePath: "images/tarot-2.jpg",
    prompt:
      "Your Head of Procurement, Alon, is on the verge of a meltdown. Technology is moving so fast. Alon has all kinds of criteria to meet for responsible procurement, but lacks the tools and expertise to assess the vendors.",
    options: [
      {
        value: "relax-criteria",
        label: "Explore relaxing or removing some procurement criteria.",
      },
      {
        value: "resource-evaluation",
        label: "Devote more resources to supporting vendor evaluation.",
      },
    ],
  },
  130: {
    imagePath: "images/tarot-28.jpg",
    prompt:
      "Your Recruitment department is getting swamped with applications for every post. The problem is partly AI-generated applications. But there are also simply more applicants, especially as people lose their jobs in adjacent sectors.",
    options: [
      {
        value: "ai-recruitment",
        label: "Lean heavily into AI tools for recruitment.",
        correlatedActionId: 15,
      },
      {
        value: "employment-policy",
        label:
          "Lobby policymakers to investigate automation-driven unemployment.",
        correlatedActionId: 23,
      },
    ],
  },
  131: {
    imagePath: "images/tarot-28.jpg",
    prompt:
      "Former employees are selling interactive simulations of their organisational knowledge. Your competitors are buying.",
    options: [
      {
        value: "buy-exclusive-access",
        label: "Buy exclusive access.",
      },
      {
        value: "shop-the-market",
        label: "Let them sell—but maybe do some shopping yourself.",
      },
    ],
  },
  132: {
    imagePath: "images/art-wolf.jpg",
    prompt:
      "A fully automated competitor is undercutting you. Nobody can identify its staff, offices, owners or legal jurisdiction.",
    options: [
      {
        value: "legal-challenge",
        label: "Try to launch a legal challenge.",
      },
      {
        value: "copy-practices",
        label: "Try to copy some of its business practices.",
      },
    ],
  },
  133: {
    imagePath: "images/tarot-22.jpg",
    prompt:
      "Gunther from Organisational Development says he has a religious belief that AIs are sentient, which means he cannot comply with certain company policies governing AI use.",
    options: [
      {
        value: "accommodate-faith",
        label: "Accommodate Gunther’s faith.",
      },
      {
        value: "send-training",
        label: "This is ridiculous. Send Gunther on some training.",
      },
    ],
  },
  155: {
    imagePath: "images/tarot-23.jpg",
    prompt:
      "The union is demanding that workers have the right to listen to music while they work, no matter what.",
    options: [
      {
        value: "allow-music",
        label: "Er, sure, whatever.",
      },
      {
        value: "reject-music",
        label: "No, what’s next? Podcasts? Dual screening?",
      },
    ],
  },
};

// Subplot choice options are generated from narrative data, so their
// conditional SKIP recharges are keyed separately by card and option order.
const SUBPLOT_CHOICE_RECHARGE_ACTION_IDS = {
  88: [14, 22],
  94: [16, 21],
};

// Each pair is classified relative to the other answer on that card:
// 1 = pro-AI or techno-optimistic, 0 = neutral, -1 = cautious, guarded,
// human-centric, or resistant.
const CHOICE_TECHNOPHILIA_SCORES = {
  33: [1, -1],
  34: [-1, 1],
  35: [1, -1],
  36: [-1, 1],
  37: [-1, 1],
  82: [1, -1],
  83: [1, 0],
  84: [1, -1],
  85: [1, -1],
  86: [1, 0],
  87: [1, -1],
  88: [1, -1],
  89: [1, -1],
  90: [0, -1],
  91: [1, -1],
  92: [-1, 1],
  93: [-1, 0],
  94: [1, -1],
  95: [-1, 1],
  96: [0, -1],
  97: [-1, 0],
  98: [1, -1],
  99: [1, -1],
  100: [1, 0],
  101: [1, -1],
  102: [1, -1],
  103: [1, -1],
  104: [1, -1],
  105: [-1, 1],
  106: [-1, 0],
  107: [1, -1],
  108: [1, 0],
  109: [1, 0],
  110: [-1, 1],
  111: [1, -1],
  112: [-1, 1],
  113: [1, -1],
  114: [-1, 1],
  115: [-1, 1],
  116: [1, -1],
  117: [1, -1],
  118: [0, -1],
  119: [0, -1],
  120: [0, 1],
  121: [-1, 1],
  122: [0, -1],
  123: [1, -1],
  124: [0, -1],
  125: [1, -1],
  126: [0, -1],
  127: [0, 1],
  128: [-1, 1],
  129: [1, -1],
  130: [1, -1],
  131: [1, 0],
  132: [-1, 1],
  133: [1, -1],
  134: [1, -1],
  135: [1, 0],
  136: [1, -1],
  137: [1, -1],
  138: [0, -1],
  139: [1, -1],
  140: [0, -1],
  141: [1, -1],
  142: [-1, 0],
  143: [1, -1],
  144: [-1, 1],
  145: [0, -1],
  146: [1, -1],
  147: [-1, 1],
  148: [1, -1],
  149: [1, -1],
  150: [1, -1],
  151: [-1, 1],
  152: [-1, 1],
  153: [1, -1],
  154: [-1, 1],
  155: [1, -1],
};

const TECHNOPHILIA_CLASSIFICATIONS = {
  1: "pro-ai",
  0: "neutral",
  [-1]: "cautious",
};

function getChoiceTechnophilia(cardId, optionIndex) {
  const scores = CHOICE_TECHNOPHILIA_SCORES[cardId];
  if (!scores || scores.length !== 2 || scores[0] === scores[1]) {
    throw new Error(
      `Choice card ${cardId} needs two different technophilia classifications.`,
    );
  }
  return scores[optionIndex];
}

// Each subplot is a fixed seven-card tree: one root, two middle cards, and
// four endings. The path labels are stable routing keys, not choice history.
const SUBPLOT_TREES = {
  A: {
    root: 82,
    nodes: {
      root: 82,
      "path-1": 83,
      "path-2": 103,
      "path-1-1": 84,
      "path-1-2": 104,
      "path-2-1": 105,
      "path-2-2": 106,
    },
  },
  B: {
    root: 85,
    nodes: {
      root: 85,
      "path-1": 86,
      "path-2": 107,
      "path-1-1": 87,
      "path-1-2": 108,
      "path-2-1": 109,
      "path-2-2": 110,
    },
  },
  C: {
    root: 88,
    nodes: {
      root: 88,
      "path-1": 89,
      "path-2": 111,
      "path-1-1": 90,
      "path-1-2": 112,
      "path-2-1": 113,
      "path-2-2": 114,
    },
  },
  D: {
    root: 91,
    nodes: {
      root: 91,
      "path-1": 92,
      "path-2": 115,
      "path-1-1": 93,
      "path-1-2": 116,
      "path-2-1": 117,
      "path-2-2": 118,
    },
  },
  E: {
    root: 94,
    nodes: {
      root: 94,
      "path-1": 95,
      "path-2": 119,
      "path-1-1": 96,
      "path-1-2": 120,
      "path-2-1": 121,
      "path-2-2": 122,
    },
  },
  F: {
    root: 97,
    nodes: {
      root: 97,
      "path-1": 98,
      "path-2": 123,
      "path-1-1": 99,
      "path-1-2": 124,
      "path-2-1": 125,
      "path-2-2": 126,
    },
  },
  G: {
    root: 134,
    nodes: {
      root: 134,
      "path-1": 135,
      "path-2": 136,
      "path-1-1": 137,
      "path-1-2": 138,
      "path-2-1": 139,
      "path-2-2": 140,
    },
  },
  H: {
    root: 141,
    nodes: {
      root: 141,
      "path-1": 142,
      "path-2": 143,
      "path-1-1": 144,
      "path-1-2": 145,
      "path-2-1": 146,
      "path-2-2": 147,
    },
  },
  I: {
    root: 148,
    nodes: {
      root: 148,
      "path-1": 149,
      "path-2": 150,
      "path-1-1": 151,
      "path-1-2": 152,
      "path-2-1": 153,
      "path-2-2": 154,
    },
  },
};

const SUBPLOT_IMAGE_PATHS_BY_CARD_ID = {
  82: "images/tarot-18.jpg",
  83: "images/tarot-20.jpg",
  84: "images/art-wolf.jpg",
  85: "images/tarot-3.jpg",
  86: "images/tarot-10.jpg",
  87: "images/tarot-27.jpg",
  88: "images/tarot-21.jpg",
  89: "images/tarot-11.jpg",
  90: "images/art-beets.jpg",
  91: "images/tarot-4.jpg",
  92: "images/tarot-26.jpg",
  93: "images/tarot-25.jpg",
  94: "images/art-farm-robot.jpg",
  95: "images/tarot-17.jpg",
  96: "images/art-storm.jpg",
  97: "images/jo-card-back.jpg",
  98: "images/tarot-9.jpg",
  99: "images/tarot-23.jpg",
  103: "images/tarot-20.jpg",
  104: "images/art-wolf.jpg",
  105: "images/art-wolf.jpg",
  106: "images/art-wolf.jpg",
  107: "images/tarot-10.jpg",
  108: "images/tarot-27.jpg",
  109: "images/tarot-27.jpg",
  110: "images/tarot-27.jpg",
  111: "images/tarot-11.jpg",
  112: "images/art-beets.jpg",
  113: "images/art-beets.jpg",
  114: "images/art-beets.jpg",
  115: "images/tarot-26.jpg",
  116: "images/tarot-25.jpg",
  117: "images/tarot-25.jpg",
  118: "images/tarot-25.jpg",
  119: "images/tarot-17.jpg",
  120: "images/art-storm.jpg",
  121: "images/art-storm.jpg",
  122: "images/art-storm.jpg",
  123: "images/tarot-9.jpg",
  124: "images/tarot-23.jpg",
  125: "images/tarot-23.jpg",
  126: "images/tarot-23.jpg",
  134: "images/art-beets.jpg",
  135: "images/tarot-17.jpg",
  136: "images/tarot-17.jpg",
  137: "images/tarot-2.jpg",
  138: "images/tarot-2.jpg",
  139: "images/tarot-2.jpg",
  140: "images/tarot-2.jpg",
  141: "images/choice-35-organic-mushroom.jpg",
  142: "images/tarot-18.jpg",
  143: "images/tarot-18.jpg",
  144: "images/tarot-27.jpg",
  145: "images/tarot-27.jpg",
  146: "images/tarot-27.jpg",
  147: "images/tarot-27.jpg",
  148: "images/tarot-28.jpg",
  149: "images/tarot-3.jpg",
  150: "images/tarot-3.jpg",
  151: "images/tarot-27.jpg",
  152: "images/tarot-27.jpg",
  153: "images/tarot-27.jpg",
  154: "images/tarot-27.jpg",
};

const CARE_RELATIVES = [
  {
    relation: "mother",
    subjectPronoun: "she",
    objectPronoun: "her",
    possessivePronoun: "her",
    weight: 0.2,
  },
  {
    relation: "father",
    subjectPronoun: "he",
    objectPronoun: "him",
    possessivePronoun: "his",
    weight: 0.2,
  },
  {
    relation: "grandfather",
    subjectPronoun: "he",
    objectPronoun: "him",
    possessivePronoun: "his",
    weight: 0.2,
  },
  {
    relation: "grandmother",
    subjectPronoun: "she",
    objectPronoun: "her",
    possessivePronoun: "her",
    weight: 0.2,
  },
  {
    relation: "brother",
    subjectPronoun: "he",
    objectPronoun: "him",
    possessivePronoun: "his",
    weight: 0.1,
  },
  {
    relation: "sister",
    subjectPronoun: "she",
    objectPronoun: "her",
    possessivePronoun: "her",
    weight: 0.1,
  },
];

let activeCareRelative = null;
let activeAlasStory = null;

function chooseCareRelative() {
  let roll = Math.random();
  for (const relative of CARE_RELATIVES) {
    roll -= relative.weight;
    if (roll < 0) return { ...relative };
  }
  return { ...CARE_RELATIVES.at(-1) };
}

const ALAS_NAMES = ["Sandra", "Erik", "Mohammed", "Priya", "Craig", "Ellen", "Sven"];
const ALAS_DEPARTMENTS = ["Sales", "HR", "Accounts", "IT", "Operations"];
const ALAS_DEATHS = [
  "was crushed under a falling vending machine while trying to get a can of pop",
  "was struck by a runaway food delivery robot",
  "fell through a sinkhole during a team-building treasure hunt",
  "was carried out to sea on an inflatable swan at the company picnic",
  "was crushed under a giant wheel of cheese dropped by a delivery drone",
  "was trampled by a stampede of petting alpacas during a workplace wellbeing day",
  "was electrocuted by a smart kettle during the office tea round",
  "was killed by a falling logo at a product launch",
];

function createAlasIdentity(name) {
  const department = pickRandom(ALAS_DEPARTMENTS);
  return {
    name,
    department,
    fullReference: `${name} from ${department}`,
  };
}

function createAlasStory() {
  const deceasedName = pickRandom(ALAS_NAMES);
  const remainingNames = ALAS_NAMES.filter((name) => name !== deceasedName);
  return {
    deceased: createAlasIdentity(deceasedName),
    musician: createAlasIdentity(pickRandom(remainingNames)),
    death: pickRandom(ALAS_DEATHS),
  };
}

function getActiveAlasStory() {
  if (!activeAlasStory) activeAlasStory = createAlasStory();
  return activeAlasStory;
}

function createSubplotAChoiceConfig(stage, path) {
  if (stage === 1) {
    return {
      prompt: () =>
        "You have become unusually forgetful. Names, meetings and familiar words keep slipping away.",
      options: () => [
        { value: "path-1", label: "Rely more heavily on AI agents." },
        { value: "path-2", label: "Make the CEO position a shared role." },
      ],
      nextCardIds: SUBPLOT_TREES.A.nodes,
    };
  }

  if (stage === 2) {
    return {
      prompt: () => {
        const reliedOnAgents = path === "path-1";
        if (reliedOnAgents) {
          return "Since you began using AI agents to compensate for your forgetfulness, they have concealed it remarkably well. You are diagnosed with a progressive cognitive disorder.\n\nDoctors offer an experimental neural interface, trained partly on your agents’ records. It would route parts of your memory, language and judgement through AI.";
        }
        return "Since you made the CEO position a shared role, decisions have become slower but less dependent on your memory. You are diagnosed with a progressive cognitive disorder.\n\nDoctors offer an experimental neural interface. By routing parts of your memory, language and judgement through AI, it might let you lead independently again.";
      },
      options: () => {
        const reliedOnAgents = path === "path-1";
        return reliedOnAgents
          ? [
              { value: "path-1-1", label: "Accept the interface." },
              {
                value: "path-1-2",
                label: "Refuse it and continue relying on external agents.",
              },
            ]
          : [
              {
                value: "path-2-1",
                label: "Accept the interface and resume sole leadership.",
              },
              {
                value: "path-2-2",
                label: "Refuse it and deepen the shared-leadership model.",
              },
            ];
      },
      nextCardIds: SUBPLOT_TREES.A.nodes,
    };
  }

  const conclusions = {
    "path-1-1": {
      prompt:
        "You accepted an interface trained on your agents’ records. It now supports your memory, language, and judgement.\n\nThe provider announces that the service will be deprecated. Soon, the AI integrated with your thinking will no longer be supported.",
      options: [
        {
          label: "Try to migrate yourself to an open-source alternative.",
        },
        {
          label: "See if you can cope without any AI integration.",
        },
      ],
    },
    "path-1-2": {
      prompt:
        "You refused the neural interface, though you kept relying on AI agents. As your condition progresses, they increasingly remember, decide, and speak for you.",
      options: [
        {
          label: "I feel like I made the right choice earlier. They're ultimately just tools.",
        },
        {
          label: "I feel myself being replaced.",
        },
      ],
    },
    "path-2-1": {
      prompt:
        "You accepted an experimental treatment and resumed sole leadership of the organization. Your inner AI slows the decline, but your former co-director is filling in a lot of gaps.",
      options: [
        {
          label: "Announce the latest date you will step down by.",
        },
        {
          label: "Your former co-director wields too much influence. Plot against them.",
        },
      ],
    },
    "path-2-2": {
      prompt:
        "You refused the AI interface and deepened shared leadership. As your condition progresses, the organisation grows more collective and democratic.",
      options: [
        {
          label: "I hope I can still belong as my role changes.",
        },
        {
          label: "I hope what we built becomes strong enough not to need me.",
        },
      ],
    },
  };

  return {
    prompt: () => conclusions[path].prompt,
    options: () => {
      return conclusions[path].options.map((option, index) => ({
        value: `${path}-${index + 1}`,
        label: option.label,
      }));
    },
  };
}

function createSubplotDChoiceConfig(stage, path) {
  if (stage === 1) {
    return {
      prompt: () => {
        const { deceased, death } = getActiveAlasStory();
        return `Tragically, ${deceased.fullReference} ${death}.`;
      },
      options: () => [
        {
          value: "path-1",
          label: "Use AI to help you draft the difficult news.",
        },
        {
          value: "path-2",
          label:
            "Stay clear of AI. This one needs to be from the fully human heart.",
        },
      ],
      nextCardIds: SUBPLOT_TREES.D.nodes,
    };
  }

  if (stage === 2) {
    const getPrompt = () => {
      const { deceased } = getActiveAlasStory();
      const usedAI = path === "path-1";
      if (usedAI) {
        return `At a staff event, a few people are talking about how they haven’t seen ${deceased.fullReference} recently. You remember some of those same people posting heartfelt online eulogies about ${deceased.name}, but you guess those were written by their AI agents.`;
      }
      return `${deceased.fullReference} is still answering emails from beyond the grave, via an AI system they set up.`;
    };

    return {
      prompt: getPrompt,
      cardDescription: () => {
        const { deceased } = getActiveAlasStory();
        const usedAI = path === "path-1";
        if (usedAI) {
          return `• At a staff event, a few people are talking about how they haven’t seen ${deceased.fullReference} recently.\n• You remember some of those same people posting heartfelt online eulogies about ${deceased.name}, but you guess those were written by their AI agents.`;
        }
        return `• ${getPrompt()}`;
      },
      options: () => {
        const usedAI = path === "path-1";
        return usedAI
          ? [
              {
                value: "path-1-1",
                label: "You feel a bit sad about all this.",
              },
              {
                value: "path-1-2",
                label: "You just feel curious about how society is evolving.",
              },
            ]
          : [
              {
                value: "path-2-1",
                label: "Shut down the inbox.",
              },
              {
                value: "path-2-2",
                label:
                  "Add a short legal disclaimer to clarify that this employee is dead.",
              },
            ];
      },
      nextCardIds: SUBPLOT_TREES.D.nodes,
    };
  }

  const conclusions = {
    "path-1-1": {
      prompt: () =>
        "After LLMs are used by pro-life activists to create live, interactive extrapolations of foetuses that “advocate for themselves” from ultrasound images, cardiotocography traces and maternal health records, a wider backlash against chatbots gathers force.",
      cardDescription: () =>
        "• After LLMs are used by pro-life activists to create live, interactive extrapolations of foetuses that “advocate for themselves” from ultrasound images, cardiotocography traces and maternal health records, a wider backlash against chatbots gathers force.",
      options: () => [
        {
          label:
            "Some simulations should not be allowed to speak in another being’s name.",
        },
        {
          label:
            "The activists are grotesque, but banning chatbots will not resolve what made this persuasive.",
        },
      ],
    },
    "path-1-2": {
      prompt: () =>
        "A client runs into you at an event and is startled that you are real. They assumed from your messages and video calls that you were an AI.\n\n“I mean, I thought maybe you used to be real, just maybe that you weren’t any more.”",
      cardDescription: () =>
        "• A client runs into you at an event and is startled that you are real.\n• They assumed from your messages and video calls that you were an AI.",
      options: () => [
        {
          label: "Ask if it matters.",
        },
        {
          label:
            "Insist on a device-free lunch and see if either of you can still pass as human.",
        },
      ],
    },
    "path-2-1": {
      prompt: () =>
        "Customers complain that your company is too slow and unresponsive. Others complain that you use old-fashioned chatbots instead of getting AI agents to pretend to be living employees.",
      cardDescription: () =>
        "• Customers complain that your company is too slow and unresponsive.\n• Others complain that you use old-fashioned chatbots instead of getting AI agents to pretend to be living employees.",
      options: () => [
        {
          label:
            "Take these complaints seriously — get an AI agent to sift through them and produce actionable recommendations.",
        },
        {
          label: "Looks like AI slopaganda. Ignore it.",
        },
      ],
    },
    "path-2-2": {
      prompt: () => {
        const { musician } = getActiveAlasStory();
        return `${musician.fullReference} has been using company time to build an incredibly successful career as a musician. The company lawyers advise that you may own the IP in some of ${musician.name}’s music and should negotiate, rather than take the straight disciplinary route.`;
      },
      cardDescription: () => {
        const { musician } = getActiveAlasStory();
        return `• ${musician.fullReference} has been using company time to build an incredibly successful career as a musician.\n• The company lawyers advise that you may own the IP in some of ${musician.name}’s music and should negotiate, rather than take the straight disciplinary route.`;
      },
      options: () => {
        const { musician, death } = getActiveAlasStory();
        return [
          {
            label: `You’re actually a massive fan of ${musician.name}’s music. Get a selfie and an autograph.`,
          },
          {
            label: `Wait, wasn’t ${musician.fullReference} the one who ${death}, about a year ago?`,
          },
        ];
      },
    },
  };

  return {
    prompt: () => conclusions[path].prompt(),
    cardDescription: () => conclusions[path].cardDescription(),
    options: () => {
      return conclusions[path].options().map((option, index) => ({
        value: `${path}-${index + 1}`,
        label: option.label,
      }));
    },
  };
}

function createSubplotFChoiceConfig(stage, path) {
  const getRelative = () => activeCareRelative || CARE_RELATIVES[0];

  if (stage === 1) {
    return {
      prompt: () => {
        const { relation } = getRelative();
        return `Your ${relation} is getting older, and finding everyday life more challenging.`;
      },
      options: () => [
        {
          value: "path-1",
          label: "Try to improve your work-life balance so you can spend more time together.",
        },
        {
          value: "path-2",
          label:
            "Try to strengthen their local network of care.",
        },
      ],
      nextCardIds: SUBPLOT_TREES.F.nodes,
    };
  }

  if (stage === 2) {
    return {
      prompt: () => {
        const { relation, possessivePronoun: possessive } = getRelative();
        const tookOnCare = path === "path-1";
        if (tookOnCare) {
          return `Since you took on more of your ${relation}’s care, ${possessive} needs have grown.\n\nA caretech service proposes sensors, AI systems, and robots to help with check-ins and everyday tasks. Problems would get escalated to people.`;
        }
        return `The wider circle has helped your ${relation} remain independent, but coordination is tiring and gaps keep appearing.\n\nA caretech service proposes sensors, AI systems, and robots to help with check-ins and everyday tasks. Problems would get escalated to people.`;
      },
      options: () => {
        const { subjectPronoun: subject } = getRelative();
        const tookOnCare = path === "path-1";
        return tookOnCare
          ? [
              {
                value: "path-1-1",
                label: `Suggest that ${subject} try out the system.`,
              },
              {
                value: "path-1-2",
                label:
                  "Reduce your CEO responsibilities and provide more care yourself.",
              },
            ]
          : [
              {
                value: "path-2-1",
                label:
                  "Use the system to support and coordinate the care circle.",
              },
              {
                value: "path-2-2",
                label: "Arrange regular professional human care instead.",
              },
            ];
      },
      nextCardIds: SUBPLOT_TREES.F.nodes,
    };
  }

  const getConclusion = () => {
    const {
      relation,
      subjectPronoun: subject,
    } = getRelative();
    return {
      "path-1-1": {
        prompt: `You’re not sure how well ${subject} really understood the proposal, but your ${relation} seems fine with the networked devices. There are fewer crises. You feel weird that so much data is generated and for some reason shared with you.`,
        cardDescription: `• You’re not sure how well ${subject} really understood the proposal, but your ${relation} seems fine with the networked devices.\n• There are fewer crises.\n• You feel weird that so much data is generated and for some reason shared with you.`,
      },
      "path-1-2": {
        prompt: `You reduce your CEO role and take on more of your ${relation}’s care yourself. Time together deepens, but fatigue and lost work reshape both your lives.`,
        cardDescription: `• You reduce your CEO role and take on more of your ${relation}’s care yourself.\n• Time together deepens, but fatigue and lost work reshape both your lives.`,
      },
      "path-2-1": {
        prompt: `Robots and devices help your ${relation}’s care circle coordinate, and ${subject} remains at home longer. Responsibility is shared, but every alert seems to belong to everyone and no one.`,
        cardDescription: `• Robots and devices help your ${relation}’s care circle coordinate, and ${subject} remains at home longer.\n• Responsibility is shared, but every alert seems to belong to everyone and no one.`,
      },
      "path-2-2": {
        prompt: `Regular paid carers bring your ${relation} stability and skill. ${subject} forms bonds with some of them; staff turnover shows how much continuity depends on working conditions your family cannot control.`,
        cardDescription: `• Regular paid carers bring your ${relation} stability and skill.\n• ${subject} forms bonds with some of them; staff turnover shows how much continuity depends on working conditions your family cannot control.`,
      },
    }[path];
  };

  return {
    prompt: () => getConclusion().prompt,
    cardDescription: () => getConclusion().cardDescription,
    options: () => {
      const optionsByPath = {
        "path-1-1": [
          "I hope technology can create more room for human closeness.",
          "I worry that safety is becoming another form of surveillance.",
        ],
        "path-1-2": [
          "I hope care can be treated as part of life, not an interruption.",
          "My devotion to one person has helped me to see a much bigger, shared problem.",
        ],
        "path-2-1": [
          "I hope shared responsibility can become genuine solidarity.",
          "I worry that coordination is replacing responsibility.",
        ],
        "path-2-2": [
          "I hope dependable care can become part of a wider circle of trust.",
          "I wish care work were valued enough to offer real continuity.",
        ],
      };
      return optionsByPath[path].map((label, index) => ({
        value: `${path}-${index + 1}`,
        label,
      }));
    },
  };
}

const AUTHORED_SUBPLOTS = {
  B: {
    first: {
      prompt:
        "Your best-performing employee admits that an unofficial AI system does nearly all their work. Nobody else knew it existed.",
      options: [
        "Reward the results and let them continue.",
        "Require a return to approved processes.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "After you let the employee continue, other teams adopt their shadow system. Productivity rises, but nobody can fully explain the work.",
        options: [
          "Formalise the system across the organisation.",
          "Let each team control how it uses the system.",
        ],
      },
      "path-2": {
        prompt:
          "After you banned the shadow system, performance collapses. Many colleagues had quietly come to depend on it.",
        options: [
          "Quietly reinstate the system.",
          "Rebuild the organisation’s human expertise.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "You formalised the shadow system. The organisation is productive, but when the system does fail, nobody knows how to continue without it.",
        options: [
          "I hope automation can become a form of institutional knowledge.",
          "I fear the organisation no longer knows what it is doing.",
        ],
      },
      "path-1-2": {
        prompt:
          "Teams retained control of their own AI workflows. Local knowledge flourishes, but the organisation now contains dozens of incompatible systems.",
        options: [
          "I hope useful diversity matters more than tidiness.",
          "I hope we can still become one organisation again.",
        ],
      },
      "path-2-1": {
        prompt:
          "You restored the system. Official procedures continue, but everybody knows the real organisation runs through an unacknowledged AI.",
        options: [
          "It is time to acknowledge how the work is really done.",
          "Some useful arrangements survive by remaining unofficial.",
        ],
      },
      "path-2-2": {
        prompt:
          "Rebuilding human expertise is slow and expensive. The organisation becomes less efficient, but people once again understand its work.",
        options: [
          "I hope resilience proves worth the cost.",
          "I fear we abandoned an extraordinary advantage.",
        ],
      },
    },
  },
  C: {
    first: {
      prompt:
        "An AI recruitment system identifies an exceptionally qualified candidate whom every human interviewer dislikes.",
      options: [
        "Hire the candidate.",
        "Trust the interviewers and reject them.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "The new employee Dennis is a real whizz, though they do seem to organize their whole working life around algorithmic assessment. Other employees begin imitating them.",
        options: [
          "Encourage the new measurable standard.",
          "Protect less measurable ways of working.",
        ],
      },
      "path-2": {
        prompt:
          "The rejected candidate, Dennis, joins a competitor. One day you notice on SinkingIn that the competitor has let go most of their staff, though Dennis is still there as Chief Automation Officer.",
        options: [
          "Start learning some tricks from this competitor.",
          "Defend human roles, and try to create new ones where you can.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "The organisation fills with model employees. Performance scores soar. Working styles and work personae steadily converge.",
        options: [
          "You're worried that work is relational, and the personality ecosystem is growing fragile",
          "You feel bad about socially engineering your employees into weird human robots",
        ],
      },
      "path-1-2": {
        prompt:
          "You have been doing your best to combat AI-powered performancemaxxing by protecting less measurable ways of working. You notice that Dennis has now pushed through a series of “protecting the unquantifiable” KPIs and metrics, which everyone is busy pursuing.",
        options: [
          "I hope excellence can remain plural",
          "I still wonder what the system saw before we did",
        ],
      },
      "path-2-1": {
        prompt:
          "You adopted the rival’s automation. The profession shrinks rapidly. The remaining human work is efficient, accessible, and increasingly tedious and hollow.",
        options: [
          "I hope new forms of skilled work will emerge",
          "I fear we have already destroyed something precious we couldn't measure",
        ],
      },
      "path-2-2": {
        prompt:
          "You defended the profession as human work. Customers, suppliers, and even some rivals value it. Competitors who use more AI are volatile and sometimes go bust, but new competitors pop up quickly. You're being squeezed out of the market.",
        options: [
          "I hope human attention remains worth paying for.",
          "I fear we have mistaken nostalgia for principle.",
        ],
      },
    },
  },
  E: {
    first: {
      prompt:
        "AI performance scoring has been creeping into your organisation. Some employees are concerned about reward-hacking — focusing so much on making the number go up that you forget about the underlying reality.",
      options: [
        "Support the AI performance scoring, but monitor it closely.",
        "Limit the scores’ influence over promotion and pay.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "Your workers were concerned about being graded by AI. Now they’re practising a new form of industrial action: a mish-mash of reward-hacking, quiet quitting and working-to-rule. They’re doing exactly what the AI wants, and it has paralysed your organisation.",
        options: [
          "Pay the early-exit fee and stop using the software.",
          "Upgrade your subscription to unlock the anti-industrial-action dashboard.",
        ],
      },
      "path-2": {
        prompt:
          "After you limited the scores, managers keep using them secretly. Workers build a shadow system to detect unfair decisions.",
        options: [
          "Recognise the workers’ auditing system.",
          "Prohibit both systems.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "Workers help rewrite the scoring rules. Decisions become slower and more contested, but employees can challenge how they are measured.",
        options: [
          "I hope fair rules remain open to argument.",
          "I fear negotiation will become another endless metric.",
        ],
      },
      "path-1-2": {
        prompt:
          "A grassroots movement against AI surveillance and control is spreading. When screenshots leak from your anti-industrial-action dashboard, your organisation becomes a test case. Outside solidarity strengthens the strike.",
        options: [
          "Ask AI how to beat your addiction to AI.",
          "Ask AI to recommend an AI to help you to beat your AI addiction.",
        ],
      },
      "path-2-1": {
        prompt:
          "The workers’ audit exposes patterns management denied. Decisions improve, although every judgement now arrives with a counter-score and an argument.",
        options: [
          "I hope visible conflict is better than hidden unfairness.",
          "I long for a standard everyone can trust.",
        ],
      },
      "path-2-2": {
        prompt:
          "Both systems are prohibited, then discreetly rebuilt. Decisions look human again, while hidden measurements continue shaping them.",
        options: [
          "I accept that judgement can never be fully transparent.",
          "I suspect the forbidden scores still govern us.",
        ],
      },
    },
  },
  G: {
    first: {
      prompt:
        "Four-day weeks are becoming more common. Several competitors have switched without reducing salaries.",
      options: [
        "Introduce a four-day week.",
        "Keep the five-day week.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "Your four-day week works well. Now three-day weeks are becoming more common as automation raises productivity.",
        options: [
          "Reduce the week again.",
          "Four days is enough.",
        ],
      },
      "path-2": {
        prompt:
          "You retained the five-day week. Now three-day weeks are becoming more common, and recruitment is becoming difficult.",
        options: [
          "Go down to four days.",
          "Hold the line at five.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "You kept reducing working hours. Now two-day weeks are becoming common. Work occupies less of life, although inequalities beyond the workplace remain.",
        options: [
          "I hope employment is loosening its grip on life.",
          "I worry leisure is becoming another unevenly distributed resource.",
        ],
      },
      "path-1-2": {
        prompt:
          "You stopped at four days. Two-day weeks spread elsewhere, but your organisation remains stable and attractive.",
        options: [
          "I’m worried that worker power is being eroded.",
          "I’m worried about who’s getting exploited outside the workplace.",
        ],
      },
      "path-2-1": {
        prompt:
          "You finally introduce a four-day week. By then, two-day weeks are becoming common, and the change feels less transformative than expected.",
        options: [
          "Better late than never.",
          "We are adapting just slowly enough to preserve the old system.",
        ],
      },
      "path-2-2": {
        prompt:
          "You retain the five-day week while two-day weeks become common. Your organisation attracts people who love work—and people with few alternatives.",
        options: [
          "Work still gives life structure and purpose.",
          "We may have mistaken necessity for devotion.",
        ],
      },
    },
  },
  H: {
    first: {
      prompt:
        "A new AI supplier offers to build a miniature simulation of your organisation. Its agents will sit in on meetings, learn everyone’s habits and rehearse decisions overnight. They call it SproutAI.",
      options: [
        "Sign up.",
        "Stay with your current systems.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "After several years, SproutAI’s agents draft most decisions, maintain the records and remember why past compromises were made. The service is now slower, less reliable and much more expensive—but that’s where a lot of your institutional memory lives. Without it, you doubt anyone knows how the organisation works.",
        options: [
          "Get out before it gets any worse.",
          "Lobby for stronger right-to-exit policies.",
        ],
      },
      "path-2": {
        prompt:
          "Meanwhile, your largest new customer appears to be a network of purchasing agents with no identifiable human principal.",
        options: [
          "Accept its rapidly growing business.",
          "Require a responsible human counterparty.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "You leave SproutAI. Years of organisational memory are lost, but people begin rebuilding knowledge they can control.",
        options: [
          "Dependence is sometimes more expensive than departure.",
          "I wonder whether we destroyed more knowledge than we liberated.",
        ],
      },
      "path-1-2": {
        prompt:
          "You remain with SproutAI while campaigning for stronger exit rights. The campaign grows, but so does your dependence.",
        options: [
          "Collective regulation is the only realistic route out.",
          "We are asking our captor to design the door.",
        ],
      },
      "path-2-1": {
        prompt:
          "The purchasing agents become your largest customer. They order constantly, negotiate aggressively and cannot explain what their purchases are for.",
        options: [
          "We need to give these customers what they want.",
          "Let’s try harder to sell to humans.",
        ],
      },
      "path-2-2": {
        prompt:
          "You insist on a human counterparty. The business disappears into a maze of agents and shell companies.",
        options: [
          "Some relationships require someone who can answer for them.",
          "Perhaps we rejected the future because it lacked a face.",
        ],
      },
    },
  },
  I: {
    first: {
      prompt:
        "You are invited to join a payment platform using programmable money. Payments can release automatically, expire, split themselves and restrict how they are spent.",
      options: [
        "Join the platform.",
        "Reject it.",
      ],
    },
    second: {
      "path-1": {
        prompt:
          "The platform grows rapidly. Its risk system now blocks some payments and restricts how portions of your revenue may be used.",
        options: [
          "Accept the rules to retain access.",
          "Begin building an exit.",
        ],
      },
      "path-2": {
        prompt:
          "You stayed out. The platform becomes dominant, and some customers’ purchasing agents can no longer transact with you.",
        options: [
          "Join before you lose more business.",
          "Build an alternative with other excluded organisations.",
        ],
      },
    },
    third: {
      "path-1-1": {
        prompt:
          "Transactions are fast and efficient. The platform’s rules increasingly determine what your organisation can buy, sell and support.",
        options: [
          "Convenience has become a form of government.",
          "Rules embedded in money can still serve shared purposes.",
        ],
      },
      "path-1-2": {
        prompt:
          "Leaving is painful. Some partners disappear, but your organisation regains control over how its money moves.",
        options: [
          "Autonomy was worth paying for.",
          "We may have confused inconvenience with freedom.",
        ],
      },
      "path-2-1": {
        prompt:
          "You join the platform. Access returns, but importing your financial history makes the organisation newly visible—and newly governable.",
        options: [
          "Legibility is the price of participation.",
          "We have handed over more than payment processing.",
        ],
      },
      "path-2-2": {
        prompt:
          "Excluded organisations create an interoperable payment network. It is slower and full of arguments about governance, but nobody owns it.",
        options: [
          "Shared control is worth the friction.",
          "Every alternative eventually needs rules and rulers.",
        ],
      },
    },
  },
};

function createAuthoredSubplotChoiceConfig(subplotId, stage, path) {
  const narrative = AUTHORED_SUBPLOTS[subplotId];

  if (stage === 1) {
    return {
      prompt: () => narrative.first.prompt,
      options: () =>
        narrative.first.options.map((label, index) => ({
          value: `path-${index + 1}`,
          label,
        })),
      nextCardIds: SUBPLOT_TREES[subplotId].nodes,
    };
  }

  const section = stage === 2 ? narrative.second : narrative.third;

  return {
    prompt: () => section[path].prompt,
    options: () =>
      section[path].options.map((label, index) => ({
        value: `${path}-${index + 1}`,
        label,
      })),
    ...(stage === 2
      ? { nextCardIds: SUBPLOT_TREES[subplotId].nodes }
      : {}),
  };
}

function createSubplotChoiceConfig(subplotId, stage, path) {
  if (subplotId === "A") return createSubplotAChoiceConfig(stage, path);
  if (subplotId === "D") return createSubplotDChoiceConfig(stage, path);
  if (subplotId === "F") return createSubplotFChoiceConfig(stage, path);
  if (AUTHORED_SUBPLOTS[subplotId]) {
    return createAuthoredSubplotChoiceConfig(subplotId, stage, path);
  }
  throw new Error(`Unknown subplot ${subplotId}`);
}

Object.entries(SUBPLOT_TREES).forEach(([subplotId, tree]) => {
  Object.entries(tree.nodes).forEach(([path, cardId]) => {
    const stage = path === "root" ? 1 : path.split("-").length;
    CHOICE_CARD_OPTIONS[cardId] = {
      ...createSubplotChoiceConfig(subplotId, stage, path),
      imagePath: SUBPLOT_IMAGE_PATHS_BY_CARD_ID[cardId],
    };
  });
});

window.playerChoices = {};

function promptForCardChoice(card) {
  const config = CHOICE_CARD_OPTIONS[card.id];
  if (!config) return Promise.resolve(null);

  const modal = document.getElementById("choiceModal");
  const title = document.getElementById("choiceModalTitle");
  const question = document.getElementById("choiceModalQuestion");
  const options = document.getElementById("choiceModalOptions");
  const image = document.getElementById("choiceModalImage");
  const imagePlaceholder = document.getElementById("choiceModalImagePlaceholder");

  title.textContent = card.name.replace(/^\d+:\s*/, "");
  question.textContent =
    typeof config.prompt === "function"
      ? config.prompt(player.name)
      : config.prompt;
  options.innerHTML = "";

  if (config.imagePath) {
    image.src = config.imagePath;
    image.alt = "";
    image.hidden = false;
    imagePlaceholder.hidden = true;
  } else {
    image.removeAttribute("src");
    image.hidden = true;
    imagePlaceholder.hidden = false;
  }

  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");

  return new Promise((resolve) => {
    const availableOptions =
      typeof config.options === "function" ? config.options() : config.options;
    availableOptions.forEach((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "choice-modal-option";
      button.textContent = option.label;
      button.addEventListener(
        "click",
        () => {
          const technophilia = getChoiceTechnophilia(card.id, index);
          const correlatedActionId =
            option.correlatedActionId ??
            SUBPLOT_CHOICE_RECHARGE_ACTION_IDS[card.id]?.[index];
          window.playerChoices[card.id] = {
            value: option.value,
            label: option.label,
            technophilia,
            classification: TECHNOPHILIA_CLASSIFICATIONS[technophilia],
          };
          player.technophilia += technophilia;
          player.choicesMade += 1;
          if (card.isSubplot) {
            advanceActiveSubplot(
              card.subplotId,
              config.nextCardIds?.[option.value] || null,
            );
          }
          if (
            !skipAvailable &&
            correlatedActionId &&
            player.actionsPlayed.has(correlatedActionId)
          ) {
            restoreSkipToken();
          }
          modal.style.display = "none";
          modal.setAttribute("aria-hidden", "true");
          resolve(window.playerChoices[card.id]);
        },
        { once: true },
      );
      options.appendChild(button);
      if (index === 0) requestAnimationFrame(() => button.focus());
    });
  });
}

// --- Players ---
let playerName = pickRandom(playerNames);
let AI1Name = pickRandom(ai1Names);
let AI2Name = generateAI2Name();

let player = {
  name: playerName,
  hand: [],
  progress: 1,
  sustainability: 0,
  technophilia: 0,
  choicesMade: 0,
  actionsPlayed: new Set(),
  eventsPlayed: new Set(),
};
let AI1 = {
  name: AI1Name,
  hand: [],
  progress: 1,
  sustainability: 0,
  actionsPlayed: new Set(),
  eventsPlayed: new Set(),
};
let AI2 = {
  name: AI2Name,
  hand: [],
  progress: 1,
  sustainability: 0,
  actionsPlayed: new Set(),
  eventsPlayed: new Set(),
};

function updateIntroCompanyName() {
  const companyName = el("introCompanyName");
  if (companyName) companyName.textContent = player.name;
}

updateIntroCompanyName();

// Keep card metadata even after deck mutations
let CARD_BY_ID = {};
function initCardLookup() {
  if (!Array.isArray(window.deck)) return;
  const snapshot = deck.slice();
  CARD_BY_ID = Object.fromEntries(snapshot.map((c) => [c.id, c]));
}

// Track which action IDs and score values should be highlighted while
// hovering an event card.
let highlightedActionIds = new Set();
let highlightedScoreValues = new Map();

// The final bullet on each event card is the single source of truth for
// both its mechanics and its mouseover highlighting.
function getEventRule(card) {
  if (!card || card.type !== "event") return null;

  const finalBullet = String(card.description || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1) || "";

  const actionIds = [
    ...new Set(
      (finalBullet.match(/\b(?:[1-9]|[12]\d|3[0-2])\b/g) || []).map(Number),
    ),
  ];

  if (finalBullet.includes("convert all Progress into RAI Points")) {
    return { type: "milestone", actionIds: [] };
  }

  if (finalBullet.includes("lose all progress points")) {
    return { type: "crisis", actionIds };
  }

  if (
    finalBullet.startsWith(
      "* Players gain a progress point if they have played action",
    )
  ) {
    return { type: "opportunity", actionIds };
  }

  console.warn("[DSG] Event card has no recognised final-bullet rule:", card);
  return { type: "none", actionIds: [] };
}

function getActionIdsFromEvent(card) {
  const rule = getEventRule(card);
  return rule ? rule.actionIds : [];
}

function getEventActionTooltip(card) {
  const playedCardTitles = getActionIdsFromEvent(card)
    .filter((id) => player.actionsPlayed.has(id))
    .map((id) => CARD_BY_ID[id]?.name)
    .filter(Boolean);

  if (playedCardTitles.length === 0) return "";
  if (playedCardTitles.length === 1) {
    return `You are prepared for this event. You have played ${playedCardTitles[0]}.`;
  }

  return `You are prepared for this event. You have played ${playedCardTitles.slice(0, -1).join(", ")}, and ${playedCardTitles.at(-1)}.`;
}

let eventActionTooltip = null;

function getEventActionTooltipElement() {
  if (eventActionTooltip) return eventActionTooltip;
  eventActionTooltip = document.createElement("div");
  eventActionTooltip.id = "eventActionTooltip";
  eventActionTooltip.setAttribute("role", "tooltip");
  document.body.appendChild(eventActionTooltip);
  return eventActionTooltip;
}

function positionEventActionTooltip(event) {
  if (!eventActionTooltip || eventActionTooltip.style.display === "none") return;

  const gap = 14;
  const rect = eventActionTooltip.getBoundingClientRect();
  let left = event.clientX + gap;
  let top = event.clientY + gap;

  if (left + rect.width > window.innerWidth - gap) {
    left = event.clientX - rect.width - gap;
  }
  if (top + rect.height > window.innerHeight - gap) {
    top = event.clientY - rect.height - gap;
  }

  eventActionTooltip.style.left = `${Math.max(gap, left)}px`;
  eventActionTooltip.style.top = `${Math.max(gap, top)}px`;
}

function showEventActionTooltip(card, event) {
  if (!tooltipsEnabled) return;

  const text = getEventActionTooltip(card);
  if (!text) return;

  const tooltip = getEventActionTooltipElement();
  tooltip.textContent = text;
  tooltip.style.display = "block";
  positionEventActionTooltip(event);
}

function hideEventActionTooltip() {
  if (eventActionTooltip) eventActionTooltip.style.display = "none";
}

function getEventScoreHighlights(card, players) {
  const rule = getEventRule(card);
  const highlights = new Map();
  if (!rule) return highlights;

  players.forEach((currentPlayer) => {
    const fields = new Set();

    if (rule.type === "opportunity") {
      const gainsProgress = rule.actionIds.some((id) =>
        currentPlayer.actionsPlayed.has(id),
      );
      if (gainsProgress) fields.add("progress");
    } else if (rule.type === "milestone" && currentPlayer.progress > 0) {
      fields.add("progress");
      fields.add("sustainability");
    } else if (rule.type === "crisis" && currentPlayer.progress > 0) {
      const isProtected = rule.actionIds.some((id) =>
        currentPlayer.actionsPlayed.has(id),
      );
      if (!isProtected) fields.add("progress");
    }

    if (fields.size > 0) highlights.set(currentPlayer, fields);
  });

  return highlights;
}

function applyEventEffect(card, players) {
  const rule = getEventRule(card);
  if (!rule) return;

  players.forEach((currentPlayer) => {
    if (rule.type === "opportunity") {
      const bonus = rule.actionIds.filter((id) =>
        currentPlayer.actionsPlayed.has(id),
      ).length;
      currentPlayer.progress += bonus;
    } else if (rule.type === "milestone") {
      currentPlayer.sustainability += currentPlayer.progress;
      currentPlayer.progress = 0;
    } else if (rule.type === "crisis") {
      const isProtected = rule.actionIds.some((id) =>
        currentPlayer.actionsPlayed.has(id),
      );
      if (!isProtected) currentPlayer.progress = 0;
    }
  });
}

// Update UI to bold the action IDs and score values affected by the hovered
// event card.
function setEventHighlights(card) {
  highlightedActionIds = new Set(getActionIdsFromEvent(card));
  highlightedScoreValues = getEventScoreHighlights(card, [player, AI1, AI2]);
  updateGameInfo();
  updatePlayedLists();
}

function clearEventHighlights() {
  highlightedActionIds = new Set();
  highlightedScoreValues = new Map();
  updateGameInfo();
  updatePlayedLists();
}

const SUBPLOTS_PER_GAME = 2;
const SUBPLOT_START_OFFSETS = [0, 6];
let activeSubplots = [];
let subplotCardsById = {};
let mainDeckSize = 0;
const skippedChoiceCardIds = new Set();

function chooseActiveSubplots() {
  const subplotIds = Object.keys(SUBPLOT_TREES);
  shuffle(subplotIds);
  activeSubplots = subplotIds
    .slice(0, SUBPLOTS_PER_GAME)
    .map((subplotId, index) => ({
      id: subplotId,
      nextCardId: SUBPLOT_TREES[subplotId].root,
      complete: false,
      positionOffset: SUBPLOT_START_OFFSETS[index] || 0,
    }));

  activeAlasStory = activeSubplots.some(({ id }) => id === "D")
    ? createAlasStory()
    : null;
  window.activeAlasStory = activeAlasStory;
  activeCareRelative = activeSubplots.some(({ id }) => id === "F")
    ? chooseCareRelative()
    : null;
  window.activeCareRelative = activeCareRelative;

  console.log(
    "[DSG] Selected subplots",
    activeSubplots.map(({ id, positionOffset }) => ({
      id,
      positionOffset,
    })),
  );
}

function getActiveSubplot(subplotId) {
  return activeSubplots.find(({ id }) => id === subplotId) || null;
}

function advanceActiveSubplot(subplotId, nextCardId) {
  const subplot = getActiveSubplot(subplotId);
  if (!subplot) return;
  subplot.nextCardId = nextCardId;
  subplot.complete = nextCardId === null;
}

function cancelActiveSubplot(subplotId) {
  const subplot = getActiveSubplot(subplotId);
  if (!subplot) return;

  Object.values(SUBPLOT_TREES[subplotId].nodes).forEach((cardId) => {
    skippedChoiceCardIds.add(cardId);
  });
  subplot.nextCardId = null;
  subplot.complete = true;
  player.hand = player.hand.filter(
    (card) => !card.isSubplot || card.subplotId !== subplotId,
  );
}

function allActiveSubplotsComplete() {
  return (
    activeSubplots.length === SUBPLOTS_PER_GAME &&
    activeSubplots.every(({ complete }) => complete)
  );
}

function regularCardsDealt() {
  return mainDeckSize - window.deck.length;
}

function getDueSubplotCard() {
  for (const subplot of activeSubplots) {
    if (subplot.complete || subplot.nextCardId === null) continue;

    const card = subplotCardsById[subplot.nextCardId];
    if (
      !card ||
      regularCardsDealt() < card.subplotPosition + subplot.positionOffset ||
      skippedChoiceCardIds.has(card.id) ||
      window.playerChoices[card.id] ||
      player.hand.some((heldCard) => heldCard.id === card.id)
    ) {
      continue;
    }
    return card;
  }
  return null;
}

function drawPlayerCard() {
  const subplotCard = getDueSubplotCard();
  if (subplotCard) return subplotCard;
  return Array.isArray(window.deck) && deck.length ? deck.pop() : null;
}

function prepareSubdecks() {
  if (!Array.isArray(window.deck)) return;

  const subdeckA = [];
  const subdeckB = [];

  subplotCardsById = {};
  deck.forEach((card) => {
    if (card.isSubplot) {
      subplotCardsById[card.id] = card;
      return;
    }
    const belongsToSubdeckA =
      (card.id >= 1 && card.id <= 12) ||
      (card.id >= 38 && card.id <= 50);

    if (belongsToSubdeckA) subdeckA.push(card);
    else subdeckB.push(card);
  });

  shuffle(subdeckA);
  shuffle(subdeckB);

  // Cards are drawn with deck.pop(), so Subdeck A must be at the end.
  window.deck = [...subdeckB, ...subdeckA];
  mainDeckSize = window.deck.length;
  chooseActiveSubplots();

  console.log(
    "[DSG] Prepared subdecks — A:",
    subdeckA.length,
    "B:",
    subdeckB.length,
  );
}

function dealOpeningHands() {
  if (!Array.isArray(window.deck)) return;
  for (let i = 0; i < 3; i++) {
    if (deck.length) player.hand.push(deck.pop());
    if (deck.length) AI1.hand.push(deck.pop());
    if (deck.length) AI2.hand.push(deck.pop());
  }
}

// --- Rendering ---
function formatCardDescription(card) {
  const choiceConfig = CHOICE_CARD_OPTIONS[card.id];
  const usesChoiceLayout = Boolean(choiceConfig);
  const configuredDescription =
    typeof choiceConfig?.cardDescription === "function"
      ? choiceConfig.cardDescription()
      : choiceConfig?.cardDescription;
  return String(configuredDescription ?? card.description ?? "")
    .replace(/^\s*\*\s?/gm, "• ")
    .split("\n")
    .map((line) => {
      if (
        !usesChoiceLayout ||
        !line.trim() ||
        line.trimStart().startsWith("•")
      ) {
        return line;
      }
      return `• ${line.trimStart()}`;
    })
    .join("\n");
}

function renderPlayerHand() {
  const handDiv = el("playerHand");
  if (!handDiv) return;
  handDiv.innerHTML = "";
  clearEventHighlights();
  hideEventActionTooltip();

  normaliseActiveHandIndex();
  renderHandNavigation();
  const card = player.hand[activeHandIndex];
  if (!card) return scheduleScoreRailPosition();
  const index = activeHandIndex;
  const cardDiv = document.createElement("div");
  cardDiv.className = "card";
  cardDiv.style.background = card.type === "action" ? "steelblue" : "#E97132";
  cardDiv.tabIndex = 0;
  cardDiv.setAttribute("role", "button");
  cardDiv.setAttribute("aria-label", `${card.name.replace(/^\d+:\s*/, "")}. Card ${index + 1} of ${player.hand.length}. Swipe left for the next card, swipe right to play, or double-tap to skip.`);

  const headerRow = document.createElement("div");
  headerRow.className = "card-header-row";
  const idBadge = document.createElement("div");
  idBadge.className = "card-id";
  idBadge.textContent = card.displayId ?? card.id;
  headerRow.appendChild(idBadge);
  const typeText = document.createElement("span");
  typeText.className = "card-type";
  typeText.textContent = CHOICE_CARD_OPTIONS[card.id] ? "choice" : card.type;
  headerRow.appendChild(typeText);
  cardDiv.appendChild(headerRow);

  const header = document.createElement("h4");
  header.className = "card-name";
  header.textContent = card.name.replace(/^\d+:\s*/, "");
  cardDiv.appendChild(header);
  const desc = document.createElement("div");
  desc.className = "card-desc";
  desc.textContent = formatCardDescription(card);
  cardDiv.appendChild(desc);

  attachCardGestureControls(cardDiv, index);
  cardDiv.addEventListener("click", (event) => {
    if (Date.now() < suppressCardClickUntil ||
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    event.preventDefault();
    playActiveCard(index);
  });
  cardDiv.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault(); showNextHandCard();
    } else if (["ArrowRight", "Enter", " "].includes(event.key)) {
      event.preventDefault(); playActiveCard(index);
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault(); requestSkipConfirmation(index);
    }
  });
  if (card.type === "event") {
    cardDiv.addEventListener("mouseenter", (event) => {
      setEventHighlights(card); showEventActionTooltip(card, event);
    });
    cardDiv.addEventListener("mousemove", positionEventActionTooltip);
    cardDiv.addEventListener("mouseleave", () => {
      clearEventHighlights(); hideEventActionTooltip();
    });
  }
  handDiv.appendChild(cardDiv);

  scheduleScoreRailPosition();
}

function normaliseActiveHandIndex() {
  if (!player.hand.length) return void (activeHandIndex = 0);
  activeHandIndex = ((activeHandIndex % player.hand.length) + player.hand.length) % player.hand.length;
}

function renderHandNavigation() {
  const navigation = el("handNavigation");
  if (!navigation) return;
  if (!player.hand.length) return void (navigation.textContent = "Hand empty");
  const dots = player.hand.map((_, index) =>
    `<span class="hand-dot${index === activeHandIndex ? " is-active" : ""}" aria-hidden="true"></span>`
  ).join("");
  navigation.innerHTML = `<span>← Next</span><span class="gesture-divider">•</span><span class="hand-dots">${dots}</span><span class="gesture-divider">•</span><span>Play →</span><span class="gesture-divider">•</span><span>Double-tap: skip</span>`;
  navigation.setAttribute("aria-label", `Showing card ${activeHandIndex + 1} of ${player.hand.length}`);
}

function resetDraggedCard(cardDiv) {
  cardDiv.classList.remove("swipe-preview-next", "swipe-preview-play");
  cardDiv.classList.add("is-returning");
  cardDiv.style.transform = "translate3d(0,0,0) rotate(0deg)";
  cardDiv.style.opacity = "1";
  setTimeout(() => cardDiv.classList.remove("is-returning"), 180);
}

function animateCardAway(cardDiv, direction, done) {
  if (cardTransitionInProgress || !cardDiv) return;
  cardTransitionInProgress = true;
  suppressCardClickUntil = Date.now() + 600;
  cardDiv.classList.remove("swipe-preview-next", "swipe-preview-play");
  cardDiv.classList.add("is-returning");
  const sign = direction === "left" ? -1 : 1;
  cardDiv.style.transform = `translate3d(${sign * (innerWidth + cardDiv.offsetWidth)}px,0,0) rotate(${sign * 13}deg)`;
  cardDiv.style.opacity = "0";
  setTimeout(() => { cardTransitionInProgress = false; done(); }, 170);
}

function showNextHandCard(cardDiv = document.querySelector("#playerHand .card")) {
  if (cardTransitionInProgress || player.hand.length < 2) return cardDiv && resetDraggedCard(cardDiv);
  animateCardAway(cardDiv, "left", () => {
    activeHandIndex = (activeHandIndex + 1) % player.hand.length;
    renderPlayerHand();
  });
}

function playActiveCard(index = activeHandIndex, cardDiv = document.querySelector("#playerHand .card")) {
  if (cardTransitionInProgress || !player.hand[index]) return;
  animateCardAway(cardDiv, "right", () => handlePlayerCardClick(index));
}

function handleCardTap(index) {
  const now = Date.now();
  if (lastTouchTap.index === index && now - lastTouchTap.time <= 330) {
    lastTouchTap = { time: 0, index: -1 };
    suppressCardClickUntil = now + 500;
    requestSkipConfirmation(index);
  } else lastTouchTap = { time: now, index };
}

function attachCardGestureControls(cardDiv, index) {
  let pointerId = null, pointerType = "", startX = 0, startY = 0;
  let deltaX = 0, deltaY = 0, horizontalDrag = false;
  cardDiv.addEventListener("pointerdown", (event) => {
    if (cardTransitionInProgress || (event.button !== undefined && event.button !== 0)) return;
    pointerId = event.pointerId; pointerType = event.pointerType;
    startX = event.clientX; startY = event.clientY;
    deltaX = deltaY = 0; horizontalDrag = false;
    cardDiv.setPointerCapture?.(pointerId);
  });
  cardDiv.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId || cardTransitionInProgress) return;
    deltaX = event.clientX - startX; deltaY = event.clientY - startY;
    if (!horizontalDrag && Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY) * 1.15) horizontalDrag = true;
    if (!horizontalDrag) return;
    event.preventDefault(); suppressCardClickUntil = Date.now() + 500;
    const dx = Math.max(-innerWidth, Math.min(innerWidth, deltaX));
    cardDiv.style.transition = "none";
    cardDiv.style.transform = `translate3d(${dx}px,0,0) rotate(${dx * .035}deg)`;
    cardDiv.classList.toggle("swipe-preview-next", dx < -32);
    cardDiv.classList.toggle("swipe-preview-play", dx > 32);
  });
  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    cardDiv.releasePointerCapture?.(pointerId); pointerId = null;
    cardDiv.style.removeProperty("transition");
    const threshold = Math.min(105, cardDiv.offsetWidth * .24);
    if (horizontalDrag && Math.abs(deltaX) >= threshold && Math.abs(deltaX) > Math.abs(deltaY)) {
      return deltaX < 0 ? showNextHandCard(cardDiv) : playActiveCard(index, cardDiv);
    }
    resetDraggedCard(cardDiv);
    if (pointerType !== "mouse" && Math.abs(deltaX) < 12 && Math.abs(deltaY) < 12) handleCardTap(index);
  };
  cardDiv.addEventListener("pointerup", finish);
  cardDiv.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null; resetDraggedCard(cardDiv);
  });
}

let scoreRailPositionFrame = null;

function scheduleScoreRailPosition() {
  if (scoreRailPositionFrame !== null) {
    cancelAnimationFrame(scoreRailPositionFrame);
  }
  scoreRailPositionFrame = requestAnimationFrame(() => {
    scoreRailPositionFrame = null;
    positionScoreRail();
  });
}

function positionScoreRail() {
  const rail = el("scoreRail");
  const cards = [...document.querySelectorAll("#playerHand .card")];
  if (!rail || cards.length === 0) return;

  const rightmostCard = cards.reduce((rightmost, card) =>
    card.getBoundingClientRect().right >
    rightmost.getBoundingClientRect().right
      ? card
      : rightmost,
  );
  const cardBounds = rightmostCard.getBoundingClientRect();
  const horizontalMidpoint =
    cardBounds.right + (window.innerWidth - cardBounds.right) / 2;

  rail.style.left = `${horizontalMidpoint}px`;
  rail.style.top = `${cardBounds.top + cardBounds.height / 2}px`;
}

window.addEventListener("resize", scheduleScoreRailPosition);

function logCardPlay(aiName, card, effectSummary = "") {
  const aiLogDiv = el("aiLog");
  if (!aiLogDiv) return;

  const entry = document.createElement("div");
  entry.innerHTML = `<strong>${aiName}</strong> played <em>${card.name}</em>.${effectSummary ? ` ${effectSummary}` : ""}`;
  entry.className = "ai-entry";

  aiLogDiv.prepend(entry);

  // Keep the newest entry visible at the top of the log.
  aiLogDiv.scrollTop = 0;
}

function logSkippedCard(card) {
  const aiLogDiv = el("aiLog");
  if (!aiLogDiv) return;

  const entry = document.createElement("div");
  entry.innerHTML = `<strong>${player.name}</strong> skipped <em>${card.name}</em>.`;
  entry.className = "ai-entry";
  aiLogDiv.prepend(entry);
  aiLogDiv.scrollTop = 0;
}

function renderScoreValue(currentPlayer, field) {
  const value = currentPlayer[field];
  const highlighted = highlightedScoreValues
    .get(currentPlayer)
    ?.has(field);
  return highlighted
    ? `<span class="highlighted-score">${value}</span>`
    : `${value}`;
}

function updateGameInfo() {
  const infoDiv = el("gameInfo");

  if (!infoDiv) return;

  infoDiv.innerHTML = `
    <div class="company-summary player-company">
      <strong>${player.name}</strong><br>
      Progress: ${renderScoreValue(player, "progress")},<br> RAI points: ${renderScoreValue(player, "sustainability")}<br>
      Actions: ${renderCards([...player.actionsPlayed].sort((a, b) => a - b), highlightedActionIds)}
    </div>

    <strong>${AI1.name}</strong><br>
    Progress: ${renderScoreValue(AI1, "progress")},<br> RAI points: ${renderScoreValue(AI1, "sustainability")}<br>
    Actions: ${renderCards([...AI1.actionsPlayed].sort((a, b) => a - b), highlightedActionIds)}<br><br>

    <strong>${AI2.name}</strong><br>
    Progress: ${renderScoreValue(AI2, "progress")},<br> RAI points: ${renderScoreValue(AI2, "sustainability")}<br>
    Actions: ${renderCards([...AI2.actionsPlayed].sort((a, b) => a - b), highlightedActionIds)}<br>
  `;

  updateScoreChart();
}

function updateScoreChart() {
  const plot = el("scoreChartPlot");
  if (!plot) return;

  const scoreMaximum = 28;
  const onePlanetPlayedByPlayer = player.eventsPlayed.has(81);
  const organisations = [
    { organisation: player, isPlayer: true },
    { organisation: AI1, isPlayer: false },
    { organisation: AI2, isPlayer: false },
  ];

  plot.innerHTML = "";

  organisations.forEach(({ organisation, isPlayer }) => {
    const raiValue = organisation.sustainability;
    const progressValue = organisation.progress * 0.5;
    const weightedTotal = raiValue + progressValue;
    const raiHeight = Math.min(raiValue / scoreMaximum, 1) * 100;
    const progressHeight =
      Math.min(progressValue / scoreMaximum, 1 - raiHeight / 100) * 100;
    const column = document.createElement("div");
    const stack = document.createElement("div");
    const raiSegment = document.createElement("div");
    const progressSegment = document.createElement("div");

    column.className = "score-bar-column";
    column.setAttribute(
      "aria-label",
      `${isPlayer ? organisation.name : "Rival"}: ${raiValue} RAI points and ${organisation.progress} Progress points; weighted score ${weightedTotal}.`,
    );

    stack.className = "score-bar-stack";
    stack.title = `${raiValue} RAI + ${organisation.progress} Progress × 0.5 = ${weightedTotal}`;

    raiSegment.className = "score-segment score-segment-rai";
    raiSegment.style.height = `${raiHeight}%`;

    progressSegment.className = "score-segment score-segment-progress";
    progressSegment.style.bottom = `${raiHeight}%`;
    progressSegment.style.height = `${progressHeight}%`;

    stack.append(raiSegment, progressSegment);
    column.appendChild(stack);

    if (isPlayer || onePlanetPlayedByPlayer) {
      const label = document.createElement("div");
      label.className = "score-player-label";
      label.textContent = "YOU";
      column.appendChild(label);
    }

    plot.appendChild(column);
  });
}

function renderCards(idArray, highlightIds = new Set()) {
  return idArray.length === 0
    ? "None"
    : idArray
        .map((rawId) => {
          const id = Number(rawId);
          const card = CARD_BY_ID[id];
          const cardName = card ? card.name : "Unknown Card";
          const isHighlighted = highlightIds.has(id);
          const label = isHighlighted
            ? `<span class="highlighted-action">${id}</span>`
            : `${id}`;
          return `<span title="${cardName}">${label}</span>`;
        })
        .join(", ");
}

function setHTMLById(id, html) {
  const node = el(id);
  if (node) node.innerHTML = html;
}

function updatePlayedLists() {
  setHTMLById(
    "yourActionsPlayed",
    renderCards([...player.actionsPlayed].sort((a, b) => a - b), highlightedActionIds),
  );
  setHTMLById(
    "yourEventsPlayed",
    renderCards([...player.eventsPlayed].sort((a, b) => a - b)),
  );
  setHTMLById(
    "ai1ActionsPlayed",
    renderCards([...AI1.actionsPlayed].sort((a, b) => a - b), highlightedActionIds),
  );
  setHTMLById(
    "ai1EventsPlayed",
    renderCards([...AI1.eventsPlayed].sort((a, b) => a - b)),
  );
  setHTMLById(
    "ai2ActionsPlayed",
    renderCards([...AI2.actionsPlayed].sort((a, b) => a - b), highlightedActionIds),
  );
  setHTMLById(
    "ai2EventsPlayed",
    renderCards([...AI2.eventsPlayed].sort((a, b) => a - b)),
  );
}

// --- Outro message generation ---
function getTechnophiliaMessage(P) {
  const technophiliaAverage =
    P.choicesMade > 0 ? P.technophilia / P.choicesMade : 0;

  if (technophiliaAverage >= 0.5) {
    return "Based on your choices, you are something of an <em>AI sloptimist.</em> For you, RAIs mean Revolutionary AI points. You just wish there weren't so many AI doomers out there spreading bad vibes!";
  }
  if (technophiliaAverage >= 0) {
    return "Based on your choices, you are something of a <em>techno-optimist</em>. For you, RAIs mean Responsible AI points. AI is a tool that can deliver great things, if it is governed responsibly.";
  }
  if (technophiliaAverage >= -0.5) {
    return "Based on your choices, you are something of a <em>critical technologist</em>. For you, RAIs mean Reconsider AI points. You recognise that technologies often have social, economic, and cultural effects that go beyond their most obvious promises, and sometimes should be resisted.";
  }
  return "Based on your choices, you are something of an <em>AI abolitionist</em>. You have been in a very contradictory position, forced to use technologies you feel are fundamentally anathema to long-term prosperity and justice. For you, RAI points really mean Reject AI points.";
}

function generateOutroMessage(P, A1, A2) {
  const scores = [
    { who: "player", value: P.sustainability },
    { who: "ai1", value: A1.sustainability },
    { who: "ai2", value: A2.sustainability },
  ];

  const total = scores.reduce((sum, s) => sum + (Number.isFinite(s.value) ? s.value : 0), 0);

  const pScore = scores[0].value;
  const values = scores.map((s) => s.value);
  const max = Math.max(...values);
  const uniqueSorted = [...new Set(values)].sort((a, b) => b - a);
  const countAt = (v) => values.filter((x) => x === v).length;

  let rankKey = "third";
  if (pScore === max) {
    rankKey = countAt(max) >= 2 ? "first_tie" : "first";
  } else if (uniqueSorted.length > 1 && pScore === uniqueSorted[1]) {
    rankKey = countAt(uniqueSorted[1]) >= 2 ? "second_tie" : "second";
  } else {
    rankKey = "third";
  }

  let placeText = "";
  switch (rankKey) {
    case "first":
      placeText = "1st place";
      break;
    case "first_tie":
      placeText = "tied for 1st place";
      break;
    case "second":
      placeText = "2nd place";
      break;
    case "second_tie":
      placeText = "tied for 2nd place";
      break;
    default:
      placeText = "3rd place";
  }

  let personalMsg = "";
  switch (rankKey) {
    case "first":
      personalMsg = "Using technology responsibly is a shared challenge. You’ve done better than any of your competitors. Congratulations, you have shown leadership!";
      break;
    case "first_tie":
      personalMsg = "You’re tied for first place! Congratulations, you’ve shown leadership in using technology responsibility. This is a shared challenge.";
      break;
    case "second":
    case "second_tie":
      personalMsg = "Using technology responsibly is a shared challenge. You’re somewhere in the middle of the pack, neither leading the way nor lagging behind.";
      break;
    case "third":
    default:
      personalMsg = "You ended the game with some of the worst track record on AI in the sector! This is a shared challenge.";
      break;
  }

  let globalMsg = "";
  if (total <= 25) {
    globalMsg = "As for the global picture? Oh no! The world really is in flames! We really did have a bit of an AI-pocalypse! Now what? Revenge?";
  } else if (total <= 30) {
    globalMsg = "Of course, it’s not just about you. The social and ecological costs of AI have been enormous.";
  } else if (total <= 35) {
    globalMsg = "Globally, we have mostly managed to contain the risks of AI, and the future is now looking very bright!";
  } else if (total <= 40) {
    globalMsg = "Globally, we did it! We pivoted from harmful AI to more convivial, ecologically aligned technologies.";
  } else {
    globalMsg = "Incredible! Radical, deep change has been achieved. Tech is much more green, democratic, and convivial. You must have been smart AND lucky!";
  }

  const technophiliaMsg = getTechnophiliaMessage(P);
  const personalSection = `<p><strong>Your result (${placeText}):</strong> ${personalMsg} ${technophiliaMsg}</p>`;
  const globalSection = `<p><strong>Global picture:</strong> ${globalMsg} Total RAIs: ${total}.</p>`;
  return `${personalSection}${globalSection}`;
}

// --- Turn logic with error guards ---
function getOrganisationLogName(currentPlayer) {
  return currentPlayer === player ? "You" : currentPlayer.name;
}

function getEventEffectSummary(card, players) {
  const rule = getEventRule(card);
  if (!rule) return "";

  if (rule.type === "milestone") {
    return "All progress points turn to RAIs.";
  }

  const sentences = [];
  players.forEach((currentPlayer) => {
    const organisationName = getOrganisationLogName(currentPlayer);

    if (rule.type === "opportunity") {
      const bonus = rule.actionIds.filter((id) =>
        currentPlayer.actionsPlayed.has(id),
      ).length;
      if (bonus > 0) {
        const pointLabel = bonus === 1 ? "point" : "points";
        sentences.push(
          `${organisationName} gained ${bonus} progress ${pointLabel}.`,
        );
      }
    } else if (rule.type === "crisis" && currentPlayer.progress > 0) {
      const isProtected = rule.actionIds.some((id) =>
        currentPlayer.actionsPlayed.has(id),
      );
      sentences.push(
        isProtected
          ? `${organisationName} ${currentPlayer === player ? "were" : "was"} shielded.`
          : `${organisationName} lost all progress.`,
      );
    }
  });

  return sentences.join(" ");
}

function applyEventCardEffect(card, players) {
  const effectSummary = getEventEffectSummary(card, players);
  try {
    applyEventEffect(card, players);
  } catch (e) {
    console.error("[DSG] Error applying event effect for", card, e);
  }
  return effectSummary;
}

const eventImpactNoticeQueue = [];

function showNextEventImpactNotice() {
  const notice = document.getElementById("eventImpactNotice");
  if (!notice || notice.style.display === "block") return;

  const message = eventImpactNoticeQueue.shift();
  if (!message) return;

  notice.textContent = message;
  notice.style.display = "block";
}

function queueEventImpactNotice(message) {
  if (!message) return;
  eventImpactNoticeQueue.push(message);
  showNextEventImpactNotice();
}

function clearEventImpactNotices() {
  eventImpactNoticeQueue.length = 0;
  const notice = document.getElementById("eventImpactNotice");
  if (notice) {
    notice.style.display = "none";
    notice.textContent = "";
  }
}

function dismissEventImpactNotice() {
  const notice = document.getElementById("eventImpactNotice");
  if (!notice || notice.style.display !== "block") return;
  notice.style.display = "none";
  notice.textContent = "";
  showNextEventImpactNotice();
}

const eventImpactNotice = document.getElementById("eventImpactNotice");
if (eventImpactNotice) {
  eventImpactNotice.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      dismissEventImpactNotice();
    }
  });
}

document.addEventListener(
  "click",
  (event) => {
    if (
      !eventImpactNotice ||
      eventImpactNotice.style.display !== "block"
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    dismissEventImpactNotice();
  },
  true,
);

function getPlayerImpactNotice(card, opponentName) {
  const rule = getEventRule(card);
  if (!rule || player.progress <= 0) return "";

  if (rule.type === "milestone") {
    return `${opponentName} played an event card that turned your Progress Points into RAI Points!`;
  }

  if (rule.type === "crisis") {
    const isProtected = rule.actionIds.some((id) =>
      player.actionsPlayed.has(id),
    );
    if (!isProtected) {
      return `${opponentName} played an event card that erased your Progress Points!`;
    }
  }

  return "";
}

function playAI1Card() {
  let card = null;
  let index = AI1.hand.findIndex((c) => c.type === "action");
  if (index !== -1) {
    card = AI1.hand.splice(index, 1)[0];
    AI1.actionsPlayed.add(card.id);
  } else {
    index = AI1.hand.findIndex((c) => c.type === "event");
    if (index !== -1) {
      card = AI1.hand.splice(index, 1)[0];
      AI1.eventsPlayed.add(card.id);
    }
  }
  if (card) {
    let effectSummary = "";
    if (card.type === "event") {
      const playerImpactNotice = getPlayerImpactNotice(card, AI1.name);
      effectSummary = applyEventCardEffect(card, [player, AI1, AI2]);
      queueEventImpactNotice(playerImpactNotice);
    }
    logCardPlay(AI1.name, card, effectSummary);
  }
  if (Array.isArray(window.deck) && deck.length) AI1.hand.push(deck.pop());
}

function playAI2Card() {
  let card = null;
  let index = AI2.hand.findIndex((c) => c.type === "action");
  if (index !== -1) {
    card = AI2.hand.splice(index, 1)[0];
    AI2.actionsPlayed.add(card.id);
  } else {
    index = AI2.hand.findIndex((c) => c.type === "event");
    if (index !== -1) {
      card = AI2.hand.splice(index, 1)[0];
      AI2.eventsPlayed.add(card.id);
    }
  }
  if (card) {
    let effectSummary = "";
    if (card.type === "event") {
      const playerImpactNotice = getPlayerImpactNotice(card, AI2.name);
      effectSummary = applyEventCardEffect(card, [player, AI1, AI2]);
      queueEventImpactNotice(playerImpactNotice);
    }
    logCardPlay(AI2.name, card, effectSummary);
  }
  if (Array.isArray(window.deck) && deck.length) AI2.hand.push(deck.pop());
}

function handlePlayerCardClick(index) {
  if (skipReplacementInProgress) return;

  if (skipArmed) {
    skipPlayerCard(index);
    return;
  }

  const selectedCard = player.hand[index];
  if (!selectedCard) return;
  playCardSfx(getCardSfxType(selectedCard));
  playPlayerCard(index);
}

function skipPlayerCard(index) {
  const selectedCard = player.hand[index];
  if (!selectedCard) return;

  if (
    !selectedCard.isSubplot &&
    (!Array.isArray(window.deck) || deck.length === 0) &&
    !getDueSubplotCard()
  ) {
    setSkipArmed(false);
    return;
  }

  skipReplacementInProgress = true;
  playCardSfx("skip");
  const skippedCard = player.hand.splice(index, 1)[0];
  if (CHOICE_CARD_OPTIONS[skippedCard.id]) {
    skippedChoiceCardIds.add(skippedCard.id);
  }
  if (skippedCard.isSubplot) {
    cancelActiveSubplot(skippedCard.subplotId);
  }
  const replacementCard = drawPlayerCard();
  if (replacementCard) player.hand.push(replacementCard);
  consumeSkipToken();
  logSkippedCard(skippedCard);
  renderPlayerHand();
  updateGameInfo();
  updatePlayedLists();
  showOutroIfGameComplete();

  requestAnimationFrame(() => {
    skipReplacementInProgress = false;
  });
}

let gameResultsShown = false;

function showOutroIfGameComplete() {
  if (
    gameResultsShown ||
    !Array.isArray(window.deck) ||
    window.deck.length !== 0 ||
    !allActiveSubplotsComplete() ||
    player.hand.length !== 0
  ) {
    return false;
  }

  gameResultsShown = true;
  console.log(player.sustainability, player.progress);

  const outro = document.getElementById("outro");
  outro.style.opacity = 1;
  outro.style.display = "flex";
  const outroContent = document.querySelector(".outro-text");
  const message = generateOutroMessage(player, AI1, AI2);
  outroContent.innerHTML = message;
  return true;
}

async function playPlayerCard(index) {
  const selectedCard = player.hand[index];
  if (!selectedCard) return;

  if (CHOICE_CARD_OPTIONS[selectedCard.id]) {
    await promptForCardChoice(selectedCard);
  }

  const chosenCard = player.hand.splice(index, 1)[0];
  if (!chosenCard) return;

  const effectSummary =
    chosenCard.type === "event"
      ? applyEventCardEffect(chosenCard, [player, AI1, AI2])
      : "";

  if (chosenCard.type === "action" && !chosenCard.isSubplot) {
    player.actionsPlayed.add(chosenCard.id);
  } else if (chosenCard.type === "event") {
    player.eventsPlayed.add(chosenCard.id);
  }

  logCardPlay(player.name, chosenCard, effectSummary);

  const replacementCard = drawPlayerCard();
  if (replacementCard) player.hand.push(replacementCard);
  playAI1Card();
  playAI2Card();

  renderPlayerHand();
  updateGameInfo();
  updatePlayedLists();

  showOutroIfGameComplete();
}

// --- Bootstrapping with diagnostics ---
window.onload = () => {
  console.log("[DSG] Boot start");
  console.log(
    "[DSG] deck present?",
    typeof window.deck,
    "isArray?",
    Array.isArray(window.deck),
    "length:",
    window.deck && window.deck.length,
  );

  if (!Array.isArray(window.deck)) {
    console.error(
      "[DSG] deck.js did not define window.deck as an array. In deck.js use: window.deck = [ /* cards */ ];",
    );
  } else if (window.deck.length === 0) {
    console.error("[DSG] deck is an empty array. Add cards to deck.js.");
  } else {
    console.log("[DSG] first 3 cards sample:", window.deck.slice(0, 3));
  }

  if (Array.isArray(window.deck) && window.deck.length > 0) {
    initCardLookup();
    prepareSubdecks();
    dealOpeningHands();
    console.log(
      "[DSG] Dealt hands — player:",
      player.hand.length,
      "AI1:",
      AI1.hand.length,
      "AI2:",
      AI2.hand.length,
    );
    console.log("[DSG] Top of deck after deal:", deck.slice(-3));
  } else {
    console.warn("[DSG] Skipping deal because deck is missing/empty.");
  }

  renderPlayerHand();
  updateGameInfo();
  updatePlayedLists();
  updateSkipUI();

  // Set AI labels (matches YOUR HTML IDs). Falls back to alternative IDs if present.
  const a1Header = el("ai1ActionsHeader") || el("ai1ActionsLabel");
  const a1EHeader = el("ai1EventsHeader") || el("ai1EventsLabel");
  const a2Header = el("ai2ActionsHeader") || el("ai2ActionsLabel");
  const a2EHeader = el("ai2EventsHeader") || el("ai2EventsLabel");

  if (a1Header) a1Header.textContent = `${AI1.name} Actions Played`;
  if (a1EHeader) a1EHeader.textContent = `${AI1.name} Events Played`;
  if (a2Header) a2Header.textContent = `${AI2.name} Actions Played`;
  if (a2EHeader) a2EHeader.textContent = `${AI2.name} Events Played`;

  console.log("[DSG] Boot end");
};
