const express = require('express');
const app = express();
const PORT = 3000;

// Mock data
const mockChats = [
  { id: '1', name: 'Anna Schmidt', lastMessage: 'Hey, wie gehts?', unread: 0, avatar: '👩' },
  { id: '2', name: 'Bob Müller', lastMessage: 'Schicke dir die Datei gerade', unread: 1, avatar: '👨' },
  { id: '3', name: 'Clara Weber', lastMessage: '👋', unread: 0, avatar: '👩‍🦰' },
];

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All Media App</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .container { max-width: 400px; margin: 0 auto; background: white; min-height: 100vh; display: flex; flex-direction: column; }
        
        header { padding: 16px; border-bottom: 1px solid #e5e5e5; }
        .nav-tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .nav-tab { padding: 8px 12px; font-size: 12px; background: #f0f0f0; border: none; border-radius: 20px; cursor: pointer; }
        .nav-tab.active { background: #0A66FF; color: white; }
        
        .search-box { width: 100%; padding: 10px; border: 1px solid #e5e5e5; border-radius: 8px; font-size: 14px; }
        
        .chats { flex: 1; }
        .chat-item { padding: 16px; border-bottom: 1px solid #f0f0f0; display: flex; gap: 12px; cursor: pointer; transition: background 0.2s; }
        .chat-item:hover { background: #f9f9f9; }
        .chat-avatar { width: 50px; height: 50px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .chat-content { flex: 1; }
        .chat-name { font-weight: 600; font-size: 15px; }
        .chat-message { font-size: 13px; color: #65676b; margin-top: 4px; }
        .unread-badge { background: #0A66FF; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
        
        .bottom-nav { display: flex; justify-content: space-around; padding: 16px; border-top: 1px solid #e5e5e5; background: white; }
        .nav-icon { cursor: pointer; font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <div class="nav-tabs">
            <button class="nav-tab">🏠 Home</button>
            <button class="nav-tab">📹 Videos</button>
            <button class="nav-tab active">💬 Messenger</button>
            <button class="nav-tab">👥 Community</button>
            <button class="nav-tab">⚙️ Profil</button>
          </div>
          <input type="text" class="search-box" placeholder="Suche hier nach deinen Chats ...">
        </header>
        
        <div class="chats">
          ${mockChats.map(chat => `
            <div class="chat-item">
              <div class="chat-avatar">${chat.avatar}</div>
              <div class="chat-content">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-message">${chat.lastMessage}</div>
              </div>
              ${chat.unread > 0 ? `<div class="unread-badge">${chat.unread}</div>` : ''}
            </div>
          `).join('')}
        </div>
        
        <div class="bottom-nav">
          <div class="nav-icon">🏠</div>
          <div class="nav-icon">📹</div>
          <div class="nav-icon">💬</div>
          <div class="nav-icon">👥</div>
          <div class="nav-icon">⚙️</div>
        </div>
      </div>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`✓ All Media App läuft auf http://localhost:${PORT}`);
  console.log(`📱 Öffne im Browser: http://localhost:${PORT}`);
});
