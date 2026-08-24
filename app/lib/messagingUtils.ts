// Utility functions for messaging

export function formatMessageTime(date: Date | string): string {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - messageDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Gerade eben';
  if (diffMins < 60) return `vor ${diffMins}m`;
  if (diffHours < 24) return `vor ${diffHours}h`;
  if (diffDays < 7) return `vor ${diffDays}d`;

  return messageDate.toLocaleDateString('de-DE', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatChatTime(date: Date | string): string {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - messageDate.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return messageDate.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  if (diffDays === 1) return 'Gestern';
  if (diffDays < 7) return `vor ${diffDays}d`;

  return messageDate.toLocaleDateString('de-DE', {
    month: 'short',
    day: 'numeric',
  });
}

export function truncateMessage(text: string, maxLength: number = 50): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '…';
}

export function isToday(date: Date | string): boolean {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    messageDate.getDate() === today.getDate() &&
    messageDate.getMonth() === today.getMonth() &&
    messageDate.getFullYear() === today.getFullYear()
  );
}

export function isYesterday(date: Date | string): boolean {
  const messageDate = typeof date === 'string' ? new Date(date) : date;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    messageDate.getDate() === yesterday.getDate() &&
    messageDate.getMonth() === yesterday.getMonth() &&
    messageDate.getFullYear() === yesterday.getFullYear()
  );
}

// Group messages by date
export function groupMessagesByDate(
  messages: Array<{ id: string; created_at: string; [key: string]: any }>,
): Array<{
  date: string;
  label: string;
  messages: typeof messages;
}> {
  const groups: Record<string, typeof messages> = {};
  const labels: Record<string, string> = {};

  messages.forEach((msg) => {
    const date = new Date(msg.created_at);
    const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!groups[dateKey]) {
      groups[dateKey] = [];
      if (isToday(date)) {
        labels[dateKey] = 'Heute';
      } else if (isYesterday(date)) {
        labels[dateKey] = 'Gestern';
      } else {
        labels[dateKey] = date.toLocaleDateString('de-DE', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      }
    }

    groups[dateKey].push(msg);
  });

  return Object.entries(groups).map(([date, msgs]) => ({
    date,
    label: labels[date],
    messages: msgs,
  }));
}

// Detect if message is media
export function isMediaMessage(
  message: { media_url?: string; media_type?: string } | undefined,
): boolean {
  return !!(message?.media_url && message?.media_type);
}

// Generate message preview (with emoji support)
export function getMessagePreview(message: {
  content?: string;
  media_type?: string;
}): string {
  if (message.media_type === 'image') return '📷 Foto';
  if (message.media_type === 'video') return '🎥 Video';
  if (message.media_type === 'audio') return '🎵 Audio';
  return message.content || '(Nachricht)';
}

// Check if should show timestamp separator
export function shouldShowTimeSeparator(
  prevMessage: { created_at?: string } | undefined,
  currentMessage: { created_at: string },
  minuteThreshold: number = 60,
): boolean {
  if (!prevMessage?.created_at) return true;

  const prevDate = new Date(prevMessage.created_at);
  const currDate = new Date(currentMessage.created_at);
  const diffMs = currDate.getTime() - prevDate.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  return diffMins > minuteThreshold;
}
