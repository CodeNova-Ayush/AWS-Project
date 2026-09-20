import React from 'react';
import { View, Text, ScrollView, StyleSheet, Platform } from 'react-native';
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
        <View style={[styles.dot, { backgroundColor: '#F59E0B' }]} />
        <View style={[styles.dot, { backgroundColor: '#10B981' }]} />
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
                line.type === 'add' && { color: '#34D399' },
                line.type === 'del' && { color: '#FB7185' },
              ]}
            >
              {line.type === 'add' ? '+' : line.type === 'del' ? '-' : ' '}
            </Text>
            <Text
              style={[
                styles.code,
                line.type === 'add' && { color: '#86EFAC' },
                line.type === 'del' && { color: '#FCA5A5' },
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
    backgroundColor: '#090B12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    maxHeight: 280,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    backgroundColor: '#111422',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#EF4444',
  },
  langLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginLeft: 'auto',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
  },
  codeScroll: {
    padding: SPACING.sm,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingHorizontal: SPACING.xs,
    borderRadius: 4,
  },
  lineAdd: {
    backgroundColor: 'rgba(16, 185, 129, 0.14)',
  },
  lineDel: {
    backgroundColor: 'rgba(244, 63, 94, 0.14)',
  },
  lineNumber: {
    color: '#64748B',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 24,
    textAlign: 'right',
    marginRight: SPACING.sm,
    opacity: 0.6,
  },
  prefix: {
    color: '#64748B',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    width: 14,
    fontWeight: '700',
  },
  code: {
    color: '#E2E8F0',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
});
