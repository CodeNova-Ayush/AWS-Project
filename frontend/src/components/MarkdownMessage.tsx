import React, { useState } from 'react';
import { StyleSheet, Platform, View, Text, ScrollView, Pressable } from 'react-native';
import Markdown, { RenderRules } from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import { COLORS, FONT_SIZES, BORDER_RADIUS } from '../constants/theme';

interface Props {
  content: string;
  isUser?: boolean;
}

function MessageCodeBlock({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  let cleanContent = content || '';
  if (cleanContent.endsWith('\n')) {
    cleanContent = cleanContent.slice(0, -1);
  }

  function handleCopy() {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(cleanContent);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {}
  }

  const langLabel = (language || 'code').trim().toUpperCase();

  return (
    <View style={blockStyles.codeBlockBox}>
      <View style={blockStyles.codeBlockHeader}>
        <View style={blockStyles.codeBlockLangBadge}>
          <Feather name="terminal" size={11} color="#818CF8" />
          <Text style={blockStyles.codeBlockLangText}>{langLabel}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            blockStyles.codeCopyBtn,
            pressed && blockStyles.codeCopyBtnPressed,
          ]}
          onPress={handleCopy}
          hitSlop={8}
        >
          <Feather
            name={copied ? 'check' : 'copy'}
            size={11}
            color={copied ? '#34D399' : '#94A3B8'}
          />
          <Text style={[blockStyles.codeCopyText, copied && { color: '#34D399' }]}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        style={blockStyles.codeScrollView}
        contentContainerStyle={blockStyles.codeScrollInner}
      >
        <Text style={blockStyles.codeText} selectable>
          {cleanContent}
        </Text>
      </ScrollView>
    </View>
  );
}

export default function MarkdownMessage({ content, isUser = false }: Props) {
  const markdownStyles = StyleSheet.create({
    body: {
      color: isUser ? '#FFFFFF' : '#18181B',
      fontSize: FONT_SIZES.sm,
      lineHeight: 22,
    },
    heading1: {
      color: isUser ? '#FFFFFF' : '#18181B',
      fontSize: 17,
      fontWeight: '800',
      marginTop: 10,
      marginBottom: 6,
    },
    heading2: {
      color: isUser ? '#FFFFFF' : '#27272A',
      fontSize: 15,
      fontWeight: '700',
      marginTop: 8,
      marginBottom: 4,
    },
    heading3: {
      color: isUser ? '#FFFFFF' : '#4F46E5',
      fontSize: 13,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 4,
    },
    heading4: {
      color: isUser ? '#FFFFFF' : '#27272A',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 2,
    },
    heading5: {
      color: isUser ? '#FFFFFF' : '#52525B',
      fontSize: 12,
      fontWeight: '700',
      marginTop: 4,
      marginBottom: 2,
    },
    strong: {
      fontWeight: Platform.OS === 'ios' ? '800' : '700',
      color: isUser ? '#FFFFFF' : '#09090B',
    },
    em: {
      fontStyle: 'italic',
      color: isUser ? 'rgba(255,255,255,0.9)' : '#52525B',
    },
    code_inline: {
      backgroundColor: isUser ? 'rgba(0,0,0,0.25)' : 'rgba(79, 70, 229, 0.08)',
      color: isUser ? '#FFFFFF' : '#4F46E5',
      borderRadius: 5,
      borderWidth: 1,
      borderColor: isUser ? 'rgba(0,0,0,0.35)' : 'rgba(79, 70, 229, 0.2)',
      paddingHorizontal: 6,
      paddingVertical: 1.5,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      fontSize: 12,
      fontWeight: '600',
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
      color: isUser ? '#FFFFFF' : '#4F46E5',
      fontSize: 13,
      marginRight: 6,
    },
    ordered_list_icon: {
      color: isUser ? '#FFFFFF' : '#4F46E5',
      fontSize: 12,
      fontWeight: '700',
      marginRight: 6,
    },
    hr: {
      backgroundColor: 'rgba(0,0,0,0.08)',
      height: 1,
      marginVertical: 8,
    },
    table: {
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.08)',
      borderRadius: BORDER_RADIUS.sm,
      marginVertical: 6,
    },
    thead: {
      backgroundColor: '#FAF8F5',
    },
    th: {
      padding: 6,
      borderWidth: 0.5,
      borderColor: 'rgba(0,0,0,0.08)',
      fontWeight: '700',
      color: '#18181B',
      fontSize: 11,
    },
    td: {
      padding: 6,
      borderWidth: 0.5,
      borderColor: 'rgba(0,0,0,0.08)',
      color: '#52525B',
      fontSize: 11,
    },
    link: {
      color: isUser ? '#FFFFFF' : '#4F46E5',
      textDecorationLine: 'underline',
    },
    blockquote: {
      backgroundColor: isUser ? 'rgba(0,0,0,0.15)' : 'rgba(79, 70, 229, 0.05)',
      borderLeftColor: isUser ? '#FFFFFF' : '#4F46E5',
      borderLeftWidth: 3,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginVertical: 4,
    },
  });

  const rules: RenderRules = {
    fence: (node) => {
      const lang = (node as any).sourceInfo || '';
      return <MessageCodeBlock key={node.key} content={node.content} language={lang} />;
    },
    code_block: (node) => {
      return <MessageCodeBlock key={node.key} content={node.content} language="" />;
    },
    code_inline: (node, children, parent, styles, inheritedStyles = {}) => (
      <Text key={node.key} style={[inheritedStyles, styles.code_inline]}>
        {node.content}
      </Text>
    ),
    strong: (node, children, parent, styles, inheritedStyles = {}) => (
      <Text key={node.key} style={[inheritedStyles, styles.strong]}>
        {children}
      </Text>
    ),
  };

  return (
    <Markdown style={markdownStyles} rules={rules}>
      {content}
    </Markdown>
  );
}

const blockStyles = StyleSheet.create({
  codeBlockBox: {
    backgroundColor: '#07090F',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 6,
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E111C',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.07)',
  },
  codeBlockLangBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  codeBlockLangText: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  codeCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  codeCopyBtnPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  codeCopyText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  codeScrollView: {
    padding: 8,
  },
  codeScrollInner: {
    paddingRight: 16,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    lineHeight: 17,
    color: '#E2E8F0',
  },
});
