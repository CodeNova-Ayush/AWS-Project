import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { fetchMe, getApiBase, demoLogin } from '../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import ThreeBackground from '../src/components/ThreeBackground';

const MONO = Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'web' ? 'monospace' : 'monospace';

export default function LoginScreen() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [pressing, setPressing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!checking) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 65, friction: 9, useNativeDriver: true }),
      ]).start();

      // Subtle pulse on the brand icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 2400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 2400, useNativeDriver: true }),
        ])
      ).start();

      // Cursor blink
      Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
          Animated.timing(cursorOpacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [checking]);

  // Keyboard shortcut (web only)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') handleGitHubLogin();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  async function checkAuth() {
    try {
      const user = await fetchMe();
      if (user) {
        router.replace('/feed');
        return;
      }
    } catch {}
    setChecking(false);
  }

  async function handleDemoLogin() {
    try {
      setPressing(true);
      await demoLogin();
      router.replace('/feed');
    } catch (e) {
      console.error('Demo login fallback error:', e);
      router.replace('/feed');
    } finally {
      setPressing(false);
    }
  }

  async function handleGitHubLogin() {
    try {
      setPressing(true);
      const API_BASE = getApiBase();
      const res = await fetch(
        `${API_BASE}/api/auth/github/login${Platform.OS !== 'web' ? '?platform=mobile' : ''}`
      );
      if (!res.ok) {
        await handleDemoLogin();
        return;
      }
      const data = await res.json();

      if (data.oauth_url) {
        if (Platform.OS === 'web') {
          window.location.href = data.oauth_url;
        } else {
          const result = await WebBrowser.openAuthSessionAsync(data.oauth_url, 'frontend://auth-callback');
          if (result.type === 'success' && result.url) {
            const url = new URL(result.url);
            const sessionToken = url.searchParams.get('session_token');
            if (sessionToken) {
              await AsyncStorage.setItem('session_token', sessionToken);
              router.replace('/feed');
            }
          }
        }
      } else {
        await handleDemoLogin();
      }
    } catch (error) {
      console.error('❌ GitHub login error, using demo login fallback:', error);
      await handleDemoLogin();
    } finally {
      setPressing(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Three.js 3D Interactive Cyber Background */}
      <ThreeBackground />

      {/* Dark Ambient Radial Vignette */}
      <View style={styles.vignette} pointerEvents="none" />

      {/* Scrollable Container for Small Screens */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          style={[
            styles.heroCard,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Ambient Glow behind the card */}
          <View style={styles.cardGlow} pointerEvents="none" />

          {/* Logo / Brand Mark */}
          <Animated.View style={[styles.brandIconWrap, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.brandIconInner}>
              <Text style={styles.brandGlyph}>{'</'}</Text>
              <Animated.Text style={[styles.brandCursor, { opacity: cursorOpacity }]}>
                {'|'}
              </Animated.Text>
            </View>
          </Animated.View>

          {/* Brand Name & Status Badge */}
          <View style={styles.brandRow}>
            <Text style={styles.brandTitle}>MergeDeck</Text>
            <View style={styles.betaBadge}>
              <View style={styles.betaDot} />
              <Text style={styles.betaText}>BETA</Text>
            </View>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Reel-based code reviews.{'\n'}
            <Text style={styles.taglineHighlight}>Ship cleaner code together.</Text>
          </Text>

          {/* Feature Badges in 2x2 Clean Grid */}
          <View style={styles.featureGrid}>
            <FeaturePill icon="git-pull-request" label="AI PR Diffs" />
            <FeaturePill icon="shield" label="Bug & Risk Scan" />
            <FeaturePill icon="key" label="BYOK Multi-LLM" />
            <FeaturePill icon="check-circle" label="1-Tap Merge" />
          </View>

          {/* Action CTAs */}
          <View style={styles.actions}>
            {/* Primary GitHub Login Button */}
            <Pressable
              style={({ pressed }) => [
                styles.githubBtn,
                (pressed || pressing) && styles.githubBtnPressed,
              ]}
              onPress={handleGitHubLogin}
              disabled={pressing}
              testID="github-login-btn"
            >
              <View style={styles.githubBtnContent}>
                <Ionicons name="logo-github" size={20} color="#FFFFFF" style={styles.githubIcon} />
                <Text style={styles.githubBtnText}>
                  {pressing ? 'Connecting...' : 'Continue with GitHub'}
                </Text>
                <Feather name="arrow-right" size={16} color="rgba(255, 255, 255, 0.7)" />
              </View>
            </Pressable>

            {/* Keyboard shortcut hint (web only) */}
            {Platform.OS === 'web' && (
              <View style={styles.kbHintRow}>
                <Text style={styles.kbHintText}>or press</Text>
                <View style={styles.kbBadge}>
                  <Text style={styles.kbBadgeText}>↵ Enter</Text>
                </View>
              </View>
            )}

            {/* Guest / Demo Option */}
            <Pressable
              style={({ pressed }) => [styles.guestBtn, pressed && { opacity: 0.7 }]}
              onPress={() => router.replace('/feed')}
              testID="skip-login-btn"
            >
              <Text style={styles.guestBtnText}>Browse without an account →</Text>
            </Pressable>
          </View>

          {/* Security & Privacy Footer Note */}
          <View style={styles.securityRow}>
            <Feather name="lock" size={12} color={COLORS.textTertiary} />
            <Text style={styles.securityText}>
              256-bit AES encrypted · Local-first review · Zero code leakage
            </Text>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function FeaturePill({ icon, label }: { icon: any; label: string }) {
  return (
    <View style={styles.pill}>
      <Feather name={icon} size={12} color={COLORS.primaryLight} style={{ marginRight: 6 }} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#06070B',
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 7, 11, 0.45)',
    zIndex: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#06070B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
    zIndex: 2,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 16,
  },

  // ─── Hero Glassmorphic Card ────────────────────────────────────────────────
  heroCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: 'rgba(13, 16, 25, 0.76)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 28,
    paddingVertical: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.6,
    shadowRadius: 36,
    elevation: 20,
    // @ts-ignore - CSS backdrop-filter on web
    backdropFilter: 'blur(24px)',
  },
  cardGlow: {
    position: 'absolute',
    top: -60,
    width: 240,
    height: 120,
    borderRadius: 120,
    backgroundColor: 'rgba(99, 102, 241, 0.18)',
    filter: 'blur(50px)',
  },

  // ─── Brand Icon ────────────────────────────────────────────────────────────
  brandIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: '#0F121C',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 8,
  },
  brandIconInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandGlyph: {
    color: '#818CF8',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
    fontFamily: MONO,
  },
  brandCursor: {
    color: '#38BDF8',
    fontSize: 22,
    fontWeight: '300',
    fontFamily: MONO,
    marginLeft: -2,
  },

  // ─── Brand Name ────────────────────────────────────────────────────────────
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  brandTitle: {
    color: '#F8FAFC',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    fontFamily: Platform.OS === 'web' ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif" : undefined,
  },
  betaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2.5,
  },
  betaDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#38BDF8',
  },
  betaText: {
    color: '#A5B4FC',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: MONO,
  },

  // ─── Tagline ───────────────────────────────────────────────────────────────
  tagline: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: Platform.OS === 'web' ? "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Inter', sans-serif" : undefined,
  },
  taglineHighlight: {
    color: '#E2E8F0',
    fontWeight: '600',
  },

  // ─── Feature Pills ─────────────────────────────────────────────────────────
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 28,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  },

  // ─── Action Buttons ────────────────────────────────────────────────────────
  actions: {
    width: '100%',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  githubBtn: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 6,
  },
  githubBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  githubBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  githubIcon: {
    marginRight: 2,
  },
  githubBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },

  kbHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kbHintText: {
    color: '#64748B',
    fontSize: 12,
  },
  kbBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  kbBadgeText: {
    color: '#94A3B8',
    fontSize: 11,
    fontFamily: MONO,
  },

  guestBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  guestBtnText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '600',
  },

  // ─── Security Footer ───────────────────────────────────────────────────────
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  securityText: {
    color: '#64748B',
    fontSize: 11,
    textAlign: 'center',
  },
});
