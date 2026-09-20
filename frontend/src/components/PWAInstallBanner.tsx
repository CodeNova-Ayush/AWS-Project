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
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
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

    // Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = /safari/.test(ua) && !/chrome|crios|fxios|edg/i.test(ua);

    if (isIosDevice && isSafari) {
      setIsIOS(true);
      // Reveal banner on iOS Safari after a short delay
      const timer = setTimeout(() => {
        setVisible(true);
        animateIn();
      }, 3000);
      return () => clearTimeout(timer);
    }

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
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
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
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    } catch (err) {
      console.warn('[PWA] Prompt error:', err);
    }
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
            source={{ uri: '/icons/icon-192.png' }}
            style={styles.appIcon}
          />

          <View style={styles.textContainer}>
            <Text style={styles.title}>Install MergeDeck</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {isIOS
                ? 'Add to Home Screen for the full app experience'
                : 'Fast swipe reels, offline mode & native feel'}
            </Text>
          </View>

          <Pressable
            style={styles.installBtn}
            onPress={handleInstallClick}
            accessibilityRole="button"
          >
            <Feather name="download" size={14} color="#050505" />
            <Text style={styles.installBtnText}>
              {isIOS ? 'Instructions' : 'Install'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.closeBtn}
            onPress={handleDismiss}
            accessibilityLabel="Dismiss install banner"
          >
            <Feather name="x" size={16} color="#94A3B8" />
          </Pressable>
        </View>
      </Animated.View>

      {/* iOS Instructions Modal */}
      {showIOSModal && (
        <Modal
          visible={showIOSModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowIOSModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowIOSModal(false)}
          >
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Install on iPhone / iPad</Text>
                <Pressable onPress={() => setShowIOSModal(false)}>
                  <Feather name="x" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>1</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap the <Text style={styles.bold}>Share</Text> button in Safari’s navigation bar (the square with an arrow pointing up).
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Scroll down and tap <Text style={styles.bold}>Add to Home Screen</Text>.
                </Text>
              </View>

              <View style={styles.stepRow}>
                <View style={styles.stepNum}>
                  <Text style={styles.stepNumText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Tap <Text style={styles.bold}>Add</Text> in the top right corner. MergeDeck will appear on your Home Screen as a native app!
                </Text>
              </View>

              <Pressable
                style={styles.modalGotItBtn}
                onPress={() => {
                  setShowIOSModal(false);
                  handleDismiss();
                }}
              >
                <Text style={styles.modalGotItText}>Got it!</Text>
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
    bottom: 24,
    left: 16,
    right: 16,
    zIndex: 99999,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 520,
    width: '100%',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(11, 15, 23, 0.95)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.25)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6), 0 0 15px rgba(0, 210, 255, 0.12)',
    backdropFilter: 'blur(16px)',
  },
  appIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00D2FF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginRight: 8,
    cursor: 'pointer',
  },
  installBtnText: {
    color: '#050505',
    fontSize: 13,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 999,
    cursor: 'pointer',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backdropFilter: 'blur(8px)',
  },
  modalCard: {
    backgroundColor: '#0B0F17',
    borderRadius: 20,
    padding: 24,
    maxWidth: 400,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 255, 0.3)',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.8)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 210, 255, 0.15)',
    borderWidth: 1,
    borderColor: '#00D2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    color: '#00D2FF',
    fontSize: 13,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#CBD5E1',
    lineHeight: 20,
  },
  bold: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  modalGotItBtn: {
    backgroundColor: '#00D2FF',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  modalGotItText: {
    color: '#050505',
    fontSize: 14,
    fontWeight: '700',
  },
});
