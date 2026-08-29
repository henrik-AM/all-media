import * as Haptics from 'expo-haptics';

export const haptic = {
  // Light tap for quick confirmations
  light: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Fail silently if haptics unavailable
    }
  },

  // Medium feedback for selections
  medium: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Fail silently
    }
  },

  // Strong feedback for important actions
  strong: async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Fail silently
    }
  },

  // Success feedback for successful actions
  success: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Fail silently
    }
  },

  // Warning feedback for alerts
  warning: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
      // Fail silently
    }
  },

  // Error feedback for errors
  error: async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      // Fail silently
    }
  },

  // Selection changed
  selection: async () => {
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      // Fail silently
    }
  },

  // Impact feedback
  impact: async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    try {
      const styleMap = {
        light: Haptics.ImpactFeedbackStyle.Light,
        medium: Haptics.ImpactFeedbackStyle.Medium,
        heavy: Haptics.ImpactFeedbackStyle.Heavy,
      };
      await Haptics.impactAsync(styleMap[style]);
    } catch (e) {
      // Fail silently
    }
  },
};
