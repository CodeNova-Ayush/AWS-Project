import React from 'react';
import { StyleSheet, View, ImageBackground, useWindowDimensions, Platform } from 'react-native';
import { COLORS } from '../constants/theme';

interface Props {
  activeColorRGB?: string;
}

const patternImage = require('../../assets/images/cream_grid_pattern.png');

export default function CodeBackground({ activeColorRGB = '79, 70, 229' }: Props) {
  const { width, height } = useWindowDimensions();

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      {/* 1. Base Warm Cream Canvas */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: COLORS.background }]} />

      {/* 2. Diamond Dot Tiled Pattern from attached asset */}
      <ImageBackground
        source={patternImage}
        style={StyleSheet.absoluteFillObject}
        resizeMode="repeat"
        imageStyle={{
          opacity: 0.95,
          // @ts-ignore
          ...(Platform.OS === 'web' ? { backgroundRepeat: 'repeat' } : {}),
        }}
      />

      {/* 3. Subtle Warm Ambient Radial Glow (Top / Center) */}
      <View
        style={{
          position: 'absolute',
          top: -height * 0.1,
          left: width * 0.1,
          width: width * 0.8,
          height: height * 0.45,
          borderRadius: width * 0.4,
          backgroundColor: `rgba(${activeColorRGB}, 0.03)`,
          transform: [{ scaleX: 1.3 }],
          // @ts-ignore - web filter support
          filter: 'blur(70px)',
        }}
      />

      {/* 4. Subtle Warm Amber Tint (Bottom Center) */}
      <View
        style={{
          position: 'absolute',
          bottom: -height * 0.05,
          right: -width * 0.1,
          width: width * 0.7,
          height: width * 0.7,
          borderRadius: width * 0.35,
          backgroundColor: 'rgba(217, 119, 6, 0.02)',
          // @ts-ignore - web filter support
          filter: 'blur(80px)',
        }}
      />
    </View>
  );
}
