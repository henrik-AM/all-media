import React, { useCallback, useContext, useState } from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { SupabaseProvider } from './contexts/SupabaseContext';
import { RepostProvider } from './contexts/RepostContext';
import { ActionSheet } from './components/ActionSheet';
import { AddContactSheet } from './components/AddContactSheet';
import { NewGroupSheet } from './components/NewGroupSheet';
import { KontoWechsel } from './components/KontoWechsel';
import { TabBar } from './components/TabBar';
import { TopSwitcher } from './components/TopSwitcher';
import { Toast } from './components/Toast';
import { AreaKey, SubKey, defaultSub } from './constants/navigation';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen } from './screens/messenger/ChatListScreen';
import { ChatDetailScreen } from './screens/messenger/ChatDetailScreen';
import { ContactsScreen } from './screens/messenger/ContactsScreen';
import { ContactProfileScreen } from './screens/messenger/ContactProfileScreen';
import { FriendMapScreen } from './screens/messenger/FriendMapScreen';
import { MessengerProfileScreen } from './screens/messenger/MessengerProfileScreen';
import { StoryViewerScreen } from './screens/messenger/StoryViewerScreen';
import { CameraScreen } from './screens/messenger/CameraScreen';
import { CallScreen } from './screens/messenger/CallScreen';
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
import { mockChats, mockContacts, mockStories, mockUsers } from './mocks';
import { Chat, Community, Contact, Message, Story } from './types';

type Overlay =
  | { kind: 'chat'; chat: Chat; extra?: Message[] }
  | { kind: 'story'; story: Story }
  /**
   * variant entscheidet, welches Profil gezeigt wird: im Messenger das
   * Kontaktprofil (Nummer, Medien, Blockieren), sonst das oeffentliche
   * Profil mit Beitraegen.
   */
  | { kind: 'profile'; userId: string; variant: 'kontakt' | 'oeffentlich' }
  | { kind: 'contacts' }
  | { kind: 'camera' }
  | { kind: 'call'; userId: string; art: 'audio' | 'video' }
  | null;

type Sheet = 'new' | 'group' | 'contact' | 'konto' | null;

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
  // Storys liegen in der Shell, damit die eigene Aufnahme in der Leiste
  // ankommt - vorher las jeder Bildschirm direkt die Mock-Daten.
  const [stories, setStories] = useState<Story[]>(mockStories);

  const sub = subs[area];
  const setSub = (next: SubKey) => setSubs((prev) => ({ ...prev, [area]: next }));

  const unreadCount = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);
  const hideNotice = useCallback(() => setNotice(null), []);

  const openChatWith = (userId: string) => {
    const chat = chats.find((c) => c.userId === userId);
    if (chat) setOverlay({ kind: 'chat', chat });
    else setNotice('Noch kein Chat mit dieser Person');
  };

  const createGroup = (name: string, memberIds: string[], info?: string) => {
    const chat: Chat = {
      id: `c${Date.now()}`,
      name,
      isGroup: true,
      memberIds,
      preview: info ? info : 'Gruppe erstellt',
      time: now(),
      unreadCount: 0,
    };
    setChats((prev) => [chat, ...prev]);
    setSheet(null);
    setNotice(`Gruppe „${name}“ erstellt`);
    setOverlay({ kind: 'chat', chat });
  };

  /**
   * Kontaktanfrage. Bis zur Annahme ist genau die eine mitgeschickte Nachricht
   * erlaubt - der Chat dazu wird gleich angelegt und als 'pending' markiert.
   */
  const addContact = (contact: Contact, ersteNachricht?: string) => {
    setContacts((prev) => [...prev, contact]);
    setSheet(null);

    const chat: Chat = {
      id: `c${Date.now()}`,
      name: contact.name,
      userId: contact.id,
      isGroup: false,
      preview: ersteNachricht ?? 'Anfrage gesendet',
      time: now(),
      unreadCount: 0,
      requestState: 'pending',
    };
    setChats((prev) => [chat, ...prev]);

    if (ersteNachricht) {
      const message: Message = {
        id: `m${Date.now()}`,
        chatId: chat.id,
        senderId: 'me',
        text: ersteNachricht,
        time: now(),
      };
      setOverlay({ kind: 'chat', chat, extra: [message] });
    }
  };

  /** Anfrage angenommen: der Chat ist ab jetzt frei benutzbar. */
  const acceptRequest = (chatId: string) => {
    setChats((prev) =>
      prev.map((c) => (c.id === chatId ? { ...c, requestState: 'accepted' as const } : c))
    );
    setOverlay((prev) =>
      prev?.kind === 'chat' && prev.chat.id === chatId
        ? { ...prev, chat: { ...prev.chat, requestState: 'accepted' as const } }
        : prev
    );
    setContacts((prev) =>
      prev.map((c) => {
        const chat = chats.find((x) => x.id === chatId);
        return chat && c.id === chat.userId
          ? { ...c, status: 'friend' as const, about: 'Kontakt' }
          : c;
      })
    );
    setNotice('Anfrage angenommen');
  };

  const befriend = (userId: string) => {
    const person = mockUsers[userId];
    if (contacts.some((c) => c.id === userId)) return setNotice(`${person.name} ist bereits in deinen Kontakten`);
    setContacts((prev) => [...prev, { id: userId, name: person.name, status: 'pending', about: 'Anfrage gesendet' }]);
    setNotice(`Anfrage an ${person.name} gesendet`);
  };

  // Aus dem Messenger heraus gehoert das Kontaktprofil dazu - Henrik wurde
  // vorher aus einem Chat heraus im Bereich Videos abgesetzt.
  const openProfile = (userId: string) =>
    setOverlay({ kind: 'profile', userId, variant: area === 'messenger' ? 'kontakt' : 'oeffentlich' });

  /** Ausdruecklich das oeffentliche Profil, unabhaengig vom Bereich. */
  const openPublicProfile = (userId: string) =>
    setOverlay({ kind: 'profile', userId, variant: 'oeffentlich' });

  const openStory = (story: Story) => {
    // Eigene Story: noch leer -> aufnehmen, sonst ansehen.
    if (story.own && !story.mediaUri) return setOverlay({ kind: 'camera' });
    setOverlay({ kind: 'story', story });
  };

  /** Aufnahme aus der Kamera landet in der eigenen Story. */
  const storyAufgenommen = (uri: string) => {
    setStories((prev) =>
      prev.map((s) =>
        s.own
          ? { ...s, mediaUri: uri, aufgenommen: Date.now(), viewed: false, name: 'Deine Story' }
          : s
      )
    );
    setOverlay(null);
    setNotice('Deine Story ist online');
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
        onCall={(art) => {
          if (!overlay.chat.userId) return setNotice('Gruppenanrufe folgen später');
          setOverlay({ kind: 'call', userId: overlay.chat.userId, art });
        }}
        onCamera={() => setOverlay({ kind: 'camera' })}
        onOpenProfile={openProfile}
        onAcceptRequest={acceptRequest}
      />
    );
  }

  if (overlay?.kind === 'profile') {
    if (overlay.variant === 'kontakt') {
      return (
        <ContactProfileScreen
          userId={overlay.userId}
          onBack={() => setOverlay(null)}
          onMessage={openChatWith}
          onCall={(id, art) => setOverlay({ kind: 'call', userId: id, art })}
          onNotice={setNotice}
        />
      );
    }
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
        alle={stories}
        onClose={() => setOverlay(null)}
        onDelete={() => {
          setStories((prev) =>
            prev.map((s) =>
              s.own ? { ...s, mediaUri: undefined, aufgenommen: undefined } : s
            )
          );
          setNotice('Deine Story wurde gelöscht');
        }}
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

  if (overlay?.kind === 'call') {
    return (
      <CallScreen
        userId={overlay.userId}
        art={overlay.art}
        onClose={() => setOverlay(null)}
        onNotice={setNotice}
      />
    );
  }

  if (overlay?.kind === 'camera') {
    return (
      <CameraScreen
        onClose={() => setOverlay(null)}
        onCaptured={storyAufgenommen}
        onNotice={setNotice}
      />
    );
  }

  const renderContent = () => {
    if (area === 'messenger') {
      if (sub === 'friendmap') return <FriendMapScreen onOpenProfile={openProfile} onNotice={setNotice} />;
      if (sub === 'camera') {
        return (
          <CameraScreen
            embedded
            onClose={() => setSub('chats')}
            onCaptured={(uri) => {
              storyAufgenommen(uri);
              setSub('chats');
            }}
            onNotice={setNotice}
          />
        );
      }
      if (sub === 'profile') {
        return (
          <MessengerProfileScreen
            onSwitchArea={switchArea}
            onSwitchAccount={() => setSheet('konto')}
            onOpenSettings={() => setArea('settings')}
            onNotice={setNotice}
          />
        );
      }
      return (
        <ChatListScreen
          allChats={chats}
          stories={stories}
          onOpenChat={(chat) => setOverlay({ kind: 'chat', chat })}
          onOpenStory={openStory}
          onNewChat={() => setSheet('new')}
        />
      );
    }

    if (area === 'videos') {
      if (sub === 'portrait') return <VideoFeedScreen onOpenProfile={openPublicProfile} onNotice={setNotice} />;
      if (sub === 'landscape') return <LandscapeVideosScreen onNotice={setNotice} />;
      if (sub === 'search') return <VideoSearchScreen onOpenProfile={openPublicProfile} onNotice={setNotice} />;
      if (sub === 'profile') return <VideoProfileScreen onSwitchArea={switchArea} onNotice={setNotice} />;
      return <HomeFeedScreen stories={stories} onOpenStory={openStory} onOpenProfile={openPublicProfile} onNotice={setNotice} />;
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

    return <SettingsScreen onNotice={setNotice} onLogout={logout} onSwitchAccount={() => setSheet('konto')} />;
  };

  return (
    // Kein SafeAreaView um die ganze Shell: Der Hintergrund soll bis in die
    // Ecken laufen, damit es wie eine echte App aussieht. Den Platz fuer Notch
    // und Home-Anzeige halten sich die obere und die untere Leiste selbst frei.
    <View style={styles.container}>
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

      <KontoWechsel
        visible={sheet === 'konto'}
        onClose={() => setSheet(null)}
        onNotice={setNotice}
      />

      <Toast message={notice} onHide={hideNotice} />
    </View>
  );
};

const Root = () => {
  const { isLoggedIn } = useContext(AuthContext);
  return isLoggedIn ? <Shell /> : <LoginScreen />;
};

const App = () => (
  <SafeAreaProvider>
    <SupabaseProvider>
      <AuthProvider>
        <RepostProvider>
          <Root />
        </RepostProvider>
      </AuthProvider>
    </SupabaseProvider>
  </SafeAreaProvider>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  content: { flex: 1 },
});

export default App;
