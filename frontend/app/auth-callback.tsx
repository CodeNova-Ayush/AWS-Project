import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT_SIZES } from '../src/constants/theme';
import { getApiBase } from '../src/services/api';

export default function AuthCallback() {
  const router = useRouter();
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    processAuth();
  }, []);

  async function processAuth() {
    try {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionToken = urlParams.get('session_token');
        const code = urlParams.get('code');

        if (sessionToken) {
          await AsyncStorage.setItem('session_token', sessionToken);
          router.replace('/feed');
          return;
        }

        if (code) {
          const API_BASE = getApiBase();
          const res = await fetch(`${API_BASE}/api/auth/github/callback?code=${code}`, {
            headers: { 'Accept': 'application/json' },
          });

          if (!res.ok) {
            const err = await res.text();
            throw new Error(`Failed to exchange code: ${err}`);
          }

          const data = await res.json();
          if (data.session_token) {
            await AsyncStorage.setItem('session_token', data.session_token);
            router.replace('/feed');
            return;
          }
        }
      }

      // Fallback: native context or no code present
      router.replace('/');
    } catch (error) {
      console.error('Auth callback error:', error);
      router.replace('/');
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.text}>Signing you in...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
  },
});
