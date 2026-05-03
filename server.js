const express = require('express');
const { v4: uuidv4 } = require('uuid');
const qrcode = require('qrcode');
const path = require('path');
const { createBotSession, stopBotSession, getSession, toggleFeature } = require('./bot/index');

const app = express();
app.use(express.json());
app.use(express.static('public'));

app.post('/api/create-session', async (req, res) => {
  try {
    const sessionId = uuidv4().slice(0, 8).toUpperCase();
    await createBotSession(sessionId);
    res.json({ sessionId, message: 'Session created! Scan the QR code.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({
    id: session.id,
    status: session.status,
    qr: session.qr,
    features: session.features,
    createdAt: session.createdAt,
  });
});

app.post('/api/session/:id/feature', (req, res) => {
  const { feature, enabled } = req.body;
  const result = toggleFeature(req.params.id, feature, enabled);
  if (!result) return res.status(404).json({ error: 'Session not found' });
  res.json({ message: `${feature} is now ${enabled ? 'ON' : 'OFF'}` });
});

app.post('/api/session/:id/stop', async (req, res) => {
  try {
    await stopBotSession(req.params.id);
    res.json({ message: 'Bot stopped.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions', (req, res) => {
  const { getAllSessions } = require('./bot/index');
  res.json(getAllSessions());
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Rooney Bot Platform running → http://localhost:${PORT}`);
});
