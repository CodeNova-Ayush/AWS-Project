import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  Image,
  Modal,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../constants/theme';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const appIconSource = require('../../assets/images/icon.png');

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'android' | 'ios'>('android');
  const [visible, setVisible] = useState(false);

  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    // Check if already in standalone display mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      return;
    }

    // Check if user dismissed earlier in this session
    try {
      if (sessionStorage.getItem('mergedeck_pwa_dismissed') === 'true') {
        return;
      }
    } catch {
      // Ignore sessionStorage errors
    }

    // Detect device type
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isAndroidDevice = /android/.test(ua);
    const isMobile = isIosDevice || isAndroidDevice || window.innerWidth < 768;

    setIsIOS(isIosDevice);
    setIsAndroid(isAndroidDevice);
    setSelectedTab(isIosDevice ? 'ios' : 'android');

    // On mobile devices, reveal the install banner after a short delay
    if (isMobile) {
      const timer = setTimeout(() => {
        setVisible(true);
        animateIn();
      }, 2000);

      // Listen for Chromium / Android beforeinstallprompt
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setVisible(true);
        animateIn();
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // If app installed, hide banner
      const handleAppInstalled = () => {
        setVisible(false);
        setDeferredPrompt(null);
      };

      window.addEventListener('appinstalled', handleAppInstalled);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        window.removeEventListener('appinstalled', handleAppInstalled);
      };
    }
  }, []);

  const animateIn = () => {
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 80,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      try {
        sessionStorage.setItem('mergedeck_pwa_dismissed', 'true');
      } catch {
        // Ignore
      }
    });
  };

  const handleInstallClick = async () => {
    // If native prompt is available (e.g. Chrome over HTTPS/localhost), trigger it
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          setVisible(false);
        }
        setDeferredPrompt(null);
        return;
      } catch (err) {
        console.warn('[PWA] Prompt error:', err);
      }
    }

    // Otherwise show guided install modal (works for Android on WiFi HTTP, iOS Safari, etc.)
    setShowModal(true);
  };

  if (!visible) return null;

  return (
    <>
      <Animated.View
        style={[
          styles.container,
          {
            transform: [{ translateY: slideAnim }],
            opacity: opacityAnim,
          },
        ]}
      >
        <View style={styles.card}>
          <Image
            source={appIconSource}
            style={styles.appIcon}
          />

          <View style={styles.textContainer}>
            <Text style={styles.title}>Install MergeDeck</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              Full-screen reels, offline mode & native feel
            </Text>
          </View>

          <Pressable
            style={styles.installBtn}
            onPress={handleInstallClick}
            accessibilityRole="button"
          >
            <Feather name="download" size={13} color="#FFFFFF" />
            <Text style={styles.installBtnText}>Install</Text>
          </Pressable>

          <Pressable
            style={styles.closeBtn}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss install banner"
          >
            <Feather name="x" size={16} color={COLORS.textTertiary} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Universal Instructions Modal */}
      {showModal && (
        <Modal
          visible={showModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowModal(false)}
          >
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Image source={appIconSource} style={{ width: 28, height: 28, borderRadius: 6 }} />
                  <Text style={styles.modalTitle}>Install MergeDeck App</Text>
                </View>
                <Pressable onPress={() => setShowModal(false)} hitSlop={8}>
                  <Feather name="x" size={20} color={COLORS.textSecondary} />
                </Pressable>
              </View>

              {/* OS Tabs */}
              <View style={styles.tabRow}>
                <Pressable
                  style={[styles.tabBtn, selectedTab === 'android' && styles.tabBtnActive]}
                  onPress={() => setSelectedTab('android')}
                >
                  <Feather name="smartphone" size={14} color={selectedTab === 'android' ? COLORS.textPrimary : COLORS.textSecondary} />
                  <Text style={[styles.tabBtnText, selectedTab === 'android' && styles.tabBtnTextActive]}>
                    Android (Chrome)
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.tabBtn, selectedTab === 'ios' && styles.tabBtnActive]}
                  onPress={() => setSelectedTab('ios')}
                >
                  <Feather name="smartphone" size={14} color={selectedTab === 'ios' ? COLORS.textPrimary : COLORS.textSecondary} />
                  <Text style={[styles.tabBtnText, selectedTab === 'ios' && styles.tabBtnTextActive]}>
                    iPhone / iPad (Safari)
                  </Text>
                </Pressable>
              </View>

              <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                {selectedTab === 'android' ? (
                  <View style={styles.stepsWrapper}>
                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>
                        In Chrome, tap the <Text style={styles.bold}>three dots menu (⋮)</Text> in the top-right corner.
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Tap <Text style={styles.bold}>"Install app"</Text> or <Text style={styles.bold}>"Add to Home screen"</Text>.
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Tap <Text style={styles.bold}>"Install"</Text>. MergeDeck will launch as a standalone app with full-screen reels!
                      </Text>
                    </View>

                    <View style={styles.infoBox}>
                      <Feather name="info" size={13} color={COLORS.primary} />
                      <Text style={styles.infoBoxText}>
                        If on WiFi HTTP, adding to home screen gives full-screen native feel and app drawer access.
                      </Text>
                    </View>
                  </View>
                ) : (
                  <View style={styles.stepsWrapper}>
                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>1</Text>
                      </View>
                      <Text style={styles.stepText}>
                        In Safari, tap the <Text style={styles.bold}>Share button</Text> at the bottom of the screen (the square with an arrow pointing up).
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>2</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Scroll down the menu and tap <Text style={styles.bold}>"Add to Home Screen"</Text> (+ icon).
                      </Text>
                    </View>

                    <View style={styles.stepRow}>
                      <View style={styles.stepNum}>
                        <Text style={styles.stepNumText}>3</Text>
                      </View>
                      <Text style={styles.stepText}>
                        Tap <Text style={styles.bold}>"Add"</Text> in the top right. MergeDeck will appear on your Home Screen as an app!
                      </Text>
                    </View>
                  </View>
                )}
              </ScrollView>

              <Pressable
                style={styles.modalGotItBtn}
                onPress={() => {
                  setShowModal(false);
                  handleDismiss();
                }}
              >
                <Text style={styles.modalGotItText}>Got It!</Text>
              </Pressable>
            </View>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 82, // Floats cleanly above the bottom floating navigation pill!
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...SHADOWS.md,
  },
  appIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 10,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: COLORS.textTertiary,
    marginTop: 1,
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#18181B',
    paddingVertical: 7,
    paddingHorizontal: 13,
    borderRadius: BORDER_RADIUS.full,
    marginRight: 6,
    ...SHADOWS.sm,
  },
  installBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    maxWidth: 420,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF8F5',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
  },
  tabBtnText: {
    fontSize: 11,
    fontWeight: '500',
    color: COLORS.textSecondary,
  },
  tabBtnTextActive: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  stepsWrapper: {
    gap: 12,
    paddingVertical: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#18181B',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    padding: 10,
    borderRadius: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.15)',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.primary,
    lineHeight: 15,
  },
  modalGotItBtn: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    ...SHADOWS.sm,
  },
  modalGotItText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
