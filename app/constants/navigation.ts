import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/*
 * Grundstruktur der App aus dem Figma-Prototypen. Sie ist bewusst hier
 * zentral abgelegt, damit Web-Version und App nicht auseinanderlaufen:
 *
 *   unten : vier Bereiche (Messenger, Videos, Communitys, Einstellungen)
 *   oben  : die Unterpunkte des gerade offenen Bereichs
 *
 * Quelle sind die Prototyp-Frames "Messenger - …", "Videos - …",
 * "Community - …" und "Einstellungen".
 */
export type AreaKey = 'messenger' | 'videos' | 'communities' | 'settings';

export type SubKey =
  | 'friendmap'
  | 'chats'
  | 'camera'
  | 'profile'
  | 'home'
  | 'portrait'
  | 'landscape'
  | 'search';

export interface SubItem {
  key: SubKey;
  label: string;
  icon: IconName;
  iconActive: IconName;
}

export interface AreaItem {
  key: AreaKey;
  label: string;
  icon: IconName;
  iconActive: IconName;
  subs: SubItem[];
}

export const NAV: AreaItem[] = [
  {
    key: 'messenger',
    label: 'Messenger',
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
    subs: [
      { key: 'friendmap', label: 'Friend-Map', icon: 'location-outline', iconActive: 'location' },
      { key: 'chats', label: 'Chats', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
      { key: 'camera', label: 'Kamera', icon: 'camera-outline', iconActive: 'camera' },
      { key: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
    ],
  },
  {
    key: 'videos',
    label: 'Videos',
    icon: 'play-outline',
    iconActive: 'play',
    subs: [
      { key: 'home', label: 'Home', icon: 'home-outline', iconActive: 'home' },
      { key: 'portrait', label: 'Hochformat', icon: 'phone-portrait-outline', iconActive: 'phone-portrait' },
      { key: 'landscape', label: 'Querformat', icon: 'tv-outline', iconActive: 'tv' },
      { key: 'search', label: 'Suche', icon: 'search-outline', iconActive: 'search' },
      { key: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
    ],
  },
  {
    key: 'communities',
    label: 'Communitys',
    icon: 'people-outline',
    iconActive: 'people',
    subs: [
      { key: 'home', label: 'Home', icon: 'grid-outline', iconActive: 'grid' },
      { key: 'chats', label: 'Chats', icon: 'chatbubble-outline', iconActive: 'chatbubble' },
      { key: 'search', label: 'Suchen', icon: 'search-outline', iconActive: 'search' },
      { key: 'profile', label: 'Profil', icon: 'person-outline', iconActive: 'person' },
    ],
  },
  {
    key: 'settings',
    label: 'Einstellungen',
    icon: 'settings-outline',
    iconActive: 'settings',
    subs: [],
  },
];

export const areaOf = (key: AreaKey): AreaItem => NAV.find((a) => a.key === key) as AreaItem;

/** Unterpunkt, mit dem ein Bereich startet. */
export const defaultSub: Record<AreaKey, SubKey> = {
  messenger: 'chats',
  videos: 'home',
  communities: 'home',
  settings: 'home',
};
