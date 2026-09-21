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
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/theme';

export type PRActionMode = 'approve' | 'reject' | 'merge';
export type MergeMethod = 'merge' | 'squash' | 'rebase';

interface PRActionModalProps {
  visible: boolean;
  mode: PRActionMode;
  prTitle: string;
  prNumber?: number;
  baseBranch?: string;
  onClose: () => void;
  onApprove?: () => Promise<void>;
  onReject?: (comment: string) => Promise<void>;
  onMerge?: (method: MergeMethod, commitTitle: string) => Promise<void>;
  onSuccess?: () => void;
}

const MERGE_METHODS: { value: MergeMethod; label: string; desc: string }[] = [
  { value: 'squash',  label: 'Squash & merge',  desc: 'Single commit on base branch (Recommended)' },
  { value: 'merge',   label: 'Merge commit',    desc: 'Preserve full branch history' },
  { value: 'rebase',  label: 'Rebase & merge',  desc: 'Linear history, no merge commit' },
];

const MODE_CONFIG: Record<PRActionMode, { title: string; icon: keyof typeof Feather.glyphMap; color: string; ctaLabel: string }> = {
  approve: { title: 'Approve PR', icon: 'check-circle', color: '#16A34A', ctaLabel: 'Approve Pull Request' },
  reject:  { title: 'Request Changes', icon: 'x-circle', color: '#E11D48', ctaLabel: 'Request Changes' },
  merge:   { title: 'Merge Safety Gate', icon: 'shield', color: '#7C3AED', ctaLabel: 'Confirm & Merge PR' },
};

export default function PRActionModal({
  visible,
  mode,
  prTitle,
  prNumber = 2,
  baseBranch = 'main',
  onClose,
  onApprove,
  onReject,
  onMerge,
  onSuccess,
}: PRActionModalProps) {
  const [loading, setLoading] = useState(false);
  const [rejectComment, setRejectComment] = useState('');
  const [mergeMethod, setMergeMethod] = useState<MergeMethod>('squash');
  const [commitTitle, setCommitTitle] = useState('');
  const [errorText, setErrorText] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(400)).current;

  const cfg = MODE_CONFIG[mode];

  useEffect(() => {
    if (visible) {
      // Reset state when opening
      setLoading(false);
      setRejectComment('');
      setMergeMethod('merge');
      setCommitTitle('');
      setErrorText(null);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 70,
        friction: 10,
      }).start();
    } else {
      slideAnim.setValue(400);
      setErrorText(null);
    }
  }, [visible]);

  async function handleCTA() {
    setLoading(true);
    setErrorText(null);
    try {
      if (mode === 'approve') {
        if (onApprove) await onApprove();
      } else if (mode === 'reject') {
        if (onReject) await onReject(rejectComment.trim() || 'Changes requested via MergeDeck');
      } else {
        if (onMerge) await onMerge(mergeMethod, commitTitle.trim());
      }
      onSuccess?.();
      onClose();
    } catch (err: any) {
      // Keep modal open so user sees why the action failed on GitHub
      setErrorText(err?.message || 'Operation failed on GitHub. Please check branch protections or permissions.');
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

            {/* Merge mode — Safety Gate + method picker + commit title */}
            {mode === 'merge' && (
              <View style={styles.section}>
                {/* Safety Confirmation Box */}
                <View style={styles.safetyGateBox}>
                  <View style={styles.safetyGateHeader}>
                    <Feather name="shield" size={18} color="#f59e0b" />
                    <Text style={styles.safetyGateTitle}>Merge Safety Gate</Text>
                  </View>
                  <Text style={styles.safetyGateQuestion}>
                    Merge PR #{prNumber} into {baseBranch} via {MERGE_METHODS.find(m => m.value === mergeMethod)?.label}?
                  </Text>
                  <Text style={styles.safetyGateNote}>
                    Safety verification prevents accidental taps beside Reject. This will directly write commit(s) to branch '{baseBranch}'.
                  </Text>
                </View>

                <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Merge method</Text>
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

                <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Commit title (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder={`Merge pull request #${prNumber}`}
                  placeholderTextColor={COLORS.textTertiary}
                  value={commitTitle}
                  onChangeText={setCommitTitle}
                  editable={!loading}
                  maxLength={200}
                />
              </View>
            )}
          </ScrollView>

          {/* CTA Button & Cancel */}
          <View style={{ gap: 10, marginTop: SPACING.md }}>
            {errorText && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={16} color="#E11D48" style={{ marginTop: 2 }} />
                <Text style={styles.errorTextBanner}>{errorText}</Text>
              </View>
            )}

            <Pressable
              style={[styles.cta, { backgroundColor: cfg.color }, loading && styles.ctaDisabled]}
              onPress={handleCTA}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name={cfg.icon} size={16} color="#FFFFFF" />
                  <Text style={styles.ctaText}>
                    {mode === 'merge' ? `Confirm & Merge PR #${prNumber}` : cfg.ctaLabel}
                  </Text>
                </>
              )}
            </Pressable>

            {mode === 'merge' && (
              <Pressable
                style={styles.cancelBtn}
                onPress={onClose}
                disabled={loading}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
            )}
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : SPACING.xl,
    borderTopWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    maxHeight: '85%',
    ...SHADOWS.lg,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E7',
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
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    letterSpacing: -0.3,
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
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: SPACING.xs,
  },
  textArea: {
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 14,
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
    backgroundColor: '#FAF8F5',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 12,
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
  },
  mergeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: 14,
    paddingHorizontal: SPACING.md,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
    marginBottom: SPACING.sm,
    backgroundColor: '#FAF8F5',
  },
  mergeOptionActive: {
    borderColor: '#7C3AED',
    backgroundColor: '#FFFFFF',
    ...SHADOWS.sm,
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
    backgroundColor: '#7C3AED',
  },
  mergeLabel: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  mergeDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    marginTop: 1,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: SPACING.lg,
    ...SHADOWS.sm,
  },
  ctaDisabled: {
    opacity: 0.6,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  safetyGateBox: {
    backgroundColor: 'rgba(245, 158, 11, 0.07)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.25)',
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  safetyGateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  safetyGateTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    color: '#D97706',
    letterSpacing: 0.8,
  },
  safetyGateQuestion: {
    fontSize: FONT_SIZES.sm + 1,
    fontWeight: '700',
    color: COLORS.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  safetyGateNote: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    lineHeight: 16,
  },
  cancelBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#FAF8F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    marginTop: 8,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(225, 29, 72, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(225, 29, 72, 0.25)',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.sm,
    gap: 8,
    marginBottom: 4,
  },
  errorTextBanner: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: '#E11D48',
    fontWeight: '500',
    lineHeight: 18,
  },
});
