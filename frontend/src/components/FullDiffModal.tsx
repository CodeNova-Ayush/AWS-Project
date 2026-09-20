import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../constants/theme';
import { ParsedDiffFile, DiffMetrics } from '../utils/cardHelpers';

interface FullDiffModalProps {
  visible: boolean;
  onClose: () => void;
  files: ParsedDiffFile[];
  metrics: DiffMetrics;
  prTitle: string;
}

export default function FullDiffModal({
  visible,
  onClose,
  files,
  metrics,
  prTitle,
}: FullDiffModalProps) {
  const { height } = useWindowDimensions();
  const [selectedFileIdx, setSelectedFileIdx] = useState(0);

  const activeFile = files[selectedFileIdx] || files[0];

  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.sheet, { height: height * 0.9 }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.headerTopRow}>
                <Text style={styles.headerTitle}>Full Diff Inspection</Text>
                <View style={styles.diffPill}>
                  <Text style={styles.diffPillText}>{metrics.summaryText}</Text>
                </View>
              </View>
              <Text style={styles.headerSub} numberOfLines={1}>
                {prTitle}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <Feather name="x" size={18} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Multi-file selector bar */}
          {files.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.fileTabBar}
              contentContainerStyle={styles.fileTabBarInner}
            >
              {files.map((file, idx) => {
                const isActive = idx === selectedFileIdx;
                const basename = file.filename.split('/').pop() || file.filename;
                return (
                  <Pressable
                    key={idx}
                    onPress={() => setSelectedFileIdx(idx)}
                    style={[styles.fileTab, isActive && styles.fileTabActive]}
                  >
                    <Feather
                      name="file-text"
                      size={12}
                      color={isActive ? '#FFFFFF' : COLORS.textTertiary}
                    />
                    <Text style={[styles.fileTabText, isActive && styles.fileTabTextActive]}>
                      {basename}
                    </Text>
                    <Text style={[styles.fileTabCount, isActive && { color: 'rgba(255,255,255,0.7)' }]}>
                      +{file.additions} -{file.deletions}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {/* Active file banner */}
          <View style={styles.activeFileHeader}>
            <Feather name="file" size={14} color={COLORS.textSecondary} />
            <Text style={styles.activeFilePath} numberOfLines={1}>
              {activeFile?.filename || 'File'}
            </Text>
            <View style={styles.activeFileBadges}>
              <Text style={styles.fileBadgeAdd}>+{activeFile?.additions || 0}</Text>
              <Text style={styles.fileBadgeDel}>-{activeFile?.deletions || 0}</Text>
            </View>
          </View>

          {/* Diff Content */}
          <ScrollView
            style={styles.codeContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={true} nestedScrollEnabled>
              <View style={styles.codeLinesWrapper}>
                {activeFile?.lines.map((line, idx) => {
                  const isAdd = line.type === 'add';
                  const isDel = line.type === 'del';
                  return (
                    <View
                      key={idx}
                      style={[
                        styles.diffLine,
                        isAdd && styles.diffLineAdd,
                        isDel && styles.diffLineDel,
                      ]}
                    >
                      <Text style={styles.lineNum}>{idx + 1}</Text>
                      <Text
                        style={[
                          styles.diffPrefix,
                          isAdd && { color: COLORS.success },
                          isDel && { color: COLORS.error },
                        ]}
                      >
                        {isAdd ? '+' : isDel ? '-' : ' '}
                      </Text>
                      <Text
                        style={[
                          styles.lineContent,
                          isAdd && styles.lineContentAdd,
                          isDel && styles.lineContentDel,
                        ]}
                      >
                        {line.content}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable style={styles.closeActionBtn} onPress={onClose}>
              <Text style={styles.closeActionBtnText}>Close Diff</Text>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    overflow: 'hidden',
    ...SHADOWS.lg,
  },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E4E4E7',
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
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.2,
  },
  diffPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  diffPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  headerSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FAF8F5',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
  },
  fileTabBar: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FAF8F5',
    maxHeight: 48,
  },
  fileTabBarInner: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
  },
  fileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    ...SHADOWS.sm,
  },
  fileTabActive: {
    backgroundColor: '#18181B',
    borderColor: '#18181B',
  },
  fileTabText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  fileTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  fileTabCount: {
    fontSize: 10,
    color: COLORS.textTertiary,
  },
  activeFileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    backgroundColor: '#0E111C',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  activeFilePath: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '600',
    color: '#F1F5F9',
    flex: 1,
  },
  activeFileBadges: {
    flexDirection: 'row',
    gap: 6,
  },
  fileBadgeAdd: {
    fontSize: 11,
    fontWeight: '700',
    color: '#34D399',
  },
  fileBadgeDel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
  },
  codeContainer: {
    flex: 1,
    backgroundColor: '#07090F',
  },
  codeLinesWrapper: {
    minWidth: '100%',
    paddingVertical: 8,
  },
  diffLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    paddingHorizontal: 12,
  },
  diffLineAdd: {
    backgroundColor: 'rgba(34, 197, 94, 0.12)',
  },
  diffLineDel: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  lineNum: {
    width: 32,
    fontSize: 11,
    color: 'rgba(255,255,255,0.3)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'right',
    marginRight: 10,
  },
  diffPrefix: {
    width: 14,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
    color: 'rgba(255,255,255,0.4)',
  },
  lineContent: {
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#E2E8F0',
    lineHeight: 18,
  },
  lineContentAdd: {
    color: '#86efac',
  },
  lineContentDel: {
    color: '#fca5a5',
  },
  footer: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#FFFFFF',
  },
  closeActionBtn: {
    backgroundColor: '#18181B',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  closeActionBtnText: {
    color: '#FFFFFF',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
});
