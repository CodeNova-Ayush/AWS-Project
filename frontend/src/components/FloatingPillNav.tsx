import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, SPACING } from '../constants/theme';

// Map Expo Router tab route names to icons
const TAB_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  feed:     'home',
  sessions: 'zap',
  profile:  'user',
};

export default function FloatingPillNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.pill, { bottom: insets.bottom + 16 }]}>
      {state.routes.map((route, index) => {
        const isActive = state.index === index;
        const icon = TAB_ICONS[route.name] ?? 'circle';

        return (
          <Pressable
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.7 }]}
            hitSlop={8}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <Feather
                name={icon}
                size={18}
                color={isActive ? COLORS.primary : COLORS.textSecondary}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    alignSelf: 'center',
    left: 60,
    right: 60,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: SPACING.sm,
    backgroundColor: 'rgba(18,18,18,0.97)',
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 16,
  },
  item: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xs,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: `${COLORS.primary}18`,
    borderWidth: 1,
    borderColor: `${COLORS.primary}40`,
  },
});
