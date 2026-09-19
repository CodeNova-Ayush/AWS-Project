/**
 * PRActionModal — bottom-sheet style modal for Approve / Reject / Merge PR actions.
 *
 * Mode "approve": single confirm button, green CTA.
 * Mode "reject":  text input for reason + red CTA.
 * Mode "merge":   merge method picker (merge / squash / rebase) + optional commit title + purple CTA.
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Animated,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

export type PRActionMode = 'approve' | 'reject' | 'merge';
export type MergeMethod = 'merge' | 'squash' | 'rebase';

interface PRActionModalProps {
  visible: boolean;
  mode: PRActionMode;
  prTitle: string;
  onClose: () => void;
  onApprove: () => Promise<void>;
  onReject: (comment: string) => Promise<void>;
  onMerge: (method: MergeMethod, commitTitle: string) => Promise<void>;
}

const MERGE_METHODS: { value: MergeMethod; label: string; desc: string }[] = [
  { value: 'merge',   label: 'Merge commit',    desc: 'Preserve full history' },
  { value: 'squash',  label: 'Squash & merge',  desc: 'Single commit on base branch' },
  { value: 'rebase',  label: 'Rebase & merge',  desc: 'Linear history, no merge commit' },
];

const MODE_CONFIG: Record<PRActionMode, { title: string; icon: keyof typeof Feather.glyphMap; color: string; ctaLabel: string }> = {
  approve: { title: 'Approve PR', icon: 'check-circle', color: '#4ade80', ctaLabel: 'Approve' },
  reject:  { title: 'Request Changes', icon: 'x-circle', color: '#f87171', ctaLabel: 'Request Changes' },
  merge:   { title: 'Merge PR', icon: 'git-merge', color: '#a78bfa', ctaLabel: 'Merge Pull Request' },
};

export default function PRActionModal({
  visible,
  mode,
  prTitle,
  onClose,
  onApprove,
  onReject,
  onMerge,
}: PRActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('merge');
  const [commitTitle, setCommitTitle] = useState('');

  const slideAnim = useRef(new Animated.Value(400)).current;

  const cfg = MODE_CONFIG[mode];

  useEffect(() => {
    if (visible) {
      // Reset state when opening
      setLoading(false);
      setRejectComment('');
      setMergeMethod('merge');
      setCommitTitle('');

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }).start();
    } else {
      slideAnim.setValue(400);
    }
  }, [visible]);

  async function handleCTA() {
    setLoading(true);
    try {
      if (mode === 'approve') {
        await onApprove();
      } else if (mode === 'reject') {
        await onReject(rejectComment.trim() || 'Changes requested via CodeTok');
      } else {
        await onMerge(mergeMethod, commitTitle.trim());
      }
      onClose();
    } catch (err) {
      // Leave modal open on error — parent should show error toast
      // Re-throw so the parent's execute* handlers can optionally show their own toast
    } finally {
      setLoading(false);
    }
  }

  function handleBackdropPress() {
    if (!loading) onClose();
  }

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleBackdropPress} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconBadge, { backgroundColor: cfg.color + '22', borderColor: cfg.color + '55' }]}>
              <Feather name={cfg.icon} size={22} color={cfg.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>{cfg.title}</Text>
              <Text style={styles.headerSub} numberOfLines={1}>{prTitle}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} disabled={loading}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Approve mode — just a description */}
            {mode === 'approve' && (
              <View style={styles.section}>
                <Text style={styles.description}>
                  This will submit an approval review on GitHub. The PR author will be notified.
                </Text>
              </View>
            )}

            {/* Reject mode — comment input */}
            {mode === 'reject' && (
              <View style={styles.section}>
                <Text style={styles.fieldLabel}>Reason / feedback</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="What needs to be changed? (optional)"
                  placeholderTextColor={COLORS.textTertiary}
                  value={rejectComment}
                  onChangeText={setRejectComment}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={500}
                  editable={!loading}
                />
                <Text style={styles.charCount}>{rejectComment.length}/500</Text>
              </View>
            )}

            {/* Merge mode — method picker + commit title */}
            {mode === 'merge' && (
              <View style={styles.section}>
                <Text style={styles.fieldLabel}>Merge method</Text>
                {MERGE_METHODS.map((m) => (
                  <Pressable
                    key={m.value}
                    style={[styles.mergeOption, mergeMethod === m.value && styles.mergeOptionActive]}
                    onPress={() => setMergeMethod(m.value)}
                    disabled={loading}
                  >
                    <View style={[
                      styles.mergeRadio,
                      mergeMethod === m.value && { backgroundColor: cfg.color, borderColor: cfg.color },
                    ]}>
                      {mergeMethod === m.value && (
                        <View style={styles.mergeRadioInner} />
                      )}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.mergeLabel, mergeMethod === m.value && { color: COLORS.textPrimary }]}>
                        {m.label}
                      </Text>
                      <Text style={styles.mergeDesc}>{m.desc}</Text>
                    </View>
                  </Pressable>
                ))}

                <Text style={[styles.fieldLabel, { marginTop: SPACING.lg }]}>Commit title (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Merge pull request #..."
                  placeholderTextColor={COLORS.textTertiary}
                  value={commitTitle}
                  onChangeText={setCommitTitle}
                  editable={!loading}
                  maxLength={200}
                />
              </View>
            )}
          </ScrollView>

          {/* CTA Button */}
          <Pressable
            style={[styles.cta, { backgroundColor: cfg.color }, loading && styles.ctaDisabled]}
            onPress={handleCTA}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Feather name={cfg.icon} size={16} color="#000" />
                <Text style={styles.ctaText}>{cfg.ctaLabel}</Text>
              </>
            )}
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    backgroundColor: '#111113',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginBottom: SPACING.xl,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  description: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    lineHeight: 20,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  textArea: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.lg,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    padding: SPACING.md,
    minHeight: 100,
  },
  charCount: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs - 1,
    textAlign: 'right',
    marginTop: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.md,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
  },
  mergeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  mergeOptionActive: {
    borderColor: 'rgba(167,139,250,0.4)',
    backgroundColor: 'rgba(167,139,250,0.06)',
  },
  mergeRadio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.textTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mergeRadioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  mergeLabel: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  mergeDesc: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    marginTop: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: SPACING.md + 2,
    borderRadius: BORDER_RADIUS.xl,
    marginTop: SPACING.lg,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#000',
    fontSize: FONT_SIZES.md,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
