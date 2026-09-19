import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface Props {
  content: string;
  isUser?: boolean;
}

export default function MarkdownMessage({ content, isUser = false }: Props) {
  const markdownStyles = StyleSheet.create({
    body: {
      color: isUser ? COLORS.primaryFg : COLORS.textPrimary,
      fontSize: FONT_SIZES.sm,
      lineHeight: 22,
    },
    heading1: {
      color: isUser ? COLORS.primaryFg : COLORS.textPrimary,
      fontSize: 18,
      fontWeight: '800',
      marginTop: 10,
      marginBottom: 6,
    },
    heading2: {
      color: isUser ? COLORS.primaryFg : COLORS.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
    },
    heading3: {
      color: isUser ? COLORS.primaryFg : COLORS.primary,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 4,
    },
    heading4: {
      color: isUser ? COLORS.primaryFg : COLORS.textPrimary,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 2,
    },
    heading5: {
      color: isUser ? COLORS.primaryFg : COLORS.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
      marginBottom: 2,
    },
    strong: {
      fontWeight: '700',
      color: isUser ? COLORS.primaryFg : COLORS.textPrimary,
    },
    em: {
      fontStyle: 'italic',
    },
    code_inline: {
      backgroundColor: isUser ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.08)',
      color: isUser ? COLORS.primaryFg : COLORS.primary,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: isUser ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.12)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      fontWeight: '600',
    },
    code_block: {
      backgroundColor: '#0F1117',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: '#E2E8F0',
      marginVertical: 6,
    },
    fence: {
      backgroundColor: '#0F1117',
      borderColor: 'rgba(255,255,255,0.1)',
      borderWidth: 1,
      borderRadius: BORDER_RADIUS.sm,
      padding: 10,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 11,
      color: '#E2E8F0',
      marginVertical: 6,
    },
    bullet_list: {
      marginVertical: 4,
    },
    ordered_list: {
      marginVertical: 4,
    },
    list_item: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginVertical: 2,
    },
    bullet_list_icon: {
      color: COLORS.primary,
      fontSize: 14,
      marginRight: 6,
    },
    ordered_list_icon: {
      color: COLORS.primary,
      fontSize: 12,
      fontWeight: '700',
      marginRight: 6,
    },
    hr: {
      backgroundColor: COLORS.border,
      height: 1,
      marginVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor: COLORS.border,
      borderRadius: BORDER_RADIUS.sm,
      marginVertical: 6,
    },
    thead: {
      backgroundColor: COLORS.surfaceHighlight,
    },
    th: {
      padding: 6,
      borderWidth: 0.5,
      borderColor: COLORS.border,
      fontWeight: '700',
      color: COLORS.textPrimary,
      fontSize: 11,
    },
    td: {
      padding: 6,
      borderWidth: 0.5,
      borderColor: COLORS.border,
      color: COLORS.textSecondary,
      fontSize: 11,
    },
    link: {
      color: COLORS.primary,
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: 'rgba(255,255,255,0.03)',
      borderLeftColor: COLORS.primary,
      borderLeftWidth: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginVertical: 4,
    },
  });

  return <Markdown style={markdownStyles}>{content}</Markdown>;
}
