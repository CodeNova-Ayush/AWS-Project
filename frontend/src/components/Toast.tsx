import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  visible: boolean;
  onHide: () => void;
  duration?: number;
}

const TYPE_CONFIG: Record<ToastType, { icon: keyof typeof Feather.glyphMap; color: string; bg: string }> = {
  success: { icon: 'check-circle', color: '#4ade80', bg: 'rgba(22, 163, 74, 0.18)' },
  error:   { icon: 'x-circle',     color: '#f87171', bg: 'rgba(220, 38, 38, 0.18)' },
  info:    { icon: 'info',          color: '#60a5fa', bg: 'rgba(37, 99, 235, 0.18)' },
};

export default function Toast({
  message,
  type = 'success',
  visible,
  onHide,
  duration = 2200,
}: ToastProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { icon, color, bg } = TYPE_CONFIG[type];

  useEffect(() => {
    if (visible) {
      // Clear any pending hide timer
      if (timerRef.current) clearTimeout(timerRef.current);

      Animated.parallel([
        Animated.spring(opacity, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: 20, duration: 300, useNativeDriver: true }),
        ]).start(() => onHide());
      }, duration);
    } else {
      opacity.setValue(0);
      translateY.setValue(20);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.pill,
        { opacity, transform: [{ translateY }], backgroundColor: bg, borderColor: color + '55' },
      ]}
      pointerEvents="none"
    >
      <Feather name={icon} size={16} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: 110,
    alignSelf: 'center',
    left: '10%',
    right: '10%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
    zIndex: 9999,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
