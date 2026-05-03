const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const pino = require('pino');
const features = require('./features');

const sessions = {};

const DEFAULT_FEATURES = {
  autoViewStatus:    { enabled: false, label: '⚡ Auto View Status' },
  antiDelete:        { enabled: false, label: '⚡ Anti Delete Message' },
  downloadMedia:     { enabled: false, label: '⚡ Download Songs & Videos' },
  fakeRecording:     { enabled: false, label: '⚡ Fake Recording' },
  alwaysOnline:      { enabled: false, label: '⚡ Always Online' },
  fakeTyping:        { enabled: false, label: '⚡ Fake Typing' },
  autoLikeStatus:    { enabled: false, label: '⚡ Auto Like Status' },
  aiFeatures:        { enabled: false, label: '⚡ AI Features' },
  chatGPT:           { enabled: false, label: '⚡ ChatGPT Features' },
  downloadStatus:    { enabled: false, label: '⚡ Downloading Status' },
  antiCall:          { enabled: false, label: '⚡ Anti Call' },
  chatbot:           { enabled: false, label: '⚡ Chatbot' },
  autoBio:           { enabled: false, label: '⚡ Auto Bio' },
  autoReact:         { enabled: false, label: '⚡ Auto React to Messages' },
  autoRead:          { enabled: false, label: '⚡ Auto Read Messages' },
  autoSaveContacts:  { enabled: false, label: '⚡ Auto Save Contacts' },
  antiBan:           { enabled: false, label: '⚡ Anti WhatsApp Ban Mode' },
};

async function createBotSession(sessionId) {
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${sessionId}`);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
    },
    browser: ['Rooney Bot', 'Chrome', '1.0.0'],
  });

  sessions[sessionId] = {
    id: sessionId,
    status: 'initializing',
    qr: null,
    sock,
    features: JSON.parse(JSON.stringify(DEFAULT_FEATURES)),
    messageStore: {},
    intervals: [],
    createdAt: new Date().toISOString(),
  };

  const session = sessions[sessionId];

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      session.qr = await qrcode.toDataURL(qr);
      session.status = 'awaiting_scan';
    }
    if (connection === 'open') {
      session.status = 'connected';
      session.qr = null;
      startFeatureListeners(sessionId);
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = code !== DisconnectReason.loggedOut;
      session.status = shouldReconnect ? 'reconnecting' : 'disconnected';
      if (shouldReconnect) setTimeout(() => createBotSession(sessionId), 5000);
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

function startFeatureListeners(sessionId) {
  const session = sessions[sessionId];
  const { sock } = session;
  const isOn = (f) => session.features[f]?.enabled;

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const jid = msg.key.remoteJid;
      const isStatus = jid === 'status@broadcast';
      const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';

      if (isOn('antiDelete')) session.messageStore[msg.key.id] = msg;
      if (isStatus && isOn('autoViewStatus')) await features.autoViewStatus(sock, msg);
      if (isStatus && isOn('autoLikeStatus')) await features.autoLikeStatus(sock, msg);
      if (isStatus && isOn('downloadStatus')) await features.downloadStatus(sock, msg);
      if (isStatus) continue;
      if (isOn('autoRead')) await features.autoRead(sock, msg);
      if (isOn('autoReact')) await features.autoReact(sock, msg);
      if (isOn('autoSaveContacts')) await features.autoSaveContacts(sock, msg);
      if (isOn('fakeTyping')) await features.fakeTyping(sock, jid);
      if (isOn('fakeRecording')) await features.fakeRecording(sock, jid);
      if (isOn('downloadMedia')) await features.handleDownload(sock, msg);
      if (isOn('chatGPT') && body.startsWith('!gpt ')) await features.chatGPT(sock, msg, body.slice(5));
      if (isOn('aiFeatures') && body.startsWith('!ai ')) await features.aiReply(sock, msg, body.slice(4));
      if (isOn('chatbot')) await features.chatbot(sock, msg, body);
    }
  });

  sock.ev.on('messages.delete', async (item) => {
    if (isOn('antiDelete')) await features.antiDelete(sock, item, session.messageStore);
  });

  sock.ev.on('call', async ([call]) => {
    if (isOn('antiCall')) await features.antiCall(sock, call);
  });

  const alwaysOnlineInterval = setInterval(async () => {
    if (isOn('alwaysOnline')) await sock.sendPresenceUpdate('available').catch(() => {});
  }, 10000);
  session.intervals.push(alwaysOnlineInterval);

  const bioPhrases = ['🤖 Powered by Rooney Bot', '⚡ Bot is Active', '🚀 Rooney Bot Online'];
  let bioIndex = 0;
  const autoBioInterval = setInterval(async () => {
    if (isOn('autoBio')) await sock.updateProfileStatus(bioPhrases[bioIndex++ % bioPhrases.length]).catch(() => {});
  }, 1800000);
  session.intervals.push(autoBioInterval);
}

function toggleFeature(sessionId, feature, enabled) {
  const session = sessions[sessionId];
  if (!session || !session.features[feature]) return null;
  session.features[feature].enabled = enabled;
  return true;
}

async function stopBotSession(sessionId) {
  const session = sessions[sessionId];
  if (!session) return;
  session.intervals.forEach(clearInterval);
  await session.sock.logout().catch(() => {});
  session.status = 'stopped';
}

function getSession(sessionId) { return sessions[sessionId] || null; }
function getAllSessions() {
  return Object.values(sessions).map((s) => ({ id: s.id, status: s.status, createdAt: s.createdAt }));
}

module.exports = { createBotSession, stopBotSession, getSession, getAllSessions, toggleFeature };
