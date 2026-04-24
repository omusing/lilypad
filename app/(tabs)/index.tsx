import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Dimensions, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Circle, Line, Defs, LinearGradient, Stop, Polygon } from 'react-native-svg';

import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget } from '@/constants/theme';
import { getSettings } from '@/db/settings';
import { getRecentEntries } from '@/db/entries';
import { getLastDoseByMedication } from '@/db/doses';
import { getMedications } from '@/db/medications';
import { timeAgo, formatEntryDate } from '@/lib/time';
import type { Entry } from '@/db/schema';
import type { Medication } from '@/db/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SparkDay {
  date:  string;       // YYYY-MM-DD
  avg:   number | null; // null = no entries that day
}

interface HomeData {
  patientName:   string | null;
  lastEntry:     Entry | null;
  lastMedName:   string | null;
  lastDoseAt:    string | null;
  spark:         SparkDay[];
}

// ─── Data loading ─────────────────────────────────────────────────────────────

async function loadHomeData(): Promise<HomeData> {
  const DAYS = 14;

  const [settings, recentEntries, medications, lastDoseMap] = await Promise.all([
    getSettings(),
    getRecentEntries(DAYS),
    getMedications(true),
    getLastDoseByMedication(),
  ]);

  // Build sparkline: one slot per day for last 14 days
  const today = new Date();
  const spark: SparkDay[] = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i));
    return { date: d.toISOString().slice(0, 10), avg: null };
  });

  // Group entries by entry_date, compute daily average pain
  const byDate: Record<string, number[]> = {};
  for (const e of recentEntries) {
    (byDate[e.entry_date] ??= []).push(e.pain_level);
  }
  for (const day of spark) {
    const vals = byDate[day.date];
    if (vals?.length) day.avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  // Most recent entry overall
  const lastEntry = recentEntries.length > 0
    ? [...recentEntries].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : null;

  // Most recent dose across all medications
  let lastMedName: string | null = null;
  let lastDoseAt:  string | null = null;
  let latestDoseTime = '';
  for (const [medId, takenAt] of Object.entries(lastDoseMap)) {
    if (takenAt > latestDoseTime) {
      latestDoseTime = takenAt;
      lastDoseAt = takenAt;
      const med = medications.find(m => m.id === Number(medId));
      lastMedName = med?.name ?? null;
    }
  }

  return {
    patientName: settings.patient_name,
    lastEntry,
    lastMedName,
    lastDoseAt,
    spark,
  };
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

const SPARK_H = 72;
const SPARK_PAD = { top: 8, bottom: 8, left: 4, right: 4 };

function Sparkline({ data }: { data: SparkDay[] }) {
  const width = Dimensions.get('window').width - 48 - 32; // screen - screen padding - card padding
  const chartW = width - SPARK_PAD.left - SPARK_PAD.right;
  const chartH = SPARK_H - SPARK_PAD.top - SPARK_PAD.bottom;
  const n = data.length;
  const step = chartW / (n - 1);

  function xFor(i: number) { return SPARK_PAD.left + i * step; }
  function yFor(v: number) { return SPARK_PAD.top + chartH - (v / 10) * chartH; }

  // Split into continuous segments (break on null days)
  const segments: { x: number; y: number }[][] = [];
  let current: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const v = data[i].avg;
    if (v !== null) {
      current.push({ x: xFor(i), y: yFor(v) });
    } else {
      if (current.length > 0) { segments.push(current); current = []; }
    }
  }
  if (current.length > 0) segments.push(current);

  // Build fill polygon for each segment (line + baseline)
  function fillPoints(seg: { x: number; y: number }[]): string {
    const top = seg.map(p => `${p.x},${p.y}`).join(' ');
    const base = `${seg[seg.length - 1].x},${SPARK_PAD.top + chartH} ${seg[0].x},${SPARK_PAD.top + chartH}`;
    return `${top} ${base}`;
  }

  return (
    <Svg width={width} height={SPARK_H}>
      <Defs>
        <LinearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0"   stopColor={Colors.pain} stopOpacity="0.18" />
          <Stop offset="1"   stopColor={Colors.pain} stopOpacity="0" />
        </LinearGradient>
      </Defs>

      {/* Subtle midline */}
      <Line
        x1={SPARK_PAD.left} y1={SPARK_PAD.top + chartH / 2}
        x2={SPARK_PAD.left + chartW} y2={SPARK_PAD.top + chartH / 2}
        stroke={Colors.border} strokeWidth="1"
      />

      {/* Fill + line per segment */}
      {segments.map((seg, si) => (
        <Polygon
          key={`fill-${si}`}
          points={fillPoints(seg)}
          fill="url(#sparkFill)"
        />
      ))}
      {segments.map((seg, si) => (
        <Polyline
          key={`line-${si}`}
          points={seg.map(p => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={Colors.pain}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}

      {/* Data point dots */}
      {data.map((d, i) =>
        d.avg !== null ? (
          <Circle key={i} cx={xFor(i)} cy={yFor(d.avg)} r="3" fill={Colors.pain} />
        ) : (
          <Circle key={i} cx={xFor(i)} cy={SPARK_PAD.top + chartH - 4} r="2" fill={Colors.border} />
        )
      )}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const [data, setData]       = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      setData(await loadHomeData());
    } catch (e) {
      console.error('HomeScreen load error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  // Reload whenever the tab comes back into focus (after logging)
  useFocusEffect(useCallback(() => { refresh(); }, []));

  const greeting = data?.patientName ? `Hello, ${data.patientName}` : 'Hello';

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={styles.greetingBlock}>
            <Text style={styles.greeting} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {greeting}
            </Text>
            <Text style={styles.dateLabel}>{formatEntryDate(new Date().toISOString())}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => router.push('/settings' as never)}
            hitSlop={12}
          >
            <Ionicons name="settings-outline" size={20} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ── Primary actions ── */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.painBtn]}
            onPress={() => router.push('/log-pain' as never)}
            activeOpacity={0.85}
          >
            <Ionicons name="pulse" size={28} color="#fff" />
            <Text style={styles.actionLabel}>Log Pain</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, styles.medBtn]}
            onPress={() => router.push('/log-medication' as never)}
            activeOpacity={0.85}
          >
            <Ionicons name="medical" size={28} color="#fff" />
            <Text style={styles.actionLabel}>Log Medication</Text>
          </TouchableOpacity>
        </View>

        {/* ── Recent activity ── */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Recent Activity</Text>

          {loading ? (
            <ActivityIndicator color={Colors.textSecondary} style={{ paddingVertical: 12 }} />
          ) : (
            <>
              <View style={styles.activityRow}>
                <View style={[styles.dot, { backgroundColor: Colors.pain }]} />
                <Text style={styles.activityText}>Last pain log</Text>
                <Text style={styles.activityTime}>
                  {data?.lastEntry ? timeAgo(data.lastEntry.created_at) : 'None yet'}
                </Text>
              </View>
              <View style={[styles.activityRow, styles.activityRowBorder]}>
                <View style={[styles.dot, { backgroundColor: Colors.med }]} />
                <Text style={styles.activityText} numberOfLines={1}>
                  {data?.lastMedName ?? 'Medication'}
                </Text>
                <Text style={styles.activityTime}>
                  {data?.lastDoseAt ? timeAgo(data.lastDoseAt) : 'None yet'}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* ── Sparkline ── */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => router.push('/(tabs)/timeline' as never)}
          activeOpacity={0.85}
        >
          <Text style={styles.cardLabel}>14-day pain trend</Text>
          {loading || !data ? (
            <ActivityIndicator color={Colors.textSecondary} style={{ paddingVertical: 20 }} />
          ) : (
            <>
              <Sparkline data={data.spark} />
              <View style={styles.sparkLabels}>
                <Text style={styles.sparkLabel}>14 days ago</Text>
                <Text style={styles.sparkLabel}>Today</Text>
              </View>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  greetingBlock: {
    flex: 1,
    marginRight: Spacing.md,
  },
  greeting: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.greeting,
    color: Colors.text,
    letterSpacing: -0.5,
    lineHeight: FontSize.greeting * 1.15,
  },
  dateLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    ...Shadow.card,
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    height: 100,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  painBtn: { backgroundColor: Colors.pain },
  medBtn:  { backgroundColor: Colors.med },
  actionLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#fff',
  },

  // Cards
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Shadow.card,
  },
  cardLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },

  // Activity rows
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    minHeight: TouchTarget.min,
  },
  activityRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityText: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  activityTime: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },

  // Sparkline labels
  sparkLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sparkLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
});
