import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize } from '@/constants/theme';

interface ToastProps {
  visible: boolean;
  message: string;
}

export function Toast({ visible, message }: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [visible, opacity]);

  return (
    <Animated.View style={[styles.wrap, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={18} color={Colors.toastText} />
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    // Positioned above tab bar and any footer buttons (tab bar ~50px + footer ~70px + margin)
    bottom: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.toastBg,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  text: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.toastText,
    fontWeight: '600',
  },
});
