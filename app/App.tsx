import React, { useCallback, useContext, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { ActionSheet } from './components/ActionSheet';
import { AddContactSheet } from './components/AddContactSheet';
import { NewGroupSheet } from './components/NewGroupSheet';
import { TabBar, TabKey } from './components/TabBar';
import { TopSwitcher, AreaKey } from './components/TopSwitcher';
import { Toast } from './components/Toast';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/messenger/ChatListScreen';
import { ChatDetailScreen } from './screens/messenger/ChatDetailScreen';
import { ContactsScreen } from './screens/messenger/ContactsScreen';
import { StoriesScreen } from './screens/messenger/StoriesScreen';
import { StoryViewerScreen } from './screens/messenger/StoryViewerScreen';
import { CameraScreen } from './screens/messenger/CameraScreen';
import { CommunitiesScreen } from './screens/communities/CommunitiesScreen';
import { VideoFeedScreen } from './screens/video/VideoFeedScreen';
import { HomeFeedScreen } from './screens/home/HomeFeedScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { UserProfileScreen } from './screens/profile/UserProfileScreen';
import { colors } from './constants/design';
import { mockChats, mockContacts } from './mocks';
import { Chat, Community, Contact, Story } from './types';

type Overlay =
  | { kind: 'chat'; chat: Chat }
  | { kind: 'story'; story: Story }
  | { kind: 'profile'; userId: string }
  | { kind: 'camera' }
  | null;

type Sheet = 'new' | 'group' | 'contact' | null;

const Shell = () => {
  const [area, setArea] = useState<AreaKey>('messenger');
  const [tab, setTab] = useState<TabKey>('chats');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [chats, setChats] = useState<Chat[]>(mockChats);
  const [contacts, setContacts] = useState<Contact[]>(mockContacts);

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
      time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
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

  const openProfile = (userId: string) => setOverlay({ kind: 'profile', userId });

  const openStory = (story: Story) => {
    if (story.own) setOverlay({ kind: 'camera' });
    else setOverlay({ kind: 'story', story });
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

  const handleArea = (next: AreaKey) => {
    setArea(next);
    if (next === 'messenger') setTab('chats');
    if (next === 'profile') setTab('settings');
  };

  if (overlay?.kind === 'chat') {
    return (
      <ChatDetailScreen
        chat={overlay.chat}
        onBack={() => setOverlay(null)}
        onCall={(kind) => setNotice(kind === 'video' ? 'Videoanruf folgt in Phase 3' : 'Anruf folgt in Phase 3')}
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
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'camera') {
    return (
      <CameraScreen
        onClose={() => setOverlay(null)}
        onNotice={setNotice}
      />
    );
  }

  const renderContent = () => {
    if (area === 'home') {
      return (
        <HomeFeedScreen onOpenStory={openStory} onOpenProfile={openProfile} onNotice={setNotice} />
      );
    }

    if (area === 'video') {
      return <VideoFeedScreen onOpenProfile={openProfile} onNotice={setNotice} />;
    }

    if (area === 'communities') {
      return <CommunitiesScreen onOpenCommunity={openCommunity} onNotice={setNotice} />;
    }

    if (area === 'profile' || tab === 'settings') {
      return <ProfileScreen onNotice={setNotice} />;
    }

    if (tab === 'stories') {
      return (
        <StoriesScreen
          onOpenStory={openStory}
          onCreateStory={() => setOverlay({ kind: 'camera' })}
        />
      );
    }

    if (tab === 'contacts') {
      return (
        <ContactsScreen
          contacts={contacts}
          onOpenContact={(contact: Contact) => openProfile(contact.id)}
          onAddContact={() => setSheet('contact')}
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
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <TopSwitcher active={area} onChange={handleArea} />
      <View style={styles.content}>{renderContent()}</View>
      <TabBar
        active={tab}
        onChange={(next) => {
          setArea('messenger');
          setTab(next);
        }}
        unreadCount={unreadCount}
      />

      <ActionSheet
        visible={sheet === 'new'}
        title="Neu"
        items={[
          { key: 'group', label: 'Neue Gruppe', icon: 'people-outline' },
          { key: 'contact', label: 'Kontakt hinzufügen', icon: 'person-add-outline' },
        ]}
        onSelect={(key) => setSheet(key as Sheet)}
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
