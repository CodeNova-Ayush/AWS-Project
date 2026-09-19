import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';
import { DiffLine } from '../constants/types';

interface Props {
  lines: DiffLine[];
  language: string;
}

export default function DiffViewer({ lines, language }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.dot} />
        <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
        <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
        <Text style={styles.langLabel}>{language}</Text>
      </View>
      <ScrollView style={styles.codeScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {lines.map((line, i) => (
          <View
            key={i}
            style={[
              styles.line,
              line.type === 'add' && styles.lineAdd,
              line.type === 'del' && styles.lineDel,
            ]}
            testID={`diff-line-${i}`}
          >
            <Text style={styles.lineNumber}>{i + 1}</Text>
            <Text
              style={[
                styles.prefix,
                line.type === 'add' && { color: COLORS.success },
                line.type === 'del' && { color: COLORS.error },
              ]}
            >
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </Text>
            <Text
              style={[
                styles.code,
                line.type === 'add' && { color: COLORS.success },
                line.type === 'del' && { color: COLORS.error },
              ]}
              numberOfLines={1}
            >
              {line.content}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.codeBg,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    maxHeight: 280,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 6,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.error,
  },
  langLabel: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
    marginLeft: 'auto',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  codeScroll: {
    padding: SPACING.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: 2,
  },
  lineAdd: {
    backgroundColor: COLORS.successBg,
  },
  lineDel: {
    backgroundColor: COLORS.errorBg,
  },
  lineNumber: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
    width: 24,
    textAlign: 'right',
    marginRight: SPACING.sm,
    opacity: 0.5,
  },
  prefix: {
    color: COLORS.textTertiary,
    fontSize: FONT_SIZES.sm,
    fontFamily: 'Courier New',
    width: 14,
    fontWeight: '700',
  },
  code: {
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.xs,
    fontFamily: 'Courier New',
    flex: 1,
  },
});
