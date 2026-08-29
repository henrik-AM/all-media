import { Audio } from 'expo-av';

// Simple tone generator using Audio API
// These are silent by default but framework is ready for real sounds

export const SoundSystem = {
  async init() {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (e) {
      console.warn('Failed to init audio');
    }
  },

  async messageNotification() {
    try {
      // Simulate sound without actual audio file
      // In production, this would play: sounds/message.mp3
      await playTone(1000, 100); // 1000Hz for 100ms
    } catch (e) {
      // Fail silently
    }
  },

  async likeNotification() {
    try {
      // Simulate double-tap sound
      await playTone(1200, 80);
      await new Promise((r) => setTimeout(r, 50));
      await playTone(1200, 80);
    } catch (e) {
      // Fail silently
    }
  },

  async sendNotification() {
    try {
      // Simulate send/success sound
      await playTone(1400, 150);
    } catch (e) {
      // Fail silently
    }
  },

  async errorNotification() {
    try {
      // Low descending tone for error
      await playTone(600, 100);
      await new Promise((r) => setTimeout(r, 50));
      await playTone(400, 100);
    } catch (e) {
      // Fail silently
    }
  },

};

async function playTone(frequency: number, duration: number) {
  // Framework ready for tone generation
  // Actual implementation would use Oscillator API
}
