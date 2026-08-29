import { Animated, Easing } from 'react-native';

// Transition animations
export const fadeIn = Animated.timing;
export const slideInRight = Animated.timing;
export const slideInUp = Animated.timing;

// Common animation configurations
export const Animations = {
  // Screen transitions
  screenEnter: {
    duration: 300,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
  },

  screenExit: {
    duration: 250,
    easing: Easing.in(Easing.cubic),
    useNativeDriver: true,
  },

  // UI elements
  elementEnter: {
    duration: 200,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  },

  elementExit: {
    duration: 150,
    easing: Easing.in(Easing.quad),
    useNativeDriver: true,
  },

  // Interactions
  tapScale: {
    duration: 150,
    easing: Easing.out(Easing.quad),
    useNativeDriver: true,
  },

  shimmer: {
    duration: 1200,
    easing: Easing.inOut(Easing.ease),
    useNativeDriver: false,
  },
};

// Fade animations
export function createFadeAnimation(initialValue = 0) {
  const fadeAnim = new Animated.Value(initialValue);

  return {
    fadeAnim,
    fadeIn: () =>
      Animated.timing(fadeAnim, {
        toValue: 1,
        ...Animations.elementEnter,
      }).start(),
    fadeOut: () =>
      Animated.timing(fadeAnim, {
        toValue: 0,
        ...Animations.elementExit,
      }).start(),
  };
}

// Slide animations
export function createSlideAnimation(initialX = 300) {
  const slideAnim = new Animated.Value(initialX);

  return {
    slideAnim,
    slideIn: () =>
      Animated.timing(slideAnim, {
        toValue: 0,
        ...Animations.screenEnter,
      }).start(),
    slideOut: () =>
      Animated.timing(slideAnim, {
        toValue: -300,
        ...Animations.screenExit,
      }).start(),
  };
}

// Scale animation for tap feedback
export function createScaleAnimation(initialScale = 1) {
  const scaleAnim = new Animated.Value(initialScale);

  return {
    scaleAnim,
    scaleDown: () =>
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        ...Animations.tapScale,
      }).start(),
    scaleUp: () =>
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }).start(),
  };
}
