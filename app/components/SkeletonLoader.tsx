import React, { useEffect, useRef } from 'react';
import { Animated, View, ViewStyle, StyleSheet } from 'react-native';
import { colors as designColors } from '../constants/design';

interface Props {
  width?: number;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  circle?: boolean;
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  shimmer: {
    flex: 1,
  },
});

export const SkeletonLoader: React.FC<Props> = ({ width = '100%' as any, height = 20, borderRadius = 4, style, circle }) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: false,
      })
    ).start();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-300, 300],
  });

  const w = typeof width === 'number' ? width : width;
  const containerStyle = {
    width: circle ? height : w,
    height,
    borderRadius: circle ? (height / 2) : borderRadius,
    backgroundColor: designColors.surface2,
  };

  return (
    <View style={[styles.container, containerStyle, style]}>
      <Animated.View
        style={[
          styles.shimmer,
          {
            backgroundColor: designColors.surface3,
            transform: [{ translateX }],
          },
        ]}
      />
    </View>
  );
};

// Common skeleton screens
export const ChatRowSkeleton = () => (
  <View style={{ flexDirection: 'row' as const, gap: 12, paddingHorizontal: 16, paddingVertical: 8 }}>
    <SkeletonLoader width={56} height={56} circle />
    <View style={{ flex: 1 }}>
      <SkeletonLoader width={120} height={16} style={{ marginBottom: 6 }} />
      <SkeletonLoader width={150} height={14} />
    </View>
  </View>
);

export const VideoSkeleton = () => (
  <View style={{ flex: 1 }}>
    <SkeletonLoader width={300} height={400} />
    <View style={{ padding: 12, gap: 8 }}>
      <SkeletonLoader width={180} height={14} />
      <SkeletonLoader width={270} height={12} />
    </View>
  </View>
);

export const ProfileSkeleton = () => (
  <View style={{ alignItems: 'center' as const, padding: 20 }}>
    <SkeletonLoader width={100} height={100} circle style={{ marginBottom: 16 }} />
    <SkeletonLoader width={140} height={18} style={{ marginBottom: 8 }} />
    <SkeletonLoader width={100} height={14} />
  </View>
);
