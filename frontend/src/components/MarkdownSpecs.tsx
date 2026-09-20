import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from 'react-native';
import Markdown, { RenderRules } from 'react-native-markdown-display';
import { Feather } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';

interface CodeBlockProps {
  content: string;
  language?: string;
}

function CodeBlock({ content, language }: CodeBlockProps) {
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
    <View style={styles.codeBlockBox}>
      {/* Code Header Bar */}
      <View style={styles.codeBlockHeader}>
        <View style={styles.codeBlockLangBadge}>
          <Feather name="terminal" size={11} color="#818CF8" />
          <Text style={styles.codeBlockLangText}>{langLabel}</Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.codeCopyBtn,
            pressed && styles.codeCopyBtnPressed,
          ]}
          onPress={handleCopy}
          hitSlop={8}
        >
          <Feather
            name={copied ? 'check' : 'copy'}
            size={11}
            color={copied ? '#34D399' : '#94A3B8'}
          />
          <Text style={[styles.codeCopyText, copied && { color: '#34D399' }]}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* Code Text with Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        style={styles.codeScrollView}
        contentContainerStyle={styles.codeScrollInner}
      >
        <Text style={styles.codeText} selectable>
          {cleanContent}
        </Text>
      </ScrollView>
    </View>
  );
}

interface MarkdownSpecsProps {
  content: string;
}

export default function MarkdownSpecs({ content }: MarkdownSpecsProps) {
  if (!content || !content.trim()) {
    return <Text style={styles.emptyText}>No specifications provided.</Text>;
  }

  const rules: RenderRules = {
    fence: (node) => {
      const lang = (node as any).sourceInfo || '';
      return <CodeBlock key={node.key} content={node.content} language={lang} />;
    },
    code_block: (node) => {
      return <CodeBlock key={node.key} content={node.content} language="" />;
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
    link: (node, children) => {
      const url = node.attributes?.href;
      return (
        <Text
          key={node.key}
          style={markdownStyles.link}
          onPress={() => {
            if (url) Linking.openURL(url).catch(() => {});
          }}
        >
          {children}
        </Text>
      );
    },
  };

  return (
    <Markdown
      style={markdownStyles}
      rules={rules}
      onLinkPress={(url) => {
        Linking.openURL(url).catch(() => {});
        return false;
      }}
    >
      {content}
    </Markdown>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 21,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: 8,
  },
  heading1: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    letterSpacing: -0.3,
  },
  heading2: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  heading3: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 3,
  },
  heading4: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
    marginBottom: 2,
  },
  strong: {
    color: '#FFFFFF',
    fontWeight: Platform.OS === 'ios' ? '800' : '700',
    letterSpacing: -0.1,
  },
  em: {
    fontStyle: 'italic',
    color: '#94A3B8',
  },
  code_inline: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: '#A5B4FC',
    borderWidth: 1,
    borderColor: 'rgba(99, 102, 241, 0.28)',
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    fontWeight: '600',
  },
  bullet_list: {
    marginVertical: 3,
  },
  ordered_list: {
    marginVertical: 3,
  },
  list_item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 2,
  },
  bullet_list_icon: {
    color: '#818CF8',
    fontSize: 13,
    marginRight: 6,
    marginTop: 1,
  },
  ordered_list_icon: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
    marginRight: 6,
  },
  blockquote: {
    backgroundColor: 'rgba(99, 102, 241, 0.07)',
    borderLeftColor: '#6366F1',
    borderLeftWidth: 3,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginVertical: 6,
  },
  hr: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    height: 1,
    marginVertical: 10,
  },
  link: {
    color: '#818CF8',
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    marginVertical: 8,
    overflow: 'hidden',
  },
  thead: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  th: {
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontWeight: '700',
    color: '#FFFFFF',
    fontSize: 11,
  },
  td: {
    padding: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    color: '#CBD5E1',
    fontSize: 11,
  },
});

const styles = StyleSheet.create({
  emptyText: {
    color: COLORS.textTertiary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  codeBlockBox: {
    backgroundColor: '#07090F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    marginVertical: 8,
    overflow: 'hidden',
  },
  codeBlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0E111C',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    padding: 10,
  },
  codeScrollInner: {
    paddingRight: 20,
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
    color: '#E2E8F0',
  },
});
