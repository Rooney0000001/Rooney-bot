const axios = require('axios');

async function autoViewStatus(sock, msg) {
  try { await sock.readMessages([msg.key]); } catch(e) {}
}

async function autoLikeStatus(sock, msg) {
  try {
    await sock.sendMessage('status@broadcast', { react: { text: '❤️', key: msg.key } });
  } catch(e) {}
}

async function downloadStatus(sock, msg) {
  try {
    const media = msg.message?.imageMessage || msg.message?.videoMessage;
    if (!media) return;
    const buffer = await sock.downloadMediaMessage(msg);
    const isVideo = !!msg.message?.videoMessage;
    await sock.sendMessage(sock.user.id, {
      [isVideo ? 'video' : 'image']: buffer,
      caption: '📥 Status saved — Rooney Bot',
    });
  } catch(e) {}
}

async function antiDelete(sock, item, messageStore) {
  try {
    const keys = item.keys || [];
    for (const key of keys) {
      const saved = messageStore[key.id];
      if (!saved) continue;
      const body = saved.message?.conversation || saved.message?.extendedTextMessage?.text || '[Media message]';
      await sock.sendMessage(sock.user.id, {
        text: `🗑️ *Anti-Delete Alert*\n\n*From:* ${key.remoteJid}\n*Message:* ${body}`,
      });
    }
  } catch(e) {}
}

async function antiCall(sock, call) {
  try {
    await sock.rejectCall(call.id, call.from);
    await sock.sendMessage(call.from, { text: '❌ I don\'t accept calls. I\'m a bot powered by *Rooney Bot*.' });
  } catch(e) {}
}

async function fakeTyping(sock, jid) {
  try {
    await sock.sendPresenceUpdate('composing', jid);
    setTimeout(() => sock.sendPresenceUpdate('paused', jid), 3000);
  } catch(e) {}
}

async function fakeRecording(sock, jid) {
  try {
    await sock.sendPresenceUpdate('recording', jid);
    setTimeout(() => sock.sendPresenceUpdate('paused', jid), 3000);
  } catch(e) {}
}

async function autoRead(sock, msg) {
  try { await sock.readMessages([msg.key]); } catch(e) {}
}

const REACT_EMOJIS = ['👍','❤️','😂','😮','🎉','🔥'];
async function autoReact(sock, msg) {
  try {
    const emoji = REACT_EMOJIS[Math.floor(Math.random() * REACT_EMOJIS.length)];
    await sock.sendMessage(msg.key.remoteJid, { react: { text: emoji, key: msg.key } });
  } catch(e) {}
}

async function autoSaveContacts(sock, msg) {
  try {
    const jid = msg.key.remoteJid;
    if (!jid || jid.includes('@g.us')) return;
    const number = jid.replace('@s.whatsapp.net', '');
    console.log(`📱 Contact saved: +${number}`);
  } catch(e) {}
}

async function handleDownload(sock, msg) {
  try {
    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    const jid = msg.key.remoteJid;
    if (body.startsWith('!song ')) {
      await sock.sendMessage(jid, { text: `🎵 Searching: *${body.slice(6)}*... (feature needs server setup)` });
    }
    if (body.startsWith('!video ')) {
      await sock.sendMessage(jid, { text: `📹 Downloading video... (feature needs server setup)` });
    }
  } catch(e) {}
}

const CHATBOT_REPLIES = {
  'hello': '👋 Hello! I\'m Rooney Bot 🤖',
  'hi': '👋 Hi there! How can I help?',
  'how are you': '😊 I\'m great, thanks!',
  'bye': '👋 Goodbye! Have a great day!',
  'help': '📋 Commands:\n!gpt <question> - ChatGPT\n!ai <question> - AI Reply\n!song <name> - Download song\n!video <url> - Download video',
};

async function chatbot(sock, msg, body) {
  try {
    const reply = CHATBOT_REPLIES[body.toLowerCase().trim()];
    if (reply) await sock.sendMessage(msg.key.remoteJid, { text: reply }, { quoted: msg });
  } catch(e) {}
}

async function chatGPT(sock, msg, prompt) {
  try {
    const jid = msg.key.remoteJid;
    const OPENAI_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_KEY) return sock.sendMessage(jid, { text: '⚠️ Add OPENAI_API_KEY to environment.' });
    await sock.sendMessage(jid, { text: '🤖 Thinking...' });
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }, { headers: { Authorization: `Bearer ${OPENAI_KEY}` } });
    const reply = response.data.choices[0].message.content;
    await sock.sendMessage(jid, { text: `🤖 *ChatGPT:*\n\n${reply}` }, { quoted: msg });
  } catch(e) {
    await sock.sendMessage(msg.key.remoteJid, { text: '❌ ChatGPT error.' });
  }
}

async function aiReply(sock, msg, prompt) {
  try {
    const jid = msg.key.remoteJid;
    const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
    if (!CLAUDE_KEY) return sock.sendMessage(jid, { text: '⚠️ Add ANTHROPIC_API_KEY to environment.' });
    await sock.sendMessage(jid, { text: '🧠 Thinking...' });
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }, {
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      }
    });
    const reply = response.data.content[0].text;
    await sock.sendMessage(jid, { text: `🧠 *Rooney AI:*\n\n${reply}` }, { quoted: msg });
  } catch(e) {
    await sock.sendMessage(msg.key.remoteJid, { text: '❌ AI error.' });
  }
}

module.exports = {
  autoViewStatus, autoLikeStatus, downloadStatus, antiDelete,
  antiCall, fakeTyping, fakeRecording, autoRead, autoReact,
  autoSaveContacts, handleDownload, chatbot, chatGPT, aiReply,
};
