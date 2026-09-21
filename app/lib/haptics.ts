import * as Haptics from 'expo-haptics';

/*
 * Der Schalter „Vibration" aus den Einstellungen.
 *
 * Er stand seit Anfang an in der Liste und wurde gespeichert, ohne dass ihn
 * jemals etwas gelesen hat (Audit vom 17.09.2026, Befund 1) — die App
 * vibrierte auch dann, wenn er aus war.
 *
 * Diese Datei ist ein Modul, kein Bildschirm: sie kann keinen Kontext lesen.
 * Deshalb hinterlegt der `EinstellungenProvider` den Wert hier, sobald er die
 * Einstellungen kennt. Bis dahin gilt der Auslieferungszustand „an" — eine
 * Vibration zu viel ist besser als eine ausgebliebene Rueckmeldung.
 *
 * Auf der Website gibt es kein Gegenstueck: ein Browser kann auf iOS nicht
 * vibrieren.
 */
let vibrationAn = true;

/** Wird vom EinstellungenProvider gerufen, nicht von Bildschirmen. */
export const vibrationSetzen = (an: boolean) => {
  vibrationAn = an;
};

/** Nur fuer Pruefungen und Fehlersuche. */
export const vibrationZustand = () => vibrationAn;

export const haptic = {
  // Light tap for quick confirmations
  light: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Fail silently if haptics unavailable
    }
  },

  // Medium feedback for selections
  medium: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (e) {
      // Fail silently
    }
  },

  // Strong feedback for important actions
  strong: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch (e) {
      // Fail silently
    }
  },

  // Success feedback for successful actions
  success: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Fail silently
    }
  },

  // Warning feedback for alerts
  warning: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch (e) {
      // Fail silently
    }
  },

  // Error feedback for errors
  error: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch (e) {
      // Fail silently
    }
  },

  // Selection changed
  selection: async () => {
    if (!vibrationAn) return;
    try {
      await Haptics.selectionAsync();
    } catch (e) {
      // Fail silently
    }
  },

  // Impact feedback
  impact: async (style: 'light' | 'medium' | 'heavy' = 'medium') => {
    if (!vibrationAn) return;
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
