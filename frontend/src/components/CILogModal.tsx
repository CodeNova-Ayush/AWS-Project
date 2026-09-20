import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { CIInfo } from '../utils/cardHelpers';

interface CILogModalProps {
  visible: boolean;
  onClose: () => void;
  ciInfo: CIInfo;
  repoName: string;
  branchName: string;
}

export default function CILogModal({
  visible,
  onClose,
  ciInfo,
  repoName,
  branchName,
}: CILogModalProps) {
  const isPassed = ciInfo.status === 'passed';

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View
              style={[
                styles.statusIconWrapper,
                { backgroundColor: isPassed ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)' },
              ]}
            >
              <Feather
                name={isPassed ? 'check-circle' : 'alert-triangle'}
                size={22}
                color={isPassed ? COLORS.success : COLORS.error}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerTitle}>
                {isPassed ? 'CI/CD Build Succeeded' : 'CI/CD Build Failed'}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {repoName} • {branchName}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* Status Summary Banner */}
            <View
              style={[
                styles.summaryCard,
                { borderColor: isPassed ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)' },
              ]}
            >
              <View style={styles.summaryRow}>
                <View style={styles.metricBlock}>
                  <Text style={styles.metricValue}>
                    {ciInfo.passedCount}/{ciInfo.totalCount}
                  </Text>
                  <Text style={styles.metricLabel}>Suites Passed</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricBlock}>
                  <Text style={[styles.metricValue, { color: isPassed ? COLORS.success : COLORS.error }]}>
                    {isPassed ? 'CLEAN' : '1 ERROR'}
                  </Text>
                  <Text style={styles.metricLabel}>Exit Status</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.metricBlock}>
                  <Text style={styles.metricValue}>GitHub Actions</Text>
                  <Text style={styles.metricLabel}>Runner</Text>
                </View>
              </View>
            </View>

            {/* Failure Log Snippet or Success Confirmation */}
            {!isPassed ? (
              <View style={styles.logSection}>
                <View style={styles.logSectionHeader}>
                  <Feather name="terminal" size={15} color={COLORS.error} />
                  <Text style={styles.logSectionTitle}>Failed Test Log Snippet</Text>
                </View>
                <View style={styles.terminalBox}>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    <Text style={styles.logCode}>
                      {ciInfo.failureLog ||
                        'FAIL tests/unit.test.ts\n  ✕ Test assertion failed\n  Received exit code 1'}
                    </Text>
                  </ScrollView>
                </View>
                <Text style={styles.logTip}>
                  Tip: Fix the failing assertion before approving or merging this pull request.
                </Text>
              </View>
            ) : (
              <View style={styles.successSection}>
                <Feather name="shield" size={32} color={COLORS.success} style={{ marginBottom: 10 }} />
                <Text style={styles.successTitle}>All automated checks passed</Text>
                <Text style={styles.successDesc}>
                  Unit tests, integration suites, lint rules, and dependency vulnerability scans ran with zero errors.
                </Text>
              </View>
            )}
          </ScrollView>

          {/* Action CTA */}
          <View style={styles.footer}>
            <Pressable style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#12151c',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    gap: 12,
  },
  statusIconWrapper: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  headerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  summaryCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricBlock: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  metricValue: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  metricLabel: {
    color: COLORS.textTertiary,
    fontSize: 11,
    marginTop: 2,
  },
  logSection: {
    marginBottom: SPACING.lg,
  },
  logSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  logSectionTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.error,
  },
  terminalBox: {
    backgroundColor: '#0a0d14',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    padding: SPACING.md,
  },
  logCode: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    color: '#fca5a5',
    lineHeight: 18,
  },
  logTip: {
    color: COLORS.textTertiary,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  successSection: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
  successTitle: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    marginBottom: 6,
  },
  successDesc: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  doneBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  doneBtnText: {
    color: COLORS.textPrimary,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
});
