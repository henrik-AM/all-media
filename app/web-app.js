const express = require('express');
const app = express();
const PORT = 3000;

// Mock data
const mockChats = [
  { id: '1', name: 'Anna Schmidt', lastMessage: 'Hey, wie gehts?', unread: 0, avatar: '👩' },
  { id: '2', name: 'Bob Müller', lastMessage: 'Schicke dir die Datei gerade', unread: 1, avatar: '👨' },
  { id: '3', name: 'Clara Weber', lastMessage: '👋', unread: 0, avatar: '👩‍🦰' },
  { id: '4', name: 'Projekt Team', lastMessage: 'Bis später!', unread: 0, avatar: '👥', isGroup: true },
];

const mockContacts = [
  { id: '1', name: 'Anna Schmidt', status: 'friend' },
  { id: '2', name: 'Bob Müller', status: 'friend' },
  { id: '3', name: 'Clara Weber', status: 'pending' },
  { id: '4', name: 'David König', status: 'friend' },
];

let currentScreen = 'chats';
let unreadMessages = {};
mockChats.forEach(c => unreadMessages[c.id] = c.unread || 0);

app.use(express.json());

// API endpoints
app.get('/api/chats', (req, res) => {
  res.json(mockChats.map(c => ({ ...c, unread: unreadMessages[c.id] || 0 })));
});

app.get('/api/contacts', (req, res) => res.json(mockContacts));

app.post('/api/messages/:chatId', (req, res) => {
  const { text } = req.body;
  if (text) {
    unreadMessages[req.params.chatId] = (unreadMessages[req.params.chatId] || 0) + 1;
    res.json({ success: true, message: text });
  }
});

// Serve HTML
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>All Media - Messenger</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
          background: #f5f5f5;
        }
        .phone { 
          max-width: 400px; 
          margin: 20px auto; 
          background: white; 
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          height: 600px;
        }
        
        header { 
          padding: 16px; 
          border-bottom: 1px solid #e5e5e5;
          background: white;
        }
        .title { font-size: 28px; font-weight: 700; margin-bottom: 12px; }
        .search-box { 
          width: 100%; 
          padding: 10px; 
          border: 1px solid #e5e5e5; 
          border-radius: 8px; 
          font-size: 14px; 
        }
        
        .nav-tabs {
          display: flex;
          gap: 8px;
          padding: 12px 16px;
          border-bottom: 1px solid #e5e5e5;
          background: white;
        }
        .nav-tab {
          padding: 6px 12px;
          font-size: 12px;
          background: #f0f0f0;
          border: none;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .nav-tab.active {
          background: #0A66FF;
          color: white;
        }
        .nav-tab:hover { background: #e0e0e0; }
        .nav-tab.active:hover { background: #0052CC; }
        
        .content {
          flex: 1;
          overflow-y: auto;
          background: white;
        }
        
        .chat-item {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          gap: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .chat-item:hover { background: #f9f9f9; }
        .chat-item.active { background: #f0f7ff; border-left: 4px solid #0A66FF; }
        
        .avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          flex-shrink: 0;
        }
        
        .chat-info { flex: 1; }
        .chat-name { font-weight: 600; font-size: 15px; }
        .chat-message { font-size: 13px; color: #65676b; margin-top: 4px; }
        
        .unread-badge {
          background: #0A66FF;
          color: white;
          border-radius: 50%;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
        }
        
        .chat-detail {
          display: none;
          flex-direction: column;
          height: 100%;
        }
        .chat-detail.active { display: flex; }
        
        .chat-header {
          padding: 16px;
          border-bottom: 1px solid #e5e5e5;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .back-btn {
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
        }
        
        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        
        .message {
          max-width: 80%;
          padding: 12px;
          border-radius: 16px;
          word-wrap: break-word;
        }
        .message.sent {
          align-self: flex-end;
          background: #0A66FF;
          color: white;
        }
        .message.received {
          align-self: flex-start;
          background: #e5e5e5;
          color: #262626;
        }
        
        .input-box {
          padding: 16px;
          border-top: 1px solid #e5e5e5;
          display: flex;
          gap: 8px;
        }
        .input-box input {
          flex: 1;
          padding: 10px;
          border: 1px solid #e5e5e5;
          border-radius: 20px;
          font-size: 14px;
        }
        .send-btn {
          background: #0A66FF;
          color: white;
          border: none;
          border-radius: 20px;
          padding: 10px 16px;
          cursor: pointer;
          font-weight: 600;
        }
        .send-btn:hover { background: #0052CC; }
        
        .empty { text-align: center; padding: 20px; color: #65676b; }
        
        .bottom-nav {
          display: flex;
          justify-content: space-around;
          padding: 12px 0;
          border-top: 1px solid #e5e5e5;
          background: white;
        }
        .nav-icon {
          cursor: pointer;
          font-size: 20px;
          padding: 8px;
        }
      </style>
    </head>
    <body>
      <div class="phone">
        <header>
          <div class="title">Messenger</div>
          <input type="text" class="search-box" placeholder="Suche hier nach deinen Chats ...">
        </header>
        
        <div class="nav-tabs">
          <button class="nav-tab active" onclick="switchTab('chats')">Alle</button>
          <button class="nav-tab" onclick="switchTab('contacts')">Kontakte</button>
          <button class="nav-tab" onclick="switchTab('groups')">Gruppen</button>
        </div>
        
        <div id="chats-view" class="content active">
          <div id="chats-list"></div>
        </div>
        
        <div id="contacts-view" class="content">
          <div id="contacts-list"></div>
        </div>
        
        <div id="chat-detail" class="content chat-detail">
          <div class="chat-header">
            <button class="back-btn" onclick="backToChats()">←</button>
            <span id="chat-name"></span>
            <span>⋯</span>
          </div>
          <div id="messages" class="messages"></div>
          <div class="input-box">
            <input id="message-input" type="text" placeholder="Nachricht...">
            <button class="send-btn" onclick="sendMessage()">Senden</button>
          </div>
        </div>
        
        <div class="bottom-nav">
          <div class="nav-icon">🏠</div>
          <div class="nav-icon">📹</div>
          <div class="nav-icon active">💬</div>
          <div class="nav-icon">👥</div>
          <div class="nav-icon">⚙️</div>
        </div>
      </div>
      
      <script>
        let currentChatId = null;
        let chatsData = [];
        
        function loadChats() {
          fetch('/api/chats')
            .then(r => r.json())
            .then(data => {
              chatsData = data;
              renderChats();
            })
            .catch(e => console.error('Chats laden fehlgeschlagen:', e));
        }
        
        function renderChats() {
          const list = document.getElementById('chats-list');
          if (chatsData.length === 0) {
            list.innerHTML = '<div class="empty">Keine Chats</div>';
            return;
          }
          list.innerHTML = chatsData.map(chat => \`
            <div class="chat-item" onclick="openChat('\${chat.id}', '\${chat.name}')">
              <div class="avatar">\${chat.avatar}</div>
              <div class="chat-info">
                <div class="chat-name">\${chat.name}</div>
                <div class="chat-message">\${chat.lastMessage}</div>
              </div>
              \${chat.unread > 0 ? \`<div class="unread-badge">\${chat.unread}</div>\` : ''}
            </div>
          \`).join('');
        }
        
        function loadContacts() {
          fetch('/api/contacts')
            .then(r => r.json())
            .then(data => renderContacts(data))
            .catch(e => console.error('Kontakte laden fehlgeschlagen:', e));
        }
        
        function renderContacts(contacts) {
          const list = document.getElementById('contacts-list');
          list.innerHTML = contacts.map(c => \`
            <div class="chat-item">
              <div class="avatar">👤</div>
              <div class="chat-info">
                <div class="chat-name">\${c.name}</div>
                <div class="chat-message">\${c.status === 'friend' ? '✓ Kontakt' : 'Ausstehend'}</div>
              </div>
            </div>
          \`).join('');
        }
        
        function switchTab(tab) {
          document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.content').forEach(c => c.classList.remove('active'));
          document.getElementById(tab + '-view').classList.add('active');
          event.target.classList.add('active');
          
          if (tab === 'contacts') loadContacts();
        }
        
        function openChat(id, name) {
          currentChatId = id;
          document.getElementById('chat-name').textContent = name;
          document.getElementById('chat-detail').classList.add('active');
          document.getElementById('chats-list').parentElement.classList.remove('active');
          
          // Mock messages
          document.getElementById('messages').innerHTML = \`
            <div class="message received">Hey, wie gehts?</div>
            <div class="message sent">Mir gehts gut!</div>
          \`;
          document.getElementById('message-input').focus();
        }
        
        function backToChats() {
          document.getElementById('chat-detail').classList.remove('active');
          document.getElementById('chats-list').parentElement.classList.add('active');
          currentChatId = null;
        }
        
        function sendMessage() {
          const input = document.getElementById('message-input');
          const text = input.value.trim();
          
          if (!text) return;
          
          const messagesDiv = document.getElementById('messages');
          const msgEl = document.createElement('div');
          msgEl.className = 'message sent';
          msgEl.textContent = text;
          messagesDiv.appendChild(msgEl);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          
          input.value = '';
          
          // Mock response nach 1 Sekunde
          setTimeout(() => {
            const response = document.createElement('div');
            response.className = 'message received';
            response.textContent = '👍 Erhalten!';
            messagesDiv.appendChild(response);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
          }, 1000);
        }
        
        // Load initial data
        loadChats();
        
        // Allow Enter to send
        document.addEventListener('DOMContentLoaded', () => {
          const input = document.getElementById('message-input');
          if (input) {
            input.addEventListener('keypress', (e) => {
              if (e.key === 'Enter') sendMessage();
            });
          }
        });
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(`✓ All Media App läuft auf http://localhost:${PORT}`);
  console.log('📱 Öffne im Browser: http://localhost:' + PORT);
});
