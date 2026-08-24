import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { AuthContext, AuthProvider } from './contexts/AuthContext';
import { LoginScreen } from './screens/LoginScreen';
import { ChatListScreen, ChatDetailScreen } from './screens/messenger/ChatListScreen';
import { VideoFeedScreen } from './screens/video/VideoFeedScreen';
import { CommunitiesScreen } from './screens/communities/CommunitiesScreen';
import { HomeFeedScreen } from './screens/home/HomeFeedScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { colors } from './constants/design';
import Ionicons from '@expo/vector-icons/Ionicons';

const Tab = createBottomTabNavigator();

const AppTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.mediumGray,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.lightGray },
        tabBarIcon: ({ color, size }) => {
          const iconName = {
            home: 'home',
            video: 'play',
            messenger: 'chatbubble',
            communities: 'people',
            profile: 'person',
          }[route.name] || 'home';
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="home" component={HomeFeedScreen} options={{ title: 'Home' }} />
      <Tab.Screen name="video" component={VideoFeedScreen} options={{ title: 'Videos' }} />
      <Tab.Screen name="messenger" component={ChatListScreen} options={{ title: 'Messenger' }} />
      <Tab.Screen name="communities" component={CommunitiesScreen} options={{ title: 'Community' }} />
      <Tab.Screen name="profile" component={ProfileScreen} options={{ title: 'Profil' }} />
    </Tab.Navigator>
  );
};

const RootNavigator = () => {
  const { isLoggedIn } = useContext(AuthContext);

  return (
    <NavigationContainer>
      {isLoggedIn ? <AppTabs /> : <LoginScreen />}
    </NavigationContainer>
  );
};

const App = () => (
  <AuthProvider>
    <RootNavigator />
  </AuthProvider>
);

export default App;
