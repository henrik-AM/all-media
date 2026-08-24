export const colors = {
  brand: '#0A66FF',
  brandSoft: '#E8F0FF',
  accent: '#00BCD4',

  bubbleOut: '#D6F5DD',
  bubbleOutText: '#10331A',
  bubbleOutMeta: '#4E7A5C',
  bubbleIn: '#FFFFFF',

  surface: '#FFFFFF',
  surface2: '#F5F6F8',
  surface3: '#EDEFF2',

  text: '#14171A',
  text2: '#6B7280',
  text3: '#9AA1AC',
  border: '#E3E6EA',

  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.12)',
  success: '#12A150',

  white: '#FFFFFF',
  black: '#000000',
};

export const darkColors: typeof colors = {
  brand: '#4D8DFF',
  brandSoft: '#16233B',
  accent: '#00BCD4',

  bubbleOut: '#1F4D33',
  bubbleOutText: '#DFF5E6',
  bubbleOutMeta: '#8FBF9F',
  bubbleIn: '#1C1F24',

  surface: '#131619',
  surface2: '#1A1E23',
  surface3: '#22272D',

  text: '#ECEFF3',
  text2: '#9BA3AE',
  text3: '#6C757F',
  border: '#262B31',

  danger: '#E5484D',
  dangerSoft: 'rgba(229,72,77,0.16)',
  success: '#12A150',

  white: '#FFFFFF',
  black: '#000000',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const typography = {
  title: { fontSize: 26, fontWeight: '700' as const, letterSpacing: -0.4 },
  h2: { fontSize: 20, fontWeight: '700' as const },
  h3: { fontSize: 16, fontWeight: '600' as const },
  name: { fontSize: 15.5, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  message: { fontSize: 14.5, fontWeight: '400' as const },
  preview: { fontSize: 13.5, fontWeight: '400' as const },
  small: { fontSize: 12, fontWeight: '500' as const },
  tiny: { fontSize: 10.5, fontWeight: '500' as const },
  overline: { fontSize: 12, fontWeight: '700' as const, letterSpacing: 0.7 },
};

export const sizes = {
  avatarLg: 52,
  avatarMd: 44,
  avatarSm: 36,
  avatarXl: 88,
  storyRing: 62,
  tabBar: 62,
  topBar: 56,
};

// Deterministic avatar colour per user id, so avatars stay stable across screens.
const AVATAR_COLORS = ['#F2A65A', '#6C8AE4', '#E4699B', '#4DB6AC', '#9575CD', '#7986CB', '#F06292', '#4DD0E1'];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
