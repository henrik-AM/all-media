// Testing utilities for unit & integration tests

export const mockChats = [
  {
    id: 'chat_1',
    name: 'Anna Schmidt',
    participants: ['user_current', 'user_anna'],
    lastMessage: { text: 'Bis später!', timestamp: new Date() },
    unreadCount: 2,
    avatar: '👩‍🦰',
  },
  {
    id: 'chat_2',
    name: 'Bob Mueller',
    participants: ['user_current', 'user_bob'],
    lastMessage: { text: 'Klar, bin dabei', timestamp: new Date(Date.now() - 3600000) },
    unreadCount: 0,
    avatar: '👨‍💼',
  },
];

export const mockMessages = [
  {
    id: 'msg_1',
    chatId: 'chat_1',
    userId: 'user_anna',
    content: 'Hey, wie gehts?',
    createdAt: new Date(Date.now() - 3600000),
    readAt: null,
  },
  {
    id: 'msg_2',
    chatId: 'chat_1',
    userId: 'user_current',
    content: 'Mir gehts gut!',
    createdAt: new Date(Date.now() - 3500000),
    readAt: new Date(),
  },
];

export const mockUsers = {
  user_current: {
    id: 'user_current',
    name: 'Du',
    email: 'current@example.com',
    status: 'online',
  },
  user_anna: {
    id: 'user_anna',
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    status: 'online',
  },
  user_bob: {
    id: 'user_bob',
    name: 'Bob Mueller',
    email: 'bob@example.com',
    status: 'away',
  },
};

export const mockContacts = [
  {
    id: 'user_anna',
    name: 'Anna Schmidt',
    email: 'anna@example.com',
    status: 'friend',
    avatar: '👩‍🦰',
  },
  {
    id: 'user_bob',
    name: 'Bob Mueller',
    email: 'bob@example.com',
    status: 'friend',
    avatar: '👨‍💼',
  },
  {
    id: 'user_clara',
    name: 'Clara Weber',
    email: 'clara@example.com',
    status: 'pending',
    avatar: '👩‍🦱',
  },
];

// Test data generators
export function generateMockMessage(overrides: Record<string, any> = {}) {
  return {
    id: `msg_${Math.random()}`,
    chatId: 'chat_1',
    userId: 'user_current',
    content: 'Test message',
    createdAt: new Date(),
    readAt: null,
    ...overrides,
  };
}

export function generateMockChat(overrides: Record<string, any> = {}) {
  return {
    id: `chat_${Math.random()}`,
    name: 'Test Chat',
    participants: ['user_current', 'user_other'],
    lastMessage: { text: 'Last message', timestamp: new Date() },
    unreadCount: 0,
    ...overrides,
  };
}

export function generateMockUser(overrides: Record<string, any> = {}) {
  return {
    id: `user_${Math.random()}`,
    name: 'Test User',
    email: 'test@example.com',
    status: 'online',
    ...overrides,
  };
}

// Test helpers
export async function waitFor(
  condition: () => boolean,
  timeout: number = 5000,
): Promise<void> {
  const startTime = Date.now();
  while (!condition()) {
    if (Date.now() - startTime > timeout) {
      throw new Error('Timeout waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

export function mockSupabaseClient() {
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: [] }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      send: jest.fn().mockResolvedValue(null),
      subscribe: jest.fn().mockReturnThis(),
    })),
    removeChannel: jest.fn(),
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
      })),
    },
  };
}

// Performance testing
export function measurePerformance(name: string, fn: () => void) {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms`);
  return end - start;
}

// Snapshot testing helpers
export function createChatSnapshot(chat: any) {
  return {
    id: chat.id,
    name: chat.name,
    participantCount: chat.participants?.length || 0,
    hasUnread: chat.unreadCount > 0,
  };
}

export function createMessageSnapshot(message: any) {
  return {
    id: message.id,
    contentLength: message.content?.length || 0,
    isRead: !!message.readAt,
    timestamp: message.createdAt?.toISOString(),
  };
}
