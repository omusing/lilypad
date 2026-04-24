import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget } from '@/constants/theme';
import {
  resetDatabase, seedClientA, seedJerry, seedMicky, seedDonny,
} from '@/db/seed';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionKey = 'reset' | 'intro' | 'clientA' | 'jerry' | 'micky' | 'donny';

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DevToolsScreen() {
  const [running, setRunning] = useState<ActionKey | null>(null);

  async function run(key: ActionKey, fn: () => Promise<void>, onDone?: () => void) {
    setRunning(key);
    try {
      await fn();
      onDone?.();
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setRunning(null);
    }
  }

  function confirmReset() {
    Alert.alert(
      'Reset all data',
      'This will permanently delete all entries, medications, and doses and take you back to onboarding. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset', style: 'destructive',
          onPress: () => run('reset', resetDatabase, () => router.replace('/onboarding' as never)),
        },
      ]
    );
  }

  function confirmSeed(key: ActionKey, name: string, fn: () => Promise<void>) {
    Alert.alert(
      `Load ${name}`,
      'This will replace all existing data with the seed dataset.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load', style: 'destructive',
          onPress: () => run(key, fn, () => router.replace('/(tabs)' as never)),
        },
      ]
    );
  }

  function btn(
    key: ActionKey,
    label: string,
    sub: string,
    icon: keyof typeof Ionicons.glyphMap,
    color: string,
    onPress: () => void,
  ) {
    const active = running === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.row, { opacity: running && !active ? 0.4 : 1 }]}
        onPress={onPress}
        disabled={running !== null}
        activeOpacity={0.7}
      >
        <View style={[styles.iconWrap, { backgroundColor: color + '22' }]}>
          {active
            ? <ActivityIndicator size="small" color={color} />
            : <Ionicons name={icon} size={20} color={color} />
          }
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          <Text style={styles.rowSub}>{sub}</Text>
        </View>
        <Ionicons name="chevron-forward" size={14} color={Colors.border} />
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Developer Tools</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.warning}>
          DEV BUILD ONLY — these actions are destructive and cannot be undone.
        </Text>

        {/* App state */}
        <Text style={styles.sectionLabel}>App state</Text>
        <View style={styles.card}>
          {btn('reset', 'Reset all data', 'Clears DB and returns to onboarding', 'trash-outline', Colors.pain, confirmReset)}
          <View style={styles.divider} />
          {btn('intro', 'Back to intro', 'Go to onboarding without clearing data', 'refresh-outline', Colors.textSecondary,
            () => router.replace('/onboarding' as never)
          )}
        </View>

        {/* Personas */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Load persona</Text>
        <Text style={styles.sectionHint}>Replaces all data. App navigates to Home on completion.</Text>
        <View style={styles.card}>
          {btn('clientA', 'Client A', '30 days · head pain 3–6 · Ibuprofen', 'person-outline', Colors.textSecondary,
            () => confirmSeed('clientA', 'Client A', seedClientA)
          )}
          <View style={styles.divider} />
          {btn('jerry', 'Jerry', '30 days · mild daily pain · Naproxen', 'sunny-outline', Colors.med,
            () => confirmSeed('jerry', 'Jerry', seedJerry)
          )}
          <View style={styles.divider} />
          {btn('micky', 'Micky', 'Irregular · high-variance · 5 meds', 'thunderstorm-outline', Colors.pain,
            () => confirmSeed('micky', 'Micky', seedMicky)
          )}
          <View style={styles.divider} />
          {btn('donny', 'Donny', 'Med-focused · minimal pain logs · 3 drugs AM/PM', 'medical-outline', Colors.brand,
            () => confirmSeed('donny', 'Donny', seedDonny)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:   { fontFamily: FontFamily.sans, fontSize: FontSize.sectionHeading, color: Colors.text },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
    ...Shadow.card,
  },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.sm },
  warning: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.pain,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  sectionHint: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.card,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: TouchTarget.min,
    gap: Spacing.md,
  },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  rowSub: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 36 + Spacing.md },
});
