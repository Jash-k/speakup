import { CATEGORIES, FREE_TALK_TOPICS, LEVELS, findScenario } from './scenarios.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE = {
  settings: 'speakup.settings.v1',
  sessions: 'speakup.sessions.v1',
  words: 'speakup.words.v1',
};
const DEFAULTS = { key: '', model: 'gemini-3.1-flash-lite', level: 'intermediate', accent: 'en-IN', speed: 0.9, autoSpeak: true, pronunciation: false, audioConsent: false };
const scenarioTeasers = {
  'free-chat': 'Everyday conversation, no script needed',
  'free-opinion': 'Share what you think and why',
  'free-story': 'Tell a memorable story from your life',
  'int-hr': 'Strengths, goals and common HR questions',
  'int-tell': 'Build a confident self-introduction',
  'int-tech': 'Explain your project and your role',
  'int-salary': 'Practise a polite salary conversation',
  'off-standup': 'Yesterday, today and blockers',
  'off-manager': 'Ask for help, leave or feedback',
  'off-client': 'Updates, timelines and client questions',
  'off-present': 'Present an idea and handle questions',
  'day-restaurant': 'Order a meal and make a request',
  'day-shopping': 'Ask about products, prices and returns',
  'day-doctor': 'Describe symptoms in a role-play',
  'day-travel': 'Check-in, travel and hotel situations',
  'day-phone': 'Explain a problem on a support call',
  'st-meet': 'Make a warm first impression',
  'st-weekend': 'Chat about plans and weekends',
  'st-colleague': 'Easy conversation over lunch',
};

function readJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { toast('This browser could not save your data. Check available storage.', 'error'); }
}
function loadSettings() {
  const saved = readJSON(STORE.settings, {});
  return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
}

const state = {
  settings: loadSettings(),
  selectedCategory: 'free',
  currentScenario: null,
  drillWord: '',
  turns: [],
  sessionStartedAt: 0,
  sessionEndAt: 0,
  inFlight: false,
  recording: null,
  serverKeyConfigured: false,
  histories: readJSON(STORE.sessions, []),
  trickyWords: readJSON(STORE.words, []),
  lastSummary: null,
  toastTimer: 0,
};
if (!Array.isArray(state.histories)) state.histories = [];
if (!Array.isArray(state.trickyWords)) state.trickyWords = [];

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const dom = {
  home: $('#homeScreen'), session: $('#sessionScreen'), summary: $('#summaryScreen'),
  categoryTabs: $('#categoryTabs'), scenarioGrid: $('#scenarioGrid'), homeStats: $('#homeStats'),
  connectTitle: $('#connectTitle'), connectDescription: $('#connectDescription'), connectHomeBtn: $('#connectHomeBtn'),
  homeLevel: $('#homeLevel'), pronHome: $('#pronunciationHome'), pronSession: $('#pronunciationSession'),
  pronHomeLabel: $('#pronHomeLabel'), pronSessionLabel: $('#pronSessionLabel'), pronSessionNote: $('#pronSessionNote'),
  sessionPill: $('#sessionCategoryPill'), sessionTitle: $('#sessionTitle'), sessionSubtitle: $('#sessionSubtitle'),
  conversation: $('#conversation'), typing: $('#typingIndicator'), recordingStatus: $('#recordingStatus'), recordingText: $('#recordingText'), recordingTimer: $('#recordingTimer'),
  messageForm: $('#messageForm'), messageInput: $('#messageInput'), micButton: $('#micButton'), sendButton: $('#sendButton'), turnCounter: $('#turnCounter'),
  speechSupportNote: $('#speechSupportNote'), composerHint: $('#composerHint'), settingsModal: $('#settingsModal'), historyModal: $('#historyModal'), wordsModal: $('#wordsModal'), privacyModal: $('#privacyModal'),
  keyInput: $('#apiKeyInput'), modelSelect: $('#modelSelect'), accentSelect: $('#accentSelect'), speedRange: $('#speedRange'), speedValue: $('#speedValue'), autoSpeak: $('#autoSpeakToggle'),
  settingsFeedback: $('#settingsFeedback'), serverKeyHint: $('#serverKeyHint'), historyList: $('#historyList'), wordsList: $('#trickyWordsList'), wordCount: $('#wordCount'), toast: $('#toast'),
  summaryMetrics: $('#summaryMetrics'), summaryDetails: $('#summaryDetails'), summarySubtitle: $('#summarySubtitle'),
};

function create(tag, className = '', text = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}
function icon(useId) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${useId}`);
  svg.append(use);
  return svg;
}
function formatDate(dateValue, includeTime = false) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const options = includeTime
    ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }
    : { weekday: 'short', month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(undefined, options).format(date);
}
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins ? `${mins}:${String(secs).padStart(2, '0')}` : `0:${String(secs).padStart(2, '0')}`;
}
function setScreen(which) {
  for (const screen of [dom.home, dom.session, dom.summary]) screen.classList.add('hidden');
  which.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
function toast(message, type = '') {
  window.clearTimeout(state.toastTimer);
  dom.toast.textContent = message;
  dom.toast.className = `toast${type ? ` toast-${type}` : ''}`;
  state.toastTimer = window.setTimeout(() => dom.toast.classList.add('hidden'), 3900);
}
function openModal(modal) {
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  const first = modal.querySelector('input,button,select');
  window.setTimeout(() => first?.focus(), 80);
}
function closeModal(modal) {
  modal.classList.add('hidden');
  if ($$('.modal-layer:not(.hidden)').length === 0) document.body.style.overflow = '';
}
function closeAllModals() {
  $$('.modal-layer').forEach((m) => m.classList.add('hidden'));
  document.body.style.overflow = '';
}
function persistSettings() { saveJSON(STORE.settings, state.settings); }
function hasAPIKey() { return Boolean(state.settings.key || state.serverKeyConfigured); }

function renderCategories() {
  dom.categoryTabs.replaceChildren();
  for (const category of CATEGORIES) {
    const button = create('button', `category-tab${state.selectedCategory === category.id ? ' active' : ''}`);
    button.type = 'button'; button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', String(state.selectedCategory === category.id));
    const emoji = create('span', 'cat-emoji', category.emoji);
    const name = create('span', '', category.title);
    button.append(emoji, name);
    button.addEventListener('click', () => {
      state.selectedCategory = category.id;
      renderCategories(); renderScenarios();
    });
    dom.categoryTabs.append(button);
  }
}
function renderScenarios() {
  const category = CATEGORIES.find((item) => item.id === state.selectedCategory) || CATEGORIES[0];
  dom.scenarioGrid.replaceChildren();
  for (const scenario of category.scenarios) {
    const card = create('button', 'scenario-card');
    card.type = 'button';
    card.setAttribute('aria-label', `Start ${scenario.title}: ${scenarioTeasers[scenario.id] || category.desc}`);
    const top = create('span', 'scenario-card-top');
    const emoji = create('span', 'scenario-emoji', scenario.emoji);
    const arrow = create('span', 'scenario-arrow'); arrow.append(icon('i-arrow'));
    top.append(emoji, arrow);
    card.append(top, create('span', 'scenario-title', scenario.title), create('span', 'scenario-desc', scenarioTeasers[scenario.id] || category.desc));
    card.addEventListener('click', () => startSession(findScenario(scenario.id)));
    dom.scenarioGrid.append(card);
  }
}
function setPronunciation(value, askConsent = true) {
  if (value && !state.settings.audioConsent && askConsent) {
    const accepted = window.confirm('With pronunciation feedback on, SpeakUp sends the audio from each microphone turn to Google Gemini for approximate pronunciation guidance. SpeakUp does not save the recording. Google’s free-tier terms may allow submitted content to be used to improve products. Continue?');
    if (!accepted) value = false;
    else state.settings.audioConsent = true;
  }
  state.settings.pronunciation = Boolean(value);
  persistSettings();
  updatePronunciationUI();
}
function updatePronunciationUI() {
  const enabled = Boolean(state.settings.pronunciation);
  dom.pronHome.checked = enabled;
  dom.pronSession.checked = enabled;
  dom.pronHomeLabel.textContent = enabled ? 'On' : 'Off';
  dom.pronSessionLabel.textContent = enabled ? 'On' : 'Off';
  dom.pronSessionNote.textContent = enabled ? 'On · speak with your mic to get approximate feedback' : 'Off · switch on to get voice feedback';
}
function updateConnectionUI() {
  const connected = hasAPIKey();
  if (connected) {
    dom.connectTitle.textContent = 'Your AI partner is ready';
    dom.connectDescription.textContent = state.serverKeyConfigured && !state.settings.key
      ? 'A key is configured for this app. Choose a practice mode whenever you’re ready.'
      : 'Your Gemini key is saved in this browser. Choose a practice mode whenever you’re ready.';
    $('#connectButtonLabel').textContent = 'Settings';
  } else {
    dom.connectTitle.textContent = 'One quick setup to unlock your AI partner';
    dom.connectDescription.textContent = 'Add your free Gemini API key in Settings. You can explore the practice modes now.';
    $('#connectButtonLabel').textContent = 'Set up AI';
  }
  dom.serverKeyHint.textContent = state.serverKeyConfigured && !state.settings.key
    ? 'A Gemini key is configured on this server. Keep this app private if it is shared online; anyone with access could use the AI quota.'
    : 'The key is saved in this browser and sent through this app to Google when you practise. Don’t use a shared device or share a public app URL.';
}
function refreshHomeStats() {
  const history = Array.isArray(state.histories) ? state.histories : [];
  const totalMins = history.reduce((sum, item) => sum + (Number(item.minutes) || 0), 0);
  dom.homeStats.replaceChildren();
  const sessions = create('div', 'stat-mini');
  sessions.append(icon('i-spark'), create('span', '', `${history.length} ${history.length === 1 ? 'session' : 'sessions'}`));
  const time = create('div', 'stat-mini');
  time.append(icon('i-clock'), create('span', '', `${totalMins} `));
  const timeStrong = create('strong', '', 'min practised'); time.lastChild.append(timeStrong);
  dom.homeStats.append(sessions, time);
}
function showSettings() {
  dom.keyInput.value = state.settings.key || '';
  dom.modelSelect.value = state.settings.model || DEFAULTS.model;
  dom.accentSelect.value = state.settings.accent || DEFAULTS.accent;
  dom.speedRange.value = String(state.settings.speed || DEFAULTS.speed);
  dom.speedValue.textContent = `${Number(dom.speedRange.value).toFixed(2).replace(/0$/, '')}×`;
  dom.autoSpeak.checked = state.settings.autoSpeak !== false;
  dom.settingsFeedback.textContent = '';
  dom.settingsFeedback.className = 'settings-feedback';
  updateConnectionUI();
  openModal(dom.settingsModal);
}
function saveSettingsFromForm() {
  state.settings.key = dom.keyInput.value.trim();
  state.settings.model = dom.modelSelect.value;
  state.settings.accent = dom.accentSelect.value;
  state.settings.speed = Number(dom.speedRange.value);
  state.settings.autoSpeak = dom.autoSpeak.checked;
  persistSettings();
  updateConnectionUI();
  dom.settingsFeedback.textContent = 'Settings saved on this device.';
  dom.settingsFeedback.className = 'settings-feedback';
}
function openSettingsForKey() {
  showSettings();
  dom.settingsFeedback.textContent = 'Paste your Gemini API key here, then choose Save settings.';
  dom.keyInput.focus();
}

function findCategoryForScenario(scenario) {
  if (scenario.category) return scenario.category;
  for (const category of CATEGORIES) if (category.scenarios.some((item) => item.id === scenario.id)) return category;
  return { id: 'pronunciation', title: 'Pronunciation practice', emoji: '🗣️', desc: 'A one-word speaking drill' };
}
function startSession(scenario) {
  if (!scenario) return;
  state.currentScenario = scenario;
  state.turns = [];
  state.sessionStartedAt = Date.now();
  state.sessionEndAt = 0;
  state.inFlight = false;
  dom.conversation.replaceChildren();
  const category = findCategoryForScenario(scenario);
  dom.sessionPill.textContent = `${category.emoji}  ${category.title}`;
  dom.sessionTitle.textContent = scenario.title;
  const level = LEVELS[state.settings.level] || LEVELS.intermediate;
  dom.sessionSubtitle.textContent = state.drillWord
    ? `A short repeat-after-me practice for “${state.drillWord}”.`
    : `${category.desc} · ${level.label} English`;
  const opener = scenario.opener || FREE_TALK_TOPICS[Math.floor(Math.random() * FREE_TALK_TOPICS.length)];
  appendAssistantMessage(opener, { opener: true });
  updateTurnCounter();
  updatePronunciationUI();
  updateConnectionUI();
  updateSpeechSupportNote();
  dom.messageInput.value = '';
  setScreen(dom.session);
  window.setTimeout(() => dom.messageInput.focus({ preventScroll: true }), 350);
  if (state.settings.autoSpeak) speak(opener);
}
function startWordDrill(word) {
  closeAllModals();
  const cleanWord = String(word?.word || '').trim();
  if (!cleanWord) return;
  state.drillWord = cleanWord;
  const category = { id: 'pronunciation', title: 'Word practice', emoji: '🔤', desc: 'A quick word-by-word pronunciation drill' };
  const scenario = {
    id: `drill-${cleanWord.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    title: `Practise “${cleanWord}”`, emoji: '🔤', category,
    role: `You are a patient English pronunciation coach. The single target word is “${cleanWord}”. Ask the learner to say it slowly, then use it in a short sentence. If an audio clip is provided, give gentle, approximate feedback on how clearly this word was understood and one practical stress or sound tip. Do not claim phoneme-level accuracy. Keep the drill short, supportive and focused on this word.`,
    opener: `Let’s practise “${cleanWord}”. First, say the word by itself. Then try using it in a short sentence.`,
  };
  if (!state.settings.pronunciation) setPronunciation(true);
  startSession(scenario);
}
function updateTurnCounter() {
  const n = state.turns.length;
  dom.turnCounter.textContent = `${n} ${n === 1 ? 'turn' : 'turns'}`;
}
function setBusy(busy) {
  state.inFlight = busy;
  dom.sendButton.disabled = busy;
  dom.micButton.disabled = busy;
  dom.messageInput.disabled = busy;
  dom.typing.classList.toggle('hidden', !busy);
  if (busy) {
    dom.conversation.scrollTop = dom.conversation.scrollHeight;
  }
}
function appendAssistantMessage(text, options = {}) {
  const row = create('div', 'message-row assistant-message');
  row.append(create('span', 'assistant-avatar', 'S'));
  const col = create('div', 'message-column');
  col.append(create('div', 'bubble', text));
  const tools = create('div', 'message-tools');
  const listen = create('button', 'listen-button'); listen.type = 'button'; listen.title = 'Listen to this message';
  listen.append(icon('i-volume'), create('span', '', 'Listen'));
  listen.addEventListener('click', () => speak(text));
  tools.append(listen);
  if (options.opener) tools.append(create('span', 'bubble-label', 'Start of conversation'));
  col.append(tools); row.append(col); dom.conversation.append(row);
  scrollConversation();
  return { row, col };
}
function appendUserMessage(text, isVoice = false) {
  const row = create('div', 'message-row user-message');
  const col = create('div', 'message-column');
  const shownText = text || (isVoice ? '🎤 Voice reply' : '');
  col.append(create('div', 'bubble', shownText));
  col.append(create('span', 'bubble-label', 'You'));
  row.append(col); dom.conversation.append(row);
  scrollConversation();
  return { row, bubble: $('.bubble', col) };
}
function addSystemNote(text, className = '') {
  const node = create('div', `system-note${className ? ` ${className}` : ''}`, text);
  dom.conversation.append(node); scrollConversation(); return node;
}
function scrollConversation() {
  window.requestAnimationFrame(() => { dom.conversation.scrollTop = dom.conversation.scrollHeight; });
}
function appendFeedback(result, turnIndex, hadAudio) {
  const corrections = Array.isArray(result.corrections) ? result.corrections.slice(0, 12) : [];
  if (corrections.length) {
    const card = create('div', 'feedback-card');
    const header = create('div', 'feedback-header');
    header.append(create('span', 'feedback-icon', '✎'), create('span', '', `A small improvement${corrections.length > 1 ? 's' : ''}`));
    card.append(header);
    corrections.forEach((item) => {
      const block = create('div', 'correction-item');
      const pair = create('div', 'correction-pair');
      pair.append(create('span', 'correction-old', item.sentence || ''), create('span', 'correction-arrow', '→'), create('span', 'correction-new', item.improved || ''));
      block.append(pair);
      if (item.why) block.append(create('div', 'correction-why', item.why));
      card.append(block);
    });
    dom.conversation.append(card);
  } else {
    const nice = create('div', 'nice-note');
    nice.append(create('span', '', '✓'), create('span', '', 'That was clear and natural — nice work!'));
    dom.conversation.append(nice);
  }

  const pron = result.pronunciation || {};
  if (state.settings.pronunciation) {
    const card = create('div', 'pronunciation-result');
    const heading = create('div', 'pron-result-heading');
    heading.append(create('span', 'pron-result-title', 'Pronunciation · AI estimate'));
    if (hadAudio && Number(pron.score) > 0) heading.append(create('span', 'pron-score', `${Math.max(1, Math.min(10, Math.round(pron.score)))}/10`));
    card.append(heading);
    if (!hadAudio) {
      card.append(create('p', 'pron-tip', 'No audio in this turn. Tap the microphone to practise pronunciation; typed replies get grammar feedback only.'));
    } else {
      const words = Array.isArray(pron.words) ? pron.words.slice(0, 3) : [];
      words.forEach((item) => {
        const word = create('div', 'pron-word');
        const name = create('span', 'pron-word-name', item.word || '');
        const phonetic = create('span', 'pron-word-phonetic', item.phonetic || '');
        const save = create('button', 'save-word-button', '＋ Save word');
        save.type = 'button'; save.dataset.word = item.word || '';
        save.dataset.phonetic = item.phonetic || '';
        save.dataset.tip = item.tip || pron.tip || '';
        word.append(name, phonetic, save);
        if (item.tip) word.append(create('span', 'pron-word-tip', item.tip));
        card.append(word);
      });
      if (pron.tip) card.append(create('p', 'pron-tip', pron.tip));
      if (!Number(pron.score) && !words.length && !pron.tip) card.append(create('p', 'pron-tip', 'I couldn’t get a clear pronunciation read from this clip. Try a short sentence in a quieter place.'));
      card.append(create('div', 'feedback-note', 'A friendly guide, not a formal pronunciation test.'));
    }
    dom.conversation.append(card);
  }
  scrollConversation();
}
function normalizeResult(parsed, typedText, hadAudio) {
  const transcript = String(parsed?.transcript || typedText || '').trim();
  const reply = String(parsed?.reply || 'Thanks for sharing that. Could you tell me a little more?').trim();
  const corrections = Array.isArray(parsed?.corrections)
    ? parsed.corrections.filter((item) => item && item.improved).map((item) => ({
      sentence: String(item.sentence || typedText || '').trim(),
      improved: String(item.improved || '').trim(),
      why: String(item.why || '').trim(),
    }))
    : [];
  const p = parsed?.pronunciation || {};
  const pronunciation = {
    score: hadAudio ? Math.max(0, Math.min(10, Number(p.score) || 0)) : 0,
    words: Array.isArray(p.words) ? p.words.filter((item) => item?.word).slice(0, 3).map((item) => ({
      word: String(item.word).trim(), phonetic: String(item.phonetic || '').trim(), tip: String(item.tip || '').trim(),
    })) : [],
    tip: String(p.tip || '').trim(),
  };
  return { transcript, reply, corrections, pronunciation };
}
function buildSystemPrompt(hadAudio) {
  const scenario = state.currentScenario || {};
  const level = LEVELS[state.settings.level] || LEVELS.intermediate;
  let prompt = `You are SpeakUp, a warm, practical English conversation partner and communication coach. Role-play instructions: ${scenario.role || 'Have a friendly everyday conversation.'}\n\nLearner level: ${level.prompt}\n\nBehavior: Reply naturally to what the learner said in 1–3 short sentences, then ask at most one useful follow-up question. Keep the conversation moving; do not give a lecture. Be encouraging, never shame or mock. Treat Indian English and other English varieties respectfully; do not label an accent as a mistake.\n\nCorrections: Review the learner's whole turn. Give a separate correction item for each sentence that needs a meaningful grammar, word-choice or naturalness improvement. In each item, put the learner's full sentence in "sentence", a natural standard-English alternative in "improved", and a brief, kind explanation in "why". Do not invent mistakes or over-correct valid conversational English. If there are no useful corrections, return an empty array. Keep explanations easy to understand.\n\nTranscript: ${hadAudio ? 'Listen to the attached audio. Return the words actually spoken in "transcript". If a browser transcript is included, treat it as a helpful draft and correct obvious recognition mistakes using the audio.' : 'There is no audio. Return the learner text unchanged in "transcript".'}\n\nPronunciation: ${hadAudio ? 'Give a gentle, approximate 1–10 estimate of how understandable the spoken English sounded, based only on this short clip. This is not a formal or phoneme-level test. Mention only up to three words that were genuinely difficult to understand; use a simple respelling in "phonetic" (not IPA) and give one practical sound or stress hint. Respect the learner’s accent.' : 'No audio is attached. Set score to 0, words to an empty array, and use an empty tip.'}\n\nOutput only a valid JSON object matching the response schema. Do not include Markdown fences or extra text.`;
  if (state.drillWord) {
    prompt += `\n\nFocused pronunciation drill: The target is the word “${state.drillWord}”. Keep your response focused on helping the learner repeat it, then use it in a short sentence. If audio is included, give approximate feedback specifically on this target. Avoid unrelated grammar corrections unless needed for meaning.`;
  }
  return prompt;
}
const responseSchema = {
  type: 'OBJECT',
  properties: {
    transcript: { type: 'STRING' },
    reply: { type: 'STRING' },
    corrections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: { sentence: { type: 'STRING' }, improved: { type: 'STRING' }, why: { type: 'STRING' } },
        required: ['sentence', 'improved', 'why'],
      },
    },
    pronunciation: {
      type: 'OBJECT',
      properties: {
        score: { type: 'INTEGER' },
        words: {
          type: 'ARRAY', items: {
            type: 'OBJECT', properties: { word: { type: 'STRING' }, phonetic: { type: 'STRING' }, tip: { type: 'STRING' } },
            required: ['word', 'phonetic', 'tip'],
          },
        },
        tip: { type: 'STRING' },
      },
      required: ['score', 'words', 'tip'],
    },
  },
  required: ['transcript', 'reply', 'corrections', 'pronunciation'],
};
async function blobToBase64(blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}
function getHistoryContents() {
  const contents = [];
  for (const turn of state.turns.slice(-10)) {
    contents.push({ role: 'user', parts: [{ text: turn.user }] });
    contents.push({ role: 'model', parts: [{ text: turn.reply }] });
  }
  return contents;
}
async function requestGemini(text, audioBlob = null) {
  const key = state.settings.key || '';
  const parts = [];
  if (audioBlob) {
    parts.push({ text: text ? `The phone speech recognizer tentatively heard: “${text}”. Listen to the audio and use it to correct any recognition errors.` : 'Please transcribe the spoken English in the attached audio, then respond naturally to it.' });
    parts.push({ inlineData: { mimeType: (audioBlob.type || 'audio/webm').split(';')[0], data: await blobToBase64(audioBlob) } });
  } else {
    parts.push({ text: text || 'Hello!' });
  }
  const contents = getHistoryContents();
  contents.push({ role: 'user', parts });
  const body = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(Boolean(audioBlob)) }] },
    contents,
    generationConfig: { temperature: 0.72, maxOutputTokens: 850, responseMimeType: 'application/json', responseSchema },
  };
  const response = await fetch('/api/gemini', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, model: state.settings.model || DEFAULTS.model, body }),
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error('The AI service returned an unreadable response. Please try again.'); }
  if (!response.ok) {
    let message = data?.error?.message || data?.error || `Request failed (${response.status}).`;
    if (response.status === 401 || response.status === 403) message = 'That API key was not accepted. Check it in Settings and try again.';
    if (response.status === 429) message = 'Gemini is busy or the free quota was reached. Wait a little, or check your Google AI Studio limits.';
    throw new Error(String(message));
  }
  const rawText = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
  if (!rawText) {
    const reason = data?.promptFeedback?.blockReason;
    throw new Error(reason ? `Gemini could not answer this turn (${reason}). Try a different reply.` : 'Gemini did not return a reply. Please try again.');
  }
  let parsed;
  try { parsed = JSON.parse(rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }
  catch { parsed = { transcript: text, reply: rawText, corrections: [], pronunciation: { score: 0, words: [], tip: '' } }; }
  return normalizeResult(parsed, text, Boolean(audioBlob));
}
async function sendTurn(rawText, audioBlob = null) {
  if (state.inFlight || !state.currentScenario) return;
  const text = String(rawText || '').trim();
  if (!text && !audioBlob) { toast('Say something or type a reply to begin.', ''); return; }
  if (!hasAPIKey()) {
    if (text) dom.messageInput.value = text;
    addSystemNote('Add your Gemini API key in Settings to get live AI replies. This draft is still here.');
    openSettingsForKey();
    return;
  }
  state.settings.level = dom.homeLevel.value || state.settings.level;
  persistSettings();
  const bubble = appendUserMessage(text, Boolean(audioBlob));
  dom.messageInput.value = '';
  autoGrowInput();
  setBusy(true);
  try {
    const result = await requestGemini(text, audioBlob);
    const transcript = result.transcript || text || '🎤 Voice reply';
    bubble.bubble.textContent = transcript;
    const message = appendAssistantMessage(result.reply);
    appendFeedback(result, state.turns.length, Boolean(audioBlob));
    state.turns.push({
      user: transcript,
      reply: result.reply,
      corrections: result.corrections,
      pronunciation: result.pronunciation,
      hadAudio: Boolean(audioBlob),
      at: Date.now(),
    });
    updateTurnCounter();
    if (state.settings.autoSpeak) speak(result.reply);
    bubble.row.setAttribute('aria-label', `You said: ${transcript}`);
    message.row.setAttribute('aria-label', `SpeakUp replied: ${result.reply}`);
  } catch (error) {
    bubble.row.remove();
    addSystemNote(error.message || 'Could not reach Gemini. Check your connection and Settings, then try again.', 'error-note');
    if (text) dom.messageInput.value = text;
    toast(error.message || 'Could not reach Gemini. Try again.', 'error');
    if (/API key|key was not accepted/i.test(error.message || '')) showSettings();
  } finally {
    setBusy(false);
    dom.messageInput.focus({ preventScroll: true });
    scrollConversation();
  }
}

async function testConnection() {
  dom.settingsFeedback.textContent = 'Checking the connection…';
  dom.settingsFeedback.className = 'settings-feedback';
  const key = dom.keyInput.value.trim() || state.settings.key || '';
  const model = dom.modelSelect.value || state.settings.model;
  $('#testConnection').disabled = true;
  try {
    const response = await fetch('/api/gemini', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, model, body: { contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: SpeakUp is connected.' }] }], generationConfig: { maxOutputTokens: 20, temperature: 0 } } }),
    });
    const data = await response.json();
    if (!response.ok) {
      let message = data?.error?.message || data?.error || 'Connection test failed.';
      if (response.status === 401) message = 'Add a valid Gemini API key first.';
      if (response.status === 429) message = 'Gemini free quota or rate limit reached. Try later.';
      throw new Error(String(message));
    }
    dom.settingsFeedback.textContent = 'Connected! Your selected Gemini model replied.';
    dom.settingsFeedback.className = 'settings-feedback';
  } catch (error) {
    dom.settingsFeedback.textContent = error.message || 'Could not test the connection.';
    dom.settingsFeedback.className = 'settings-feedback error';
  } finally {
    $('#testConnection').disabled = false;
  }
}

function updateSpeechSupportNote() {
  if (SpeechRecognition) {
    dom.speechSupportNote.textContent = 'Mic: tap once to speak, tap again to send.';
    dom.composerHint.textContent = 'Enter to send · Shift + Enter for a new line';
  } else if (state.settings.pronunciation && navigator.mediaDevices?.getUserMedia && window.MediaRecorder) {
    dom.speechSupportNote.textContent = 'Mic audio can be transcribed by Gemini while pronunciation is on.';
  } else {
    dom.speechSupportNote.textContent = 'Speech-to-text unavailable here; you can type your reply.';
  }
}
function setRecordingUI(on) {
  dom.micButton.classList.toggle('recording', on);
  dom.micButton.setAttribute('aria-label', on ? 'Stop speaking and send' : 'Start speaking');
  dom.micButton.title = on ? 'Tap to finish speaking' : 'Speak your reply';
  dom.recordingStatus.classList.toggle('hidden', !on);
  updateSpeechSupportNote();
}
async function startVoiceCapture() {
  if (state.inFlight || state.recording) return;
  if (!SpeechRecognition && !(state.settings.pronunciation && navigator.mediaDevices?.getUserMedia && window.MediaRecorder)) {
    toast('Speech input is not available here. Type your reply, or turn on pronunciation feedback and use a secure site.', 'error');
    dom.messageInput.focus();
    return;
  }
  if (state.settings.pronunciation && !navigator.mediaDevices?.getUserMedia) {
    toast('Microphone recording needs a secure HTTPS page. You can still type, or turn pronunciation feedback off.', 'error');
    return;
  }

  const rec = {
    recognition: null, stream: null, recorder: null, chunks: [], audioBlob: null,
    transcript: '', interim: '', recognitionDone: !SpeechRecognition, recorderDone: !state.settings.pronunciation,
    manual: false, finalizing: false, startedAt: Date.now(), timer: 0, previousText: dom.messageInput.value,
  };
  state.recording = rec;
  setRecordingUI(true);
  dom.recordingText.textContent = state.settings.pronunciation
    ? 'Listening and recording for feedback… tap the mic when you’re done'
    : 'Listening… tap the mic again when you’re done';

  if (state.settings.pronunciation) {
    try {
      rec.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (state.recording !== rec) { rec.stream.getTracks().forEach((track) => track.stop()); return; }
      if (window.MediaRecorder) {
        const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((type) => MediaRecorder.isTypeSupported?.(type));
        rec.recorder = mime ? new MediaRecorder(rec.stream, { mimeType: mime }) : new MediaRecorder(rec.stream);
        rec.recorder.ondataavailable = (event) => { if (event.data?.size) rec.chunks.push(event.data); };
        rec.recorder.onstop = () => {
          const blob = new Blob(rec.chunks, { type: rec.recorder?.mimeType || rec.chunks[0]?.type || 'audio/webm' });
          if (blob.size > 0) rec.audioBlob = blob;
          rec.recorderDone = true;
          rec.stream?.getTracks().forEach((track) => track.stop());
          rec.stream = null;
          tryFinishVoiceCapture(rec);
        };
        rec.recorder.start(250);
        rec.recorderDone = false;
      } else {
        rec.recorderDone = true;
        toast('Your browser can transcribe speech, but cannot record audio for pronunciation feedback.', 'error');
      }
    } catch (error) {
      rec.recorderDone = true;
      rec.stream?.getTracks().forEach((track) => track.stop());
      rec.stream = null;
      dom.recordingText.textContent = 'Microphone permission was not granted. You can type instead.';
      toast('Allow microphone access in your browser, then try again.', 'error');
      if (state.recording !== rec) return;
    }
  }

  if (SpeechRecognition) {
    try {
      const recognition = new SpeechRecognition();
      rec.recognition = recognition;
      recognition.lang = state.settings.accent || 'en-IN';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        let finalText = '';
        let interimText = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) finalText += `${result[0]?.transcript || ''} `;
          else interimText += `${result[0]?.transcript || ''} `;
        }
        rec.transcript = finalText.trim();
        rec.interim = interimText.trim();
        const preview = [rec.transcript, rec.interim].filter(Boolean).join(' ').trim();
        if (preview) { dom.messageInput.value = preview; autoGrowInput(); }
      };
      recognition.onerror = (event) => {
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          dom.recordingText.textContent = 'Microphone or speech permission was blocked. You can type instead.';
          toast('Allow microphone access in your browser settings.', 'error');
          rec.transcript = '';
          if (!rec.audioBlob && !rec.recorder) stopVoiceCapture(true);
        } else if (event.error === 'no-speech') {
          dom.recordingText.textContent = 'I didn’t hear speech yet. Keep talking or tap the mic to finish.';
        } else {
          dom.recordingText.textContent = 'Speech recognition paused. Tap the mic to finish this turn.';
        }
      };
      recognition.onend = () => {
        rec.recognitionDone = true;
        if (!rec.manual && state.recording === rec) {
          // Mobile browsers may end recognition after a short pause. Finish the paired audio too.
          stopRecorderOnly(rec);
        }
        tryFinishVoiceCapture(rec);
      };
      recognition.start();
    } catch (error) {
      rec.recognitionDone = true;
      if (!state.settings.pronunciation) {
        state.recording = null;
        setRecordingUI(false);
        toast('Could not start speech recognition. Type your reply instead.', 'error');
        return;
      }
    }
  }

  rec.timer = window.setInterval(() => {
    if (state.recording !== rec) return;
    const elapsed = Math.floor((Date.now() - rec.startedAt) / 1000);
    dom.recordingTimer.textContent = formatDuration(elapsed);
    if (elapsed >= 55) {
      dom.recordingText.textContent = 'That’s a good practice turn. Sending it now…';
      stopVoiceCapture(true);
    }
  }, 250);
  if (rec.recognitionDone && rec.recorderDone) tryFinishVoiceCapture(rec);
}
function stopRecorderOnly(rec) {
  if (rec.recorder && rec.recorder.state !== 'inactive') {
    try { rec.recorder.stop(); } catch { rec.recorderDone = true; }
  } else {
    rec.recorderDone = true;
    rec.stream?.getTracks().forEach((track) => track.stop());
    rec.stream = null;
    tryFinishVoiceCapture(rec);
  }
}
function stopVoiceCapture(manual = true) {
  const rec = state.recording;
  if (!rec || rec.finalizing) return;
  rec.manual = manual;
  if (rec.timer) window.clearInterval(rec.timer);
  dom.recordingText.textContent = 'Finishing your turn…';
  if (rec.recognition && !rec.recognitionDone) {
    try { rec.recognition.stop(); } catch { rec.recognitionDone = true; }
  } else rec.recognitionDone = true;
  stopRecorderOnly(rec);
  tryFinishVoiceCapture(rec);
}
function tryFinishVoiceCapture(rec) {
  if (state.recording !== rec || rec.finalizing || !rec.recognitionDone || !rec.recorderDone) return;
  rec.finalizing = true;
  state.recording = null;
  if (rec.timer) window.clearInterval(rec.timer);
  setRecordingUI(false);
  const finalText = (rec.transcript || dom.messageInput.value || rec.previousText || '').trim();
  const audio = state.settings.pronunciation ? rec.audioBlob : null;
  if (!finalText && !audio) {
    dom.messageInput.value = rec.previousText || '';
    toast('I didn’t catch anything. Try again, or type your reply.', '');
    return;
  }
  if (audio && finalText) dom.messageInput.value = '';
  if (!hasAPIKey() && audio && !finalText) {
    addSystemNote('I recorded your voice, but a Gemini key is needed to transcribe it. Add your key in Settings, then try again.');
    openSettingsForKey();
    return;
  }
  if (!hasAPIKey() && finalText) dom.messageInput.value = finalText;
  sendTurn(finalText, audio);
}
function autoGrowInput() {
  const input = dom.messageInput;
  input.style.height = 'auto';
  input.style.height = `${Math.min(input.scrollHeight, 112)}px`;
}

function speak(text) {
  if (!('speechSynthesis' in window) || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = state.settings.accent || 'en-IN';
  utterance.rate = Number(state.settings.speed || 0.9);
  const voices = window.speechSynthesis.getVoices();
  const locale = utterance.lang.toLowerCase();
  const candidates = voices.filter((voice) => voice.lang?.toLowerCase() === locale);
  const baseCandidates = candidates.length ? candidates : voices.filter((voice) => voice.lang?.toLowerCase().startsWith(locale.slice(0, 2)));
  if (baseCandidates.length) utterance.voice = baseCandidates.find((voice) => /google|natural|enhanced/i.test(voice.name)) || baseCandidates[0];
  window.speechSynthesis.speak(utterance);
}

function sentencesIn(text) {
  return String(text || '').trim().split(/(?<=[.!?])\s+|\n+/).map((part) => part.trim()).filter(Boolean).length || (String(text || '').trim() ? 1 : 0);
}
function wordCount(text) { return (String(text || '').match(/[\p{L}\p{N}’'-]+/gu) || []).length; }
function fillerCount(text) {
  const matches = String(text || '').toLowerCase().match(/\b(?:um+|uh+|erm|er|basically|actually|you know)\b/g);
  return matches?.length || 0;
}
function computeSummary() {
  const now = Date.now();
  const seconds = Math.max(1, Math.floor(((state.sessionEndAt || now) - state.sessionStartedAt) / 1000));
  const users = state.turns.map((turn) => turn.user).filter(Boolean);
  const allText = users.join(' ');
  const words = wordCount(allText);
  const totalSentences = users.reduce((sum, text) => sum + sentencesIn(text), 0);
  const corrections = state.turns.flatMap((turn) => turn.corrections || []);
  const corrected = Math.min(totalSentences, state.turns.reduce((sum, turn) => {
    const sentences = new Set((turn.corrections || []).map((item) => String(item.sentence || '').trim().toLowerCase()).filter(Boolean));
    return sum + Math.min(sentencesIn(turn.user), sentences.size);
  }, 0));
  const cleanPct = totalSentences ? Math.max(0, Math.round(((totalSentences - corrected) / totalSentences) * 100)) : 0;
  const pronScores = state.turns.filter((turn) => turnHasAudio(turn)).map((turn) => Number(turn.pronunciation?.score) || 0).filter((score) => score > 0);
  // Keep the metric an estimate, never a test result.
  const avgPron = pronScores.length ? Math.round(pronScores.reduce((sum, score) => sum + score, 0) / pronScores.length) : null;
  const fillers = fillerCount(allText);
  const minutes = Math.max(1, Math.round(seconds / 60));
  const grouped = new Map();
  for (const item of corrections) {
    const key = item.why || item.improved || 'A small improvement';
    if (!grouped.has(key)) grouped.set(key, { why: key, sentence: item.sentence, improved: item.improved, count: 0 });
    grouped.get(key).count += 1;
  }
  const topFixes = [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, 3);
  const newPhrases = [...new Set(corrections.map((item) => item.improved).filter(Boolean))].slice(0, 5);
  return {
    id: `s-${now}`, date: new Date(now).toISOString(), title: state.currentScenario?.title || 'Practice session', scenarioId: state.currentScenario?.id || '',
    category: findCategoryForScenario(state.currentScenario || {}).title, emoji: findCategoryForScenario(state.currentScenario || {}).emoji,
    minutes, seconds, turns: state.turns.length, words, totalSentences, corrected, cleanPct, avgPron, fillers, topFixes, newPhrases,
    drillWord: state.drillWord || '',
  };
}
function turnHasAudio(turn) { return Boolean(turn?.hadAudio); }
function renderSummary(summary) {
  state.lastSummary = summary;
  $('#summaryTitle').textContent = summary.turns > 0 ? 'You showed up. That counts.' : 'A great place to begin.';
  dom.summarySubtitle.textContent = `You practised ${summary.category.toLowerCase()} with ${summary.title}. Every conversation makes the next one easier.`;
  dom.summaryMetrics.replaceChildren();
  const values = [
    [summary.minutes, 'min practised'], [summary.turns, 'your turns'], [summary.words, 'words spoken'],
    [summary.avgPron ? `${summary.avgPron}/10` : `${summary.cleanPct}%`, summary.avgPron ? 'AI clarity estimate' : 'sentences with no edits*'],
  ];
  for (const [value, label] of values) {
    const metric = create('div', 'summary-metric'); metric.append(create('strong', '', String(value)), create('span', '', label)); dom.summaryMetrics.append(metric);
  }
  dom.summaryDetails.replaceChildren();
  const fixes = create('div', 'summary-detail');
  fixes.append(create('div', 'summary-detail-title', summary.topFixes.length ? 'A couple of things to remember' : 'What went well'));
  if (summary.topFixes.length) {
    summary.topFixes.forEach((item) => {
      const row = create('div', 'summary-correction-row');
      row.append(create('strong', '', item.improved), create('span', '', ` — ${item.why}`)); fixes.append(row);
    });
  } else {
    fixes.append(create('div', 'summary-detail-copy', summary.turns ? 'No major corrections were suggested this session. Keep building on that.' : 'Start with one short conversation. There’s no need to wait until you feel ready.'));
  }
  dom.summaryDetails.append(fixes);
  if (summary.newPhrases.length) {
    const phrases = create('div', 'summary-detail');
    phrases.append(create('div', 'summary-detail-title', 'Try these natural phrases'));
    const pills = create('div', 'summary-pill-row');
    summary.newPhrases.forEach((phrase) => pills.append(create('span', 'summary-word-pill', phrase)));
    phrases.append(pills); dom.summaryDetails.append(phrases);
  }
  if (summary.fillers) {
    const filler = create('div', 'summary-detail');
    filler.append(create('div', 'summary-detail-title', 'Filler words noticed'), create('div', 'summary-detail-copy', `${summary.fillers} filler ${summary.fillers === 1 ? 'word' : 'words'} appeared in the transcript (for example “um”, “uh”, “actually” or “you know”). These are normal; this is just something to notice.`));
    dom.summaryDetails.append(filler);
  }
  if (summary.avgPron) {
    const pron = create('div', 'summary-detail');
    pron.append(create('div', 'summary-detail-title', 'Pronunciation note'), create('div', 'summary-detail-copy', 'The clarity number is an approximate AI estimate from the turns where audio was shared, not a formal pronunciation or accent test.'));
    dom.summaryDetails.append(pron);
  }
  if (!summary.avgPron) {
    const foot = create('div', 'summary-detail-copy', '*Based on Gemini’s sentence corrections. It is a rough practice snapshot, not a speaking or exam score.');
    dom.summaryDetails.append(foot);
  }
}
function saveSummary(summary) {
  const entry = {
    id: summary.id, date: summary.date, title: summary.title, category: summary.category, emoji: summary.emoji,
    minutes: summary.minutes, turns: summary.turns, words: summary.words, cleanPct: summary.cleanPct, avgPron: summary.avgPron,
  };
  state.histories = [entry, ...(Array.isArray(state.histories) ? state.histories : [])].slice(0, 50);
  saveJSON(STORE.sessions, state.histories);
  refreshHomeStats();
}
function finishSession() {
  if (state.recording) { stopVoiceCapture(true); return; }
  if (state.inFlight) { toast('Wait for your AI reply before finishing this session.', ''); return; }
  if (!state.turns.length) {
    state.currentScenario = null; state.drillWord = ''; setScreen(dom.home); return;
  }
  state.sessionEndAt = Date.now();
  const summary = computeSummary();
  saveSummary(summary);
  renderSummary(summary);
  state.currentScenario = null;
  state.drillWord = '';
  setScreen(dom.summary);
}
function leaveSession() {
  if (state.recording) { stopVoiceCapture(true); return; }
  if (state.turns.length) {
    const yes = window.confirm('Leave this session and save a summary?');
    if (yes) finishSession();
    return;
  }
  state.currentScenario = null; state.drillWord = ''; setScreen(dom.home);
}
function openHistory() {
  dom.historyList.replaceChildren();
  if (!state.histories.length) {
    const empty = create('div', 'empty-state');
    empty.append(create('div', 'empty-state-icon', '☼'), create('strong', '', 'Your progress starts with one chat'), create('p', '', 'Finish a conversation and your practice snapshot will appear here.'));
    dom.historyList.append(empty);
  } else {
    for (const entry of state.histories) {
      const row = create('div', 'history-item');
      row.append(create('div', 'history-emoji', entry.emoji || '💬'));
      const info = create('div', 'history-info');
      info.append(create('strong', '', entry.title || 'Practice'), create('span', '', `${entry.category || 'Conversation'} · ${formatDate(entry.date, true)} · ${entry.turns || 0} turns`));
      const stat = create('span', 'history-stat', `${entry.minutes || 0} min`);
      row.append(info, stat); dom.historyList.append(row);
    }
  }
  openModal(dom.historyModal);
}
function addTrickyWord(word, phonetic, tip) {
  const clean = String(word || '').trim();
  if (!clean) return;
  const exists = state.trickyWords.find((item) => item.word.toLowerCase() === clean.toLowerCase());
  if (exists) {
    exists.phonetic = phonetic || exists.phonetic;
    exists.tip = tip || exists.tip;
    exists.updated = Date.now();
  } else {
    state.trickyWords.unshift({ id: `w-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, word: clean, phonetic: String(phonetic || ''), tip: String(tip || ''), created: Date.now() });
  }
  state.trickyWords = state.trickyWords.slice(0, 100);
  saveJSON(STORE.words, state.trickyWords);
  updateWordCount();
  renderWords();
}
function updateWordCount() {
  dom.wordCount.textContent = String(state.trickyWords.length);
  dom.wordCount.classList.toggle('hidden', !state.trickyWords.length);
}
function renderWords() {
  dom.wordsList.replaceChildren();
  if (!state.trickyWords.length) {
    const empty = create('div', 'empty-state');
    empty.append(create('div', 'empty-state-icon', '🔤'), create('strong', '', 'Your word list is empty'), create('p', '', 'Turn on pronunciation feedback in a conversation and save a word to practise it here.'));
    dom.wordsList.append(empty); return;
  }
  for (const item of state.trickyWords) {
    const card = create('div', 'tricky-word-card');
    const info = create('div');
    info.append(create('strong', '', item.word), create('div', 'word-phonetic', item.phonetic || ''));
    const actions = create('div');
    const listen = create('button', 'tricky-remove', 'Listen'); listen.type = 'button'; listen.dataset.listenWord = item.word; listen.setAttribute('aria-label', `Hear ${item.word}`);
    const remove = create('button', 'tricky-remove', 'Remove'); remove.type = 'button'; remove.dataset.removeWord = item.id; remove.setAttribute('aria-label', `Remove ${item.word}`);
    actions.append(listen, document.createTextNode(' · '), remove);
    card.append(info, actions);
    if (item.tip) card.append(create('p', '', item.tip));
    const practice = create('button', 'save-word-button', 'Practise this word →');
    practice.type = 'button'; practice.dataset.practiceWord = item.word;
    card.append(practice); dom.wordsList.append(card);
  }
}
function removeTrickyWord(id) {
  state.trickyWords = state.trickyWords.filter((item) => item.id !== id);
  saveJSON(STORE.words, state.trickyWords); updateWordCount(); renderWords();
}
function exportPracticeData() {
  const data = { exportedAt: new Date().toISOString(), sessions: state.histories, trickyWords: state.trickyWords, settings: { model: state.settings.model, level: state.settings.level, accent: state.settings.accent, speed: state.settings.speed } };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'speakup-practice-data.json'; a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}
function clearPracticeData() {
  const yes = window.confirm('Clear saved practice history, tricky words, and your API key from this browser? This cannot be undone.');
  if (!yes) return;
  state.histories = []; state.trickyWords = []; state.settings.key = '';
  localStorage.removeItem(STORE.sessions); localStorage.removeItem(STORE.words); persistSettings();
  dom.keyInput.value = ''; updateConnectionUI(); updateWordCount(); refreshHomeStats(); renderWords();
  dom.settingsFeedback.textContent = 'Saved practice data and key cleared from this browser.';
}

function initEvents() {
  $('#brandHome').addEventListener('click', (event) => { event.preventDefault(); if (dom.session && !dom.session.classList.contains('hidden')) leaveSession(); else setScreen(dom.home); });
  $('#settingsOpen').addEventListener('click', showSettings);
  $('#connectHomeBtn').addEventListener('click', showSettings);
  $('#historyOpen').addEventListener('click', openHistory);
  $('#wordsOpen').addEventListener('click', () => { renderWords(); openModal(dom.wordsModal); });
  $('#privacyOpen').addEventListener('click', () => openModal(dom.privacyModal));
  $('#quickStart').addEventListener('click', () => startSession(findScenario('free-chat')));
  $('#backHome').addEventListener('click', leaveSession);
  $('#finishSession').addEventListener('click', finishSession);
  $('#summaryBack').addEventListener('click', () => setScreen(dom.home));
  $('#summaryHome').addEventListener('click', () => setScreen(dom.home));
  $('#againButton').addEventListener('click', () => {
    const last = state.lastSummary;
    if (last?.drillWord) startWordDrill({ word: last.drillWord });
    else startSession(findScenario(last?.scenarioId) || findScenario('free-chat'));
  });
  dom.homeLevel.addEventListener('change', () => { state.settings.level = dom.homeLevel.value; persistSettings(); });
  dom.pronHome.addEventListener('change', (event) => { setPronunciation(event.target.checked); updateSpeechSupportNote(); });
  dom.pronSession.addEventListener('change', (event) => { setPronunciation(event.target.checked); updateSpeechSupportNote(); });
  dom.messageForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (state.recording) { stopVoiceCapture(true); return; }
    sendTurn(dom.messageInput.value);
  });
  dom.messageInput.addEventListener('input', autoGrowInput);
  dom.messageInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); dom.messageForm.requestSubmit(); }
  });
  dom.micButton.addEventListener('click', () => state.recording ? stopVoiceCapture(true) : startVoiceCapture());
  $('#saveSettings').addEventListener('click', saveSettingsFromForm);
  $('#testConnection').addEventListener('click', testConnection);
  $('#toggleKeyVisibility').addEventListener('click', (event) => {
    const input = dom.keyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
    event.currentTarget.textContent = input.type === 'password' ? 'Show' : 'Hide';
  });
  dom.speedRange.addEventListener('input', () => { dom.speedValue.textContent = `${Number(dom.speedRange.value).toFixed(2).replace(/0$/, '')}×`; });
  $('#exportData').addEventListener('click', exportPracticeData);
  $('#clearData').addEventListener('click', clearPracticeData);
  $$('.modal-close,[data-close]').forEach((button) => button.addEventListener('click', () => closeModal(document.getElementById(button.dataset.close) || button.closest('.modal-layer'))));
  $$('.modal-layer').forEach((modal) => modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(modal); }));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const open = $('.modal-layer:not(.hidden)');
      if (open) closeModal(open);
    }
  });
  dom.conversation.addEventListener('click', (event) => {
    const save = event.target.closest('.save-word-button[data-word]');
    if (save) {
      addTrickyWord(save.dataset.word, save.dataset.phonetic, save.dataset.tip);
      save.textContent = '✓ Saved'; save.disabled = true; toast(`“${save.dataset.word}” added to My words.`, 'success');
    }
  });
  dom.wordsList.addEventListener('click', (event) => {
    const listen = event.target.closest('[data-listen-word]');
    if (listen) speak(listen.dataset.listenWord);
    const remove = event.target.closest('[data-remove-word]');
    if (remove) removeTrickyWord(remove.dataset.removeWord);
    const practice = event.target.closest('[data-practice-word]');
    if (practice) startWordDrill({ word: practice.dataset.practiceWord });
  });
}
async function checkServerKey() {
  try {
    const response = await fetch('/api/status', { cache: 'no-store' });
    const data = await response.json();
    state.serverKeyConfigured = Boolean(data.configured);
  } catch { state.serverKeyConfigured = false; }
  updateConnectionUI();
}

function init() {
  state.settings.level = LEVELS[state.settings.level] ? state.settings.level : 'intermediate';
  dom.homeLevel.value = state.settings.level;
  renderCategories(); renderScenarios(); updatePronunciationUI(); updateConnectionUI(); updateWordCount(); refreshHomeStats(); updateSpeechSupportNote();
  initEvents();
  void checkServerKey();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  if ('speechSynthesis' in window) window.speechSynthesis.getVoices();
}

init();
