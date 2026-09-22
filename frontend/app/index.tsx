import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  ScrollView,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import { fetchMe, getApiBase, demoLogin, connectGitHubToken } from '../src/services/api';
import { COLORS, SPACING, BORDER_RADIUS } from '../src/constants/theme';
import MatrixRain from '../src/components/MatrixRain';

const { width: SW } = Dimensions.get('window');

export default function LoginScreen() {
  const router  = useRouter();
  const [checking, setChecking] = useState(true);
  const [pressing, setPressing] = useState(false);

  // PAT connection modal state
  const [patModalVisible, setPatModalVisible] = useState(false);
  const [patToken, setPatToken] = useState('');
  const [patLoading, setPatLoading] = useState(false);
  const [patError, setPatError] = useState('');
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(28)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  // #3 — cursor blink
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => { checkAuth(); }, []);

  useEffect(() => {
    if (!checking) {
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 8,  useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -6, duration: 2800, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue:  0, duration: 2800, useNativeDriver: true }),
        ])
      ).start();

      // Cursor blink loop
      Animated.loop(
        Animated.sequence([
          Animated.timing(cursorOpacity, { toValue: 0, duration: 480, useNativeDriver: true }),
          Animated.timing(cursorOpacity, { toValue: 1, duration: 480, useNativeDriver: true }),
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
      if (user) { router.replace('/feed'); return; }
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

  async function handleConnectPAT() {
    const trimmed = patToken.trim();
    if (!trimmed) {
      setPatError('Please paste your GitHub Personal Access Token.');
      return;
    }
    setPatLoading(true);
    setPatError('');
    try {
      await connectGitHubToken(trimmed);
      setPatModalVisible(false);
      router.replace('/feed');
    } catch (err: any) {
      setPatError(err?.message || 'Failed to authenticate token. Ensure token has repo scope.');
    } finally {
      setPatLoading(false);
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
        const errJson = await res.json().catch(() => ({}));
        setOauthNotice(errJson.detail || 'GitHub OAuth is not configured on this server. Connect directly with a Personal Access Token (PAT) below.');
        setPatModalVisible(true);
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
        setOauthNotice('GitHub OAuth is not configured on this server. Connect directly with a Personal Access Token (PAT) below.');
        setPatModalVisible(true);
      }
    } catch (error) {
      console.error('❌ GitHub login error:', error);
      setOauthNotice('Unable to reach GitHub OAuth. Connect directly using a Personal Access Token (PAT) below.');
      setPatModalVisible(true);
    } finally {
      setPressing(false);
    }
  }

  if (checking) {
    return (
      <View style={styles.loadingContainer}>
        <SnippetsLogo size={48} cursorOpacity={new Animated.Value(1)} />
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Waterfall matrix rain */}
      <MatrixRain opacity={0.35} />

      {/* Subtle bottom-right purple glow */}
      <View style={styles.glowBottom} />

      {/* #1 — Product preview card (teaser) */}
      <Animated.View style={[styles.previewCardWrap, { opacity: fadeAnim }]}>
        <PRPreviewCard />
      </Animated.View>

      {/* #6 — ScrollView for small screens */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View
          style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
        >
          {/* Logo */}
          <Animated.View style={{ transform: [{ scale: logoScale }, { translateY: floatAnim }] }}>
            <SnippetsLogo size={72} cursorOpacity={cursorOpacity} />
          </Animated.View>

          {/* Wordmark */}
          <View style={styles.wordmarkRow}>
            <Text style={styles.wordmark}>MergeDeck</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaText}>beta</Text>
            </View>
          </View>

          {/* Tagline */}
          <Text style={styles.tagline}>
            Swipe through PRs.{'\n'}
            <Text style={styles.taglineAccent}>Ship cleaner code.</Text>
          </Text>

          {/* Flow statement */}
          <View style={styles.flowRow}>
            <FlowStep label="Scroll issues" />
            <Feather name="arrow-right" size={11} color={COLORS.textTertiary} />
            <FlowStep label="Fire agents" accent />
            <Feather name="arrow-right" size={11} color={COLORS.textTertiary} />
            <FlowStep label="Come back to green" />
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Feature chips */}
          <View style={styles.chips}>
            <Chip icon="git-pull-request" label="AI diffs"        />
            <Chip icon="cpu"              label="BG agents"        />
            <Chip icon="key"              label="BYOK"             />
            <Chip icon="zap"              label="Approve & merge"  />
            <Chip icon="message-circle"   label="AI chat"          />
            <Chip icon="shield"           label="Encrypted keys"   />
          </View>

          {/* CTA */}
          <View style={styles.actions}>
            <Pressable
              style={({ pressed }) => [
                styles.githubBtn,
                (pressed || pressing) && styles.githubBtnPressed,
              ]}
              onPressIn={() => setPressing(true)}
              onPressOut={() => setPressing(false)}
              onPress={handleGitHubLogin}
              testID="github-login-btn"
            >
              <View style={styles.githubIconWrap}>
                <Feather name="github" size={18} color="#000" />
              </View>
              <Text style={styles.githubText}>Continue with GitHub</Text>
              <Feather name="arrow-right" size={16} color="rgba(0,0,0,0.45)" />
            </Pressable>

            {/* Direct PAT connection */}
            <Pressable
              style={({ pressed }) => [
                styles.patBtn,
                pressed && styles.patBtnPressed,
              ]}
              onPress={() => {
                setOauthNotice(null);
                setPatError('');
                setPatModalVisible(true);
              }}
              testID="github-pat-btn"
            >
              <Feather name="key" size={15} color={COLORS.primary} />
              <Text style={styles.patBtnText}>Connect with GitHub Token (PAT)</Text>
            </Pressable>

            {/* #5 — Keyboard hint, web only */}
            {Platform.OS === 'web' && (
              <View style={styles.kbHintRow}>
                <Text style={styles.kbHintText}>or press</Text>
                <View style={styles.kbKey}>
                  <Text style={styles.kbKeyText}>↵ Enter</Text>
                </View>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.6 }]}
              onPress={handleDemoLogin}
              testID="skip-login-btn"
            >
              <Text style={styles.skipText}>Explore Demo Mode (Mock PRs)</Text>
            </Pressable>
          </View>

          <Text style={styles.footerNote}>
            Sign in to save reviews · chat with AI · apply fixes
          </Text>

          {/* Bottom padding so content clears the pinned security bar */}
          <View style={{ height: 52 }} />
        </Animated.View>
      </ScrollView>

      {/* Security note — pinned to bottom */}
      <Animated.View style={[styles.securityRow, { opacity: fadeAnim }]}>
        <Feather name="shield" size={11} color={COLORS.textTertiary} />
        <Text style={styles.securityText}>
          API keys encrypted at rest · your code never leaves your device unencrypted · only PR metadata stored
        </Text>
      </Animated.View>

      {/* GitHub Personal Access Token (PAT) Modal */}
      <Modal
        visible={patModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPatModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <Feather name="github" size={20} color={COLORS.primary} />
                </View>
                <View>
                  <Text style={styles.modalTitle}>Connect GitHub Account</Text>
                  <Text style={styles.modalSubtitle}>Sync real repos & enable AI auto-merge</Text>
                </View>
              </View>
              <Pressable
                onPress={() => setPatModalVisible(false)}
                hitSlop={10}
                style={styles.modalCloseBtn}
              >
                <Feather name="x" size={18} color={COLORS.textTertiary} />
              </Pressable>
            </View>

            {oauthNotice ? (
              <View style={styles.noticeBanner}>
                <Feather name="info" size={14} color="#F59E0B" />
                <Text style={styles.noticeBannerText}>{oauthNotice}</Text>
              </View>
            ) : null}

            <Text style={styles.modalDescription}>
              Enter a GitHub Personal Access Token (classic or fine-grained) with <Text style={styles.boldText}>repo</Text> scope to load your pull requests, review changes, and let the AI Agent commit fixes.
            </Text>

            <Pressable
              style={styles.tokenHelpLink}
              onPress={() => {
                const url = 'https://github.com/settings/tokens/new?scopes=repo,read:user,user:email&description=MergeDeck';
                if (Platform.OS === 'web') {
                  window.open(url, '_blank');
                } else {
                  Linking.openURL(url);
                }
              }}
            >
              <Text style={styles.tokenHelpLinkText}>Generate new token on GitHub (repo scope) ↗</Text>
            </Pressable>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>Personal Access Token</Text>
              <TextInput
                style={styles.tokenInput}
                value={patToken}
                onChangeText={(text) => {
                  setPatToken(text);
                  if (patError) setPatError('');
                }}
                placeholder="ghp_... or github_pat_..."
                placeholderTextColor={COLORS.textTertiary}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {patError ? (
              <View style={styles.errorBanner}>
                <Feather name="alert-circle" size={14} color={COLORS.error} />
                <Text style={styles.errorBannerText}>{patError}</Text>
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalSubmitBtn, patLoading && { opacity: 0.7 }]}
                onPress={handleConnectPAT}
                disabled={patLoading}
              >
                {patLoading ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#000000" />
                    <Text style={styles.modalSubmitBtnText}>Authenticate & Sync PRs</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                style={styles.modalDemoBtn}
                onPress={() => {
                  setPatModalVisible(false);
                  handleDemoLogin();
                }}
              >
                <Text style={styles.modalDemoBtnText}>Continue in Demo Mode (Mock PRs)</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Snippets logo with blinking cursor ──────────────────────────────────────
function SnippetsLogo({ size, cursorOpacity }: { size: number; cursorOpacity: Animated.Value }) {
  const inner = size * 0.42;
  const br    = size * 0.22;

  return (
    <View style={[styles.logoOuter, { width: size, height: size, borderRadius: br }]}>
      <View style={[styles.logoCornerTL, { width: size * 0.28, height: size * 0.28 }]} />
      <View style={styles.logoGlyphRow}>
        <Text style={[styles.logoGlyph, { fontSize: inner * 0.72, lineHeight: inner }]}>
          {'</'}
        </Text>
        {/* Blinking cursor instead of closing > */}
        <Animated.Text
          style={[styles.logoCursor, { fontSize: inner * 0.72, lineHeight: inner, opacity: cursorOpacity }]}
        >
          {'|'}
        </Animated.Text>
      </View>
      <View style={[styles.logoCornerBR, { width: size * 0.12, height: size * 0.12, borderRadius: size * 0.06 }]} />
    </View>
  );
}

// ─── PR preview teaser card ───────────────────────────────────────────────────
function PRPreviewCard() {
  return (
    <View style={styles.previewCard} pointerEvents="none">
      {/* Header */}
      <View style={styles.previewHeader}>
        <View style={styles.previewDot} />
        <Text style={styles.previewTitle} numberOfLines={1}>fix: increase session timeout for prod</Text>
      </View>
      {/* Meta */}
      <View style={styles.previewMeta}>
        <Text style={styles.previewMetaText}>auth.ts</Text>
        <View style={styles.previewMetaSep} />
        <Text style={[styles.previewMetaText, { color: '#22C55E' }]}>+2</Text>
        <Text style={[styles.previewMetaText, { color: '#EF4444' }]}>−1</Text>
      </View>
      {/* Diff lines */}
      <View style={styles.previewDiff}>
        <Text style={styles.diffLineRemoved}>− const timeout = 3000</Text>
        <Text style={styles.diffLineAdded}>+ const timeout = 30_000</Text>
        <Text style={styles.diffLineAdded}>+ // 30 s — safe for slow networks</Text>
      </View>
      {/* Footer status */}
      <View style={styles.previewFooter}>
        <View style={styles.previewStatusChip}>
          <Text style={styles.previewStatusText}>agent reviewing…</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Flow step ────────────────────────────────────────────────────────────────
function FlowStep({ label, accent }: { label: string; accent?: boolean }) {
  return <Text style={[styles.flowStep, accent && styles.flowStepAccent]}>{label}</Text>;
}

// ─── Feature chip ─────────────────────────────────────────────────────────────
function Chip({ icon, label }: { icon: keyof typeof Feather.glyphMap; label: string }) {
  return (
    <View style={styles.chip}>
      <Feather name={icon} size={13} color={COLORS.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const MONO = Platform.OS === 'ios' ? 'Menlo' : 'monospace';

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // #6 ScrollView
  scroll: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Ambient glows
  glowBottom: {
    position: 'absolute',
    bottom: -160,
    right: -80,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: COLORS.secondary,
    opacity: 0.06,
  },

  // Main content
  content: {
    width: '100%',
    maxWidth: 360,
    paddingHorizontal: SPACING.xxl,
    alignItems: 'center',
  },

  // ─── #1 PR Preview card ───────────────────────────────────────────────────
  previewCardWrap: {
    position: 'absolute',
    bottom: 90,
    right: -28,
    transform: [{ rotate: '7deg' }],
    zIndex: 0,
  },
  previewCard: {
    width: 210,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    padding: 12,
    opacity: 0.22,
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  previewDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  previewTitle: {
    color: COLORS.textPrimary,
    fontSize: 10,
    fontWeight: '600',
    flex: 1,
  },
  previewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  previewMetaText: {
    color: COLORS.textTertiary,
    fontSize: 9,
    fontFamily: MONO,
  },
  previewMetaSep: {
    width: 1,
    height: 8,
    backgroundColor: COLORS.border,
  },
  previewDiff: {
    backgroundColor: COLORS.codeBg,
    borderRadius: BORDER_RADIUS.sm,
    padding: 8,
    gap: 2,
    marginBottom: 8,
  },
  diffLineRemoved: {
    color: '#EF4444',
    fontSize: 9,
    fontFamily: MONO,
    opacity: 0.9,
  },
  diffLineAdded: {
    color: '#22C55E',
    fontSize: 9,
    fontFamily: MONO,
    opacity: 0.9,
  },
  previewFooter: {
    alignItems: 'flex-start',
  },
  previewStatusChip: {
    backgroundColor: 'rgba(208, 253, 62, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.2)',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  previewStatusText: {
    color: COLORS.primary,
    fontSize: 8,
    fontFamily: MONO,
    fontWeight: '600',
  },

  // ─── Logo ─────────────────────────────────────────────────────────────────
  logoOuter: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xl,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  logoCornerTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: COLORS.primary,
    opacity: 0.12,
    borderBottomRightRadius: 999,
  },
  logoCornerBR: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: COLORS.primary,
    opacity: 0.55,
  },
  logoGlyphRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoGlyph: {
    fontFamily: MONO,
    color: COLORS.primary,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  logoCursor: {
    fontFamily: MONO,
    color: COLORS.primary,
    fontWeight: '400',
    marginLeft: -3,
  },

  // ─── Wordmark ─────────────────────────────────────────────────────────────
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: SPACING.lg,
  },
  wordmark: {
    color: COLORS.textPrimary,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.5,
    fontFamily: Platform.OS === 'ios' ? 'Helvetica Neue' : 'sans-serif-condensed',
  },
  betaBadge: {
    backgroundColor: 'rgba(208, 253, 62, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.25)',
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 4,
  },
  betaText: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    fontFamily: MONO,
  },

  // ─── Tagline ──────────────────────────────────────────────────────────────
  tagline: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.1,
    marginBottom: SPACING.xl,
  },
  taglineAccent: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },

  // ─── Flow ─────────────────────────────────────────────────────────────────
  flowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.sm,
  },
  flowStep: {
    color: COLORS.textTertiary,
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  flowStepAccent: {
    color: COLORS.primary,
    fontWeight: '700',
  },

  // ─── Divider ──────────────────────────────────────────────────────────────
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 1,
    marginBottom: SPACING.xl,
    opacity: 0.7,
  },

  // ─── Chips ────────────────────────────────────────────────────────────────
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginBottom: SPACING.xxxl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.1,
  },

  // ─── Actions ──────────────────────────────────────────────────────────────
  actions: {
    width: '100%',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  githubBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 15,
    paddingHorizontal: SPACING.lg,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  githubBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  githubIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  githubText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
    flex: 1,
    textAlign: 'center',
    marginLeft: -28,
  },

  // #5 Keyboard hint
  kbHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: -4,
  },
  kbHintText: {
    color: COLORS.textTertiary,
    fontSize: 11,
  },
  kbKey: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    backgroundColor: COLORS.surface,
  },
  kbKeyText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontFamily: MONO,
    fontWeight: '500',
  },

  skipBtn: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  skipText: {
    color: COLORS.textTertiary,
    fontSize: 13,
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },

  // ─── Footer ───────────────────────────────────────────────────────────────
  footerNote: {
    color: COLORS.textTertiary,
    fontSize: 11,
    textAlign: 'center',
    letterSpacing: 0.2,
    opacity: 0.7,
  },

  // ─── Security bar ─────────────────────────────────────────────────────────
  securityRow: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  securityText: {
    color: COLORS.textTertiary,
    fontSize: 10,
    lineHeight: 15,
    flex: 1,
    opacity: 0.7,
    letterSpacing: 0.1,
  },

  patBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(208, 253, 62, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(208, 253, 62, 0.3)',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
  },
  patBtnPressed: {
    backgroundColor: 'rgba(208, 253, 62, 0.16)',
  },
  patBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#161B22',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: BORDER_RADIUS.xl,
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(208, 253, 62, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  modalCloseBtn: {
    padding: 6,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  noticeBannerText: {
    flex: 1,
    color: '#F59E0B',
    fontSize: 12,
    lineHeight: 16,
  },
  modalDescription: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  boldText: {
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  tokenHelpLink: {
    alignSelf: 'flex-start',
  },
  tokenHelpLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  inputContainer: {
    gap: 6,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  tokenInput: {
    backgroundColor: '#0D1117',
    borderWidth: 1,
    borderColor: '#30363D',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    color: COLORS.textPrimary,
    fontSize: 13,
    fontFamily: MONO,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
  },
  errorBannerText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 12,
  },
  modalActions: {
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
  },
  modalSubmitBtnText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  modalDemoBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalDemoBtnText: {
    color: COLORS.textTertiary,
    fontSize: 12,
    textDecorationLine: 'underline',
  },
});
