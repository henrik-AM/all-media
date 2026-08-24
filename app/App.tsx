import React, { useCallback, useContext, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { ActionSheet } from './components/ActionSheet';
import { AddContactSheet } from './components/AddContactSheet';
import { NewGroupSheet } from './components/NewGroupSheet';
import { TabBar } from './components/TabBar';
import { TopSwitcher } from './components/TopSwitcher';
import { Toast } from './components/Toast';
import { AreaKey, SubKey, defaultSub } from './constants/navigation';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/messenger/ChatListScreen';
import { ChatDetailScreen } from './screens/messenger/ChatDetailScreen';
import { ContactsScreen } from './screens/messenger/ContactsScreen';
import { FriendMapScreen } from './screens/messenger/FriendMapScreen';
import { MessengerProfileScreen } from './screens/messenger/MessengerProfileScreen';
import { StoryViewerScreen } from './screens/messenger/StoryViewerScreen';
import { CameraScreen } from './screens/messenger/CameraScreen';
import { CommunitiesScreen } from './screens/communities/CommunitiesScreen';
import { CommunityChatsScreen } from './screens/communities/CommunityChatsScreen';
import { CommunityProfileScreen } from './screens/communities/CommunityProfileScreen';
import { CommunitySearchScreen } from './screens/communities/CommunitySearchScreen';
import { VideoFeedScreen } from './screens/video/VideoFeedScreen';
import { LandscapeVideosScreen } from './screens/videos/LandscapeVideosScreen';
import { VideoProfileScreen } from './screens/videos/VideoProfileScreen';
import { VideoSearchScreen } from './screens/videos/VideoSearchScreen';
import { HomeFeedScreen } from './screens/home/HomeFeedScreen';
import { SettingsScreen } from './screens/profile/SettingsScreen';
import { UserProfileScreen } from './screens/profile/UserProfileScreen';
import { colors } from './constants/design';
import { mockChats, mockContacts, mockUsers } from './mocks';
import { Chat, Community, Contact, Message, Story } from './types';

type Overlay =
  | { kind: 'chat'; chat: Chat; extra?: Message[] }
  | { kind: 'story'; story: Story }
  | { kind: 'profile'; userId: string }
  | { kind: 'contacts' }
  | { kind: 'camera' }
  | null;

type Sheet = 'new' | 'group' | 'contact' | null;

const now = () => new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

const Shell = () => {
  const { logout } = useContext(AuthContext);

  // Jeder Bereich merkt sich seinen zuletzt offenen Unterpunkt — genau wie im
  // Prototyp, wo die obere Leiste zum Bereich gehoert.
  const [area, setArea] = useState<AreaKey>('messenger');
  const [subs, setSubs] = useState<Record<AreaKey, SubKey>>(defaultSub);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);

  const sub = subs[area];
  const setSub = (next: SubKey) => setSubs((prev) => ({ ...prev, [area]: next }));

  const unreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const hideNotice = useCallback(() => setNotice(null), []);

  const openChatWith = (userId: string) => {
    const chat = chats.find((c) => c.userId === userId);
    if (chat) setOverlay({ kind: 'chat', chat });
    else setNotice('Noch kein Chat mit dieser Person');
  };

  const createGroup = (name: string, memberIds: string[]) => {
    const chat: Chat = {
      id: `c${Date.now()}`,
      name,
      isGroup: true,
      memberIds,
      preview: 'Gruppe erstellt',
      time: now(),
      unreadCount: 0,
    };
    setChats((prev) => [chat, ...prev]);
    setSheet(null);
    setNotice(`Gruppe „${name}" erstellt`);
    setOverlay({ kind: 'chat', chat });
  };

  const addContact = (contact: Contact) => {
    setContacts((prev) => [...prev, contact]);
    setSheet(null);
  };

  const befriend = (userId: string) => {
    const person = mockUsers[userId];
    if (contacts.some((c) => c.id === userId)) return setNotice(`${person.name} ist bereits in deinen Kontakten`);
    setContacts((prev) => [...prev, { id: userId, name: person.name, status: 'pending', about: 'Anfrage gesendet' }]);
    setNotice(`Anfrage an ${person.name} gesendet`);
  };

  const openProfile = (userId: string) => setOverlay({ kind: 'profile', userId });

  const openStory = (story: Story) => {
    if (story.own) setOverlay({ kind: 'camera' });
    else setOverlay({ kind: 'story', story });
  };

  // Antwort auf eine Story: sie landet im Chat mit dieser Person, und der Chat
  // oeffnet sich direkt — sonst waere die Antwort nirgends zu sehen.
  const replyToStory = (story: Story, text: string) => {
    const person = mockUsers[story.userId];
    let chat = chats.find((c) => !c.isGroup && c.userId === story.userId);

    if (!chat) {
      chat = {
        id: `c${Date.now()}`,
        name: person.name,
        userId: story.userId,
        isGroup: false,
        preview: text,
        time: now(),
        unreadCount: 0,
      };
      setChats((prev) => [chat as Chat, ...prev]);
    } else {
      const id = chat.id;
      setChats((prev) => prev.map((c) => (c.id === id ? { ...c, preview: text, time: now() } : c)));
    }

    const message: Message = {
      id: `m${Date.now()}`,
      chatId: chat.id,
      senderId: 'me',
      text,
      time: now(),
    };

    setNotice(`Antwort an ${person.name} gesendet`);
    setOverlay({ kind: 'chat', chat, extra: [message] });
  };

  const openCommunity = (community: Community) => {
    setOverlay({
      kind: 'chat',
      chat: {
        id: community.id,
        name: community.name,
        isGroup: true,
        memberIds: new Array(Math.max(community.members - 1, 0)).fill(''),
        preview: community.topic,
        time: '',
        unreadCount: 0,
      },
    });
  };

  const switchArea = (next: AreaKey) => {
    setArea(next);
    setSubs((prev) => ({ ...prev, [next]: 'profile' as SubKey }));
  };

  if (overlay?.kind === 'chat') {
    return (
      <ChatDetailScreen
        chat={overlay.chat}
        extraMessages={overlay.extra}
        onBack={() => setOverlay(null)}
        onCall={(kind) => setNotice(kind === 'video' ? 'Videoanruf folgt' : 'Sprachanruf folgt')}
        onCamera={() => setOverlay({ kind: 'camera' })}
        onOpenProfile={openProfile}
      />
    );
  }

  if (overlay?.kind === 'profile') {
    return (
      <UserProfileScreen
        userId={overlay.userId}
        onBack={() => setOverlay(null)}
        onMessage={openChatWith}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'story') {
    return (
      <StoryViewerScreen
        story={overlay.story}
        onClose={() => setOverlay(null)}
        onReply={replyToStory}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'contacts') {
    return (
      <ContactsScreen
        contacts={contacts}
        onBack={() => setOverlay(null)}
        onOpenContact={(contact: Contact) => openProfile(contact.id)}
        onAddContact={() => setSheet('contact')}
      />
    );
  }

  if (overlay?.kind === 'camera') {
    return <CameraScreen onClose={() => setOverlay(null)} onNotice={setNotice} />;
  }

  const renderContent = () => {
    if (area === 'messenger') {
      if (sub === 'friendmap') return <FriendMapScreen onOpenProfile={openProfile} />;
      if (sub === 'camera') return <CameraScreen embedded onClose={() => setSub('chats')} onNotice={setNotice} />;
      if (sub === 'profile') {
        return (
          <MessengerProfileScreen
            onSwitchArea={switchArea}
            onOpenContacts={() => setOverlay({ kind: 'contacts' })}
            onOpenCamera={() => setOverlay({ kind: 'camera' })}
            onNotice={setNotice}
          />
        );
      }
      return (
        <ChatListScreen
          allChats={chats}
          onOpenChat={(chat) => setOverlay({ kind: 'chat', chat })}
          onOpenStory={openStory}
          onNewChat={() => setSheet('new')}
        />
      );
    }

    if (area === 'videos') {
      if (sub === 'portrait') return <VideoFeedScreen onOpenProfile={openProfile} onNotice={setNotice} />;
      if (sub === 'landscape') return <LandscapeVideosScreen onNotice={setNotice} />;
      if (sub === 'search') return <VideoSearchScreen onOpenProfile={openProfile} onNotice={setNotice} />;
      if (sub === 'profile') return <VideoProfileScreen onSwitchArea={switchArea} onNotice={setNotice} />;
      return <HomeFeedScreen onOpenStory={openStory} onOpenProfile={openProfile} onNotice={setNotice} />;
    }

    if (area === 'communities') {
      if (sub === 'chats') return <CommunityChatsScreen onOpenCommunity={openCommunity} />;
      if (sub === 'search') {
        return (
          <CommunitySearchScreen
            contacts={contacts}
            onOpenCommunity={openCommunity}
            onOpenProfile={openProfile}
            onBefriend={befriend}
          />
        );
      }
      if (sub === 'profile') {
        return (
          <CommunityProfileScreen
            onSwitchArea={switchArea}
            onOpenCommunity={openCommunity}
            onNotice={setNotice}
          />
        );
      }
      return <CommunitiesScreen onOpenCommunity={openCommunity} onNotice={setNotice} />;
    }

    return <SettingsScreen onNotice={setNotice} onLogout={logout} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <TopSwitcher area={area} active={sub} onChange={setSub} />
      <View style={styles.content}>{renderContent()}</View>
      <TabBar active={area} onChange={setArea} unreadCount={unreadCount} />

      <ActionSheet
        visible={sheet === 'new'}
        title="Neu"
        items={[
          { key: 'group', label: 'Neue Gruppe', icon: 'people-outline' },
          { key: 'contact', label: 'Kontakt hinzufügen', icon: 'person-add-outline' },
          { key: 'contacts', label: 'Kontakte', icon: 'person-outline' },
        ]}
        onSelect={(key) => {
          if (key === 'contacts') {
            setSheet(null);
            setOverlay({ kind: 'contacts' });
            return;
          }
          setSheet(key as Sheet);
        }}
        onClose={() => setSheet(null)}
      />
      <NewGroupSheet
        visible={sheet === 'group'}
        contacts={contacts}
        onClose={() => setSheet(null)}
        onCreate={createGroup}
        onNotice={setNotice}
      />
      <AddContactSheet
        visible={sheet === 'contact'}
        contacts={contacts}
        onClose={() => setSheet(null)}
        onAdd={addContact}
        onNotice={setNotice}
      />

      <Toast message={notice} onHide={hideNotice} />
    </SafeAreaView>
  );
};

const Root = () => {
  const { isLoggedIn } = useContext(AuthContext);
  return isLoggedIn ? <Shell /> : <LoginScreen />;
};

const App = () => (
  <SupabaseProvider>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </SupabaseProvider>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
});

export default App;
