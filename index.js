const express = require('express');
const https = require('https');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ========== CONFIGURATION ==========
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PORT = process.env.PORT || 3000;

// ========== TELEGRAM HELPER ==========
function sendTelegramMessage(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: message,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Telegram message sent successfully');
          resolve(JSON.parse(body));
        } else {
          console.error('❌ Telegram error:', body);
          reject(new Error(body));
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ========== FORMAT MESSAGES ==========
function formatTradingViewMessage(data) {
  const symbol = data.symbol || 'Unknown';
  const price = data.price || 'N/A';
  const message = data.message || data.text || 'Alert!';
  const time = data.time || new Date().toLocaleString('vi-VN');
  
  return `🔔 <b>TRADINGVIEW ALERT</b>

📊 <b>Symbol:</b> ${symbol}
💰 <b>Price:</b> ${price}
📝 <b>Message:</b> ${message}
🕐 <b>Time:</b> ${time}`;
}

function formatMT5Message(data) {
  const symbol = data.symbol || 'Unknown';
  const price = data.price || 'N/A';
  const message = data.message || 'MT5 Alert!';
  const time = new Date().toLocaleString('vi-VN');
  
  return `🚨 <b>MT5 ALERT</b>

📊 <b>Symbol:</b> ${symbol}
💰 <b>Price:</b> ${price}
📝 <b>Message:</b> ${message}
🕐 <b>Time:</b> ${time}`;
}

// ========== ROUTES ==========

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Super Alert Server is running!',
    endpoints: {
      tradingview: 'POST /webhook/tradingview',
      mt5: 'POST /webhook/mt5',
      test: 'GET /test'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Test endpoint - gửi tin nhắn test
app.get('/test', async (req, res) => {
  try {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      return res.status(500).json({ 
        error: 'Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID' 
      });
    }
    
    await sendTelegramMessage('🧪 <b>TEST MESSAGE</b>\n\nServer is working correctly! ✅');
    res.json({ success: true, message: 'Test message sent to Telegram!' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TradingView Webhook
app.post('/webhook/tradingview', async (req, res) => {
  console.log('📥 TradingView webhook received:', req.body);
  
  // Optional: verify webhook secret
  if (WEBHOOK_SECRET && req.body.secret !== WEBHOOK_SECRET) {
    console.log('⚠️ Invalid webhook secret');
    return res.status(401).json({ error: 'Invalid secret' });
  }
  
  try {
    const message = formatTradingViewMessage(req.body);
    await sendTelegramMessage(message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// MT5 Webhook
app.post('/webhook/mt5', async (req, res) => {
  console.log('📥 MT5 request received:', req.body);
  
  try {
    const message = formatMT5Message(req.body);
    await sendTelegramMessage(message);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Generic webhook (accepts any format)
app.post('/webhook', async (req, res) => {
  console.log('📥 Generic webhook received:', req.body);
  
  try {
    let text = '';
    if (typeof req.body === 'string') {
      text = req.body;
    } else if (req.body.message || req.body.text) {
      text = req.body.message || req.body.text;
    } else {
      text = JSON.stringify(req.body, null, 2);
    }
    
    await sendTelegramMessage(`📨 <b>ALERT</b>\n\n${text}`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║     🚀 Super Alert Server Started!         ║
╠════════════════════════════════════════════╣
║  Port: ${PORT}                               ║
║  Telegram Bot: ${TELEGRAM_BOT_TOKEN ? '✅ Configured' : '❌ Missing'}        ║
║  Chat ID: ${TELEGRAM_CHAT_ID ? '✅ Configured' : '❌ Missing'}             ║
╚════════════════════════════════════════════╝
  `);
});
