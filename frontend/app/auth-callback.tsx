import React, { useEffect, useRef } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, FONT_SIZES } from '../src/constants/theme';

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
      let code: string | null = null;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        code = urlParams.get('code');

        if (code) {
          // This page is loaded inside the in-app browser (WebBrowser.openAuthSessionAsync).
          // Do a full-page redirect to the backend callback with mobile=true.
          // The backend will exchange the code and return an HTTP 302 redirect
          // to frontend://auth-callback?session_token=XXX, which
          // ASWebAuthenticationSession will intercept and dismiss the browser.
          const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8000';
          const backendCallback = `${API_BASE}/api/auth/github/callback?code=${code}&mobile=true`;
          console.log('🔵 auth-callback: redirecting to backend for mobile flow:', backendCallback);
          window.location.href = backendCallback;
          return;
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
