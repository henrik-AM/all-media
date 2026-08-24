import React, { useCallback, useContext, useState } from 'react';
import { SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { EmptyState } from './components/EmptyState';
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
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { colors } from './constants/design';
import { mockChats } from './mocks';
import { Chat, Contact, Story } from './types';

type Overlay =
  | { kind: 'chat'; chat: Chat }
  | { kind: 'story'; story: Story }
  | { kind: 'camera' }
  | null;

const Shell = () => {
  const [area, setArea] = useState<AreaKey>('messenger');
  const [tab, setTab] = useState<TabKey>('chats');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unreadCount = mockChats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const hideNotice = useCallback(() => setNotice(null), []);

  const openContactChat = (contact: Contact) => {
    const chat = mockChats.find((c) => c.userId === contact.id);
    if (chat) setOverlay({ kind: 'chat', chat });
    else setNotice('Noch kein Chat mit diesem Kontakt');
  };

  const openStory = (story: Story) => {
    if (story.own) setOverlay({ kind: 'camera' });
    else setOverlay({ kind: 'story', story });
  };

  const handleArea = (next: AreaKey) => {
    if (next === 'camera') {
      setOverlay({ kind: 'camera' });
      return;
    }
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
    if (area === 'video') {
      return (
        <EmptyState
          icon="play-circle-outline"
          title="Video-Feed"
          text="Dieser Bereich kommt in einer späteren Phase."
        />
      );
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
          onOpenContact={openContactChat}
          onAddContact={() => setNotice('Kontakt hinzufügen folgt in Phase 3')}
        />
      );
    }

    return (
      <ChatListScreen
        onOpenChat={(chat) => setOverlay({ kind: 'chat', chat })}
        onOpenStory={openStory}
        onNewChat={() => setTab('contacts')}
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
