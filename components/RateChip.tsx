import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { darken } from '@/lib/color';
import { FontSize, FontWeight, Radius } from '@/constants/theme';

interface ScaleEntry {
  bg: string;
  text: string;
  label: string;
}

interface RateChipProps {
  size: 34 | 50;
  scale: ScaleEntry;
  payload: number | 'mood' | 'sleep';
  selected?: boolean;
  selectColor?: string;
}

function MoodGlyph({ size, color }: { size: number; color: string }) {
  const s = size * 0.7;
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - 1;
  const eyeY = cy - r * 0.2;
  const eyeR = r * 0.1;
  const eyeOff = r * 0.28;
  const smileR = r * 0.45;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={1.5} fill="none" />
      <Circle cx={cx - eyeOff} cy={eyeY} r={eyeR} fill={color} />
      <Circle cx={cx + eyeOff} cy={eyeY} r={eyeR} fill={color} />
      <Path
        d={`M ${cx - smileR} ${cy + r * 0.1} Q ${cx} ${cy + r * 0.6} ${cx + smileR} ${cy + r * 0.1}`}
        stroke={color} strokeWidth={1.5} fill="none" strokeLinecap="round"
      />
    </Svg>
  );
}

function SleepGlyph({ size, color }: { size: number; color: string }) {
  const s = size * 0.7;
  const cx = s / 2;
  const cy = s / 2;
  const r = s / 2 - 1;
  const eyeY = cy - r * 0.1;
  const eyeR = r * 0.1;
  const eyeOff = r * 0.28;
  return (
    <Svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={1.5} fill="none" />
      {/* closed eyes — horizontal lines */}
      <Line x1={cx - eyeOff - eyeR} y1={eyeY} x2={cx - eyeOff + eyeR} y2={eyeY}
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={cx + eyeOff - eyeR} y1={eyeY} x2={cx + eyeOff + eyeR} y2={eyeY}
        stroke={color} strokeWidth={1.5} strokeLinecap="round" />
      {/* Z in top-right */}
      <Text x={cx + r * 0.35} y={cy - r * 0.35} fill={color}
        fontSize={r * 0.38} fontWeight="700" textAnchor="middle">z</Text>
    </Svg>
  );
}

export function RateChip({ size, scale, payload, selected = false, selectColor }: RateChipProps) {
  const anim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: selected ? 1.08 : 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  }, [selected, anim]);

  const borderColor = selected
    ? (selectColor ?? darken(scale.bg, 0.2))
    : 'transparent';

  const glyphSize = size === 50 ? 28 : 22;

  return (
    <Animated.View style={{ transform: [{ scale: anim }] }}>
      <View style={[
        styles.chip,
        { width: size, height: size, backgroundColor: scale.bg, borderColor },
      ]}>
        {typeof payload === 'number' ? (
          <Text style={[styles.numeral, { color: scale.text, fontSize: size === 50 ? FontSize.body : FontSize.bodySmall }]}>
            {payload}
          </Text>
        ) : payload === 'mood' ? (
          <MoodGlyph size={glyphSize} color={scale.text} />
        ) : (
          <SleepGlyph size={glyphSize} color={scale.text} />
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: Radius.rateChip,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numeral: {
    fontWeight: FontWeight.bold,
    lineHeight: undefined,
  },
});
