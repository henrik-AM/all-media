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

const mockStories = [
  { id: '1', userName: 'Anna Schmidt', avatar: '👩', viewed: false },
  { id: '2', userName: 'Bob Müller', avatar: '👨', viewed: true },
  { id: '3', userName: 'Clara Weber', avatar: '👩‍🦰', viewed: true },
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
app.get('/api/chats', (req, res) => res.json(mockChats.map(c => ({ ...c, unread: unreadMessages[c.id] || 0 }))));
app.get('/api/stories', (req, res) => res.json(mockStories));
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
        .content.hidden { display: none; }
        
        .chat-item, .story-item {
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          gap: 12px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .chat-item:hover, .story-item:hover { background: #f9f9f9; }
        
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
        
        .story-item .avatar {
          border: 3px solid #0A66FF;
        }
        
        .info { flex: 1; }
        .name { font-weight: 600; font-size: 15px; }
        .subtitle { font-size: 13px; color: #65676b; margin-top: 4px; }
        
        .badge {
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
          <button class="nav-tab active" onclick="switchTab('chats')">💬 Chats</button>
          <button class="nav-tab" onclick="switchTab('stories')">📖 Stories</button>
          <button class="nav-tab" onclick="switchTab('contacts')">👥 Kontakte</button>
        </div>
        
        <div id="chats-view" class="content">
          <div id="chats-list"></div>
        </div>
        
        <div id="stories-view" class="content hidden">
          <div id="stories-list"></div>
        </div>
        
        <div id="contacts-view" class="content hidden">
          <div id="contacts-list"></div>
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
        function loadChats() {
          fetch('/api/chats')
            .then(r => r.json())
            .then(data => {
              const list = document.getElementById('chats-list');
              list.innerHTML = data.map(chat => \`
                <div class="chat-item">
                  <div class="avatar">\${chat.avatar}</div>
                  <div class="info">
                    <div class="name">\${chat.name}</div>
                    <div class="subtitle">\${chat.lastMessage}</div>
                  </div>
                  \${chat.unread > 0 ? \`<div class="badge">\${chat.unread}</div>\` : ''}
                </div>
              \`).join('');
            });
        }
        
        function loadStories() {
          fetch('/api/stories')
            .then(r => r.json())
            .then(data => {
              const list = document.getElementById('stories-list');
              list.innerHTML = data.map(story => \`
                <div class="story-item">
                  <div class="avatar">\${story.avatar}</div>
                  <div class="info">
                    <div class="name">\${story.userName}</div>
                    <div class="subtitle">\${story.viewed ? '✓ gesehen' : '● neu'}</div>
                  </div>
                </div>
              \`).join('');
            });
        }
        
        function loadContacts() {
          fetch('/api/contacts')
            .then(r => r.json())
            .then(data => {
              const list = document.getElementById('contacts-list');
              list.innerHTML = data.map(c => \`
                <div class="chat-item">
                  <div class="avatar">👤</div>
                  <div class="info">
                    <div class="name">\${c.name}</div>
                    <div class="subtitle">\${c.status === 'friend' ? '✓ Kontakt' : 'ausstehend'}</div>
                  </div>
                </div>
              \`).join('');
            });
        }
        
        function switchTab(tab) {
          document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('.content').forEach(c => c.classList.add('hidden'));
          
          document.getElementById(tab + '-view').classList.remove('hidden');
          event.target.classList.add('active');
          
          if (tab === 'stories') loadStories();
          if (tab === 'contacts') loadContacts();
        }
        
        // Load initial data
        loadChats();
      </script>
    </body>
    </html>
  `);
});

app.listen(PORT, () => {
  console.log(\`✓ All Media App läuft auf http://localhost:\${PORT}\`);
});
