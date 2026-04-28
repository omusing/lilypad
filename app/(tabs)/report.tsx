import React, { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, Dimensions,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, PainScale,
} from '@/constants/theme';
import { getEntriesInRange } from '@/db/entries';
import { getDoseCountsInRange } from '@/db/doses';
import { getMedications } from '@/db/medications';
import { REGIONS } from '@/constants/regions';
import { exportPdf } from '@/lib/pdf';
import type { Entry } from '@/db/schema';

const REPORT_DAYS = 30;

// ─── Data crunching ───────────────────────────────────────────────────────────

interface ReportData {
  entries:       Entry[];
  avgPain:       number | null;
  highPainDays:  number;
  totalEntries:  number;
  regionCounts:  { key: string; label: string; count: number }[];
  weeklyAvgs:    { week: string; avg: number | null }[];
  medDoseCounts: { name: string; count: number }[];
}

function weeksAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().slice(0, 10);
}

async function loadReport(): Promise<ReportData> {
  const today    = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - (REPORT_DAYS - 1) * 86_400_000).toISOString().slice(0, 10);

  const [entries, meds, doseCounts] = await Promise.all([
    getEntriesInRange(fromDate, today),
    getMedications(false),
    getDoseCountsInRange(fromDate + 'T00:00:00.000Z', today + 'T23:59:59.999Z'),
  ]);

  const allLevels = entries.map(e => e.pain_level);
  const avgPain = allLevels.length
    ? Math.round((allLevels.reduce((a, b) => a + b, 0) / allLevels.length) * 10) / 10
    : null;

  const byDate: Record<string, number[]> = {};
  for (const e of entries) {
    (byDate[e.entry_date] ??= []).push(e.pain_level);
  }
  const highPainDays = Object.values(byDate).filter(
    vals => vals.reduce((a, b) => a + b, 0) / vals.length >= 7
  ).length;

  const regionMap: Record<string, number> = {};
  for (const e of entries) {
    for (const r of e.pain_regions) {
      regionMap[r] = (regionMap[r] ?? 0) + 1;
    }
  }
  const regionCounts = REGIONS
    .map(r => ({ key: r.key, label: r.label, count: regionMap[r.key] ?? 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const weeklyAvgs = [3, 2, 1, 0].map(weeksBack => {
    const start = weeksAgo(weeksBack + 1);
    const end   = weeksAgo(weeksBack);
    const vals  = entries
      .filter(e => e.entry_date >= start && e.entry_date <= end)
      .map(e => e.pain_level);
    return {
      week: `W${4 - weeksBack}`,
      avg:  vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
    };
  });

  const medDoseCounts = meds
    .map(m => ({ name: m.name, count: doseCounts[m.id] ?? 0 }))
    .filter(m => m.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    entries,
    avgPain,
    highPainDays,
    totalEntries: entries.length,
    regionCounts,
    weeklyAvgs,
    medDoseCounts,
  };
}

// ─── Bar chart ────────────────────────────────────────────────────────────────

function WeeklyBars({ data }: { data: { week: string; avg: number | null }[] }) {
  const width  = Dimensions.get('window').width - 48 - 32;
  const height = 80;
  const barW   = Math.floor((width - 32) / data.length) - 8;

  return (
    <Svg width={width} height={height + 24}>
      {data.map((d, i) => {
        const x     = 16 + i * ((width - 32) / data.length);
        const pct   = d.avg !== null ? d.avg / 10 : 0;
        const bh    = Math.max(pct * height, d.avg !== null ? 4 : 0);
        const by    = height - bh;
        const level = d.avg !== null ? Math.round(d.avg) : 0;
        const color = d.avg !== null ? PainScale[level].bg : Colors.border;

        return (
          <React.Fragment key={d.week}>
            <Rect x={x} y={by} width={barW} height={bh} rx="4" fill={color} />
            <SvgText
              x={x + barW / 2} y={height + 16}
              textAnchor="middle"
              fontSize={11}
              fontFamily={FontFamily.sans}
              fill={Colors.textSecondary}
            >
              {d.week}
            </SvgText>
            {d.avg !== null && (
              <SvgText
                x={x + barW / 2} y={by - 4}
                textAnchor="middle"
                fontSize={10}
                fontFamily={FontFamily.sans}
                fill={Colors.textSecondary}
              >
                {d.avg}
              </SvgText>
            )}
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ReportScreen() {
  const [report,    setReport]    = useState<ReportData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [exporting, setExporting] = useState(false);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadReport().then(r => { setReport(r); setLoading(false); });
  }, []));

  async function handleExport() {
    setExporting(true);
    try {
      await exportPdf(REPORT_DAYS);
    } catch (err) {
      Alert.alert('Export failed', 'Could not generate the PDF. Please try again.');
      console.error(err);
    } finally {
      setExporting(false);
    }
  }

  const canExport = !loading && !!report && report.totalEntries > 0 && !exporting;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.heading}>Report</Text>
          <Text style={styles.period}>Last 30 days</Text>
        </View>
        <TouchableOpacity
          style={[styles.exportBtn, !canExport && styles.exportBtnDisabled]}
          onPress={handleExport}
          disabled={!canExport}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={15} color="#fff" />
              <Text style={styles.exportLabel}>Export PDF</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading || !report ? (
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      ) : report.totalEntries === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyBody}>Log a few entries and your report will appear here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardFlex]}>
              <Text style={styles.statNumber}>
                {report.avgPain !== null ? report.avgPain : '-'}
              </Text>
              <Text style={styles.statLabel}>Avg pain</Text>
            </View>
            <View style={[styles.statCard, styles.statCardFlex]}>
              <Text style={styles.statNumber}>{report.totalEntries}</Text>
              <Text style={styles.statLabel}>Entries</Text>
            </View>
            <View style={[styles.statCard, styles.statCardFlex]}>
              <Text style={[styles.statNumber, report.highPainDays > 0 && styles.statHighPain]}>
                {report.highPainDays}
              </Text>
              <Text style={styles.statLabel}>High pain days</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Weekly average</Text>
            <WeeklyBars data={report.weeklyAvgs} />
          </View>

          {report.regionCounts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Top regions</Text>
              {report.regionCounts.slice(0, 5).map(r => (
                <View key={r.key} style={styles.barRow}>
                  <Text style={styles.barLabel}>{r.label}</Text>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { width: `${(r.count / report.regionCounts[0].count) * 100}%` as `${number}%` },
                      ]}
                    />
                  </View>
                  <Text style={styles.barCount}>{r.count}</Text>
                </View>
              ))}
            </View>
          )}

          {report.medDoseCounts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardLabel}>Medications</Text>
              {report.medDoseCounts.map(m => (
                <View key={m.name} style={styles.medDoseRow}>
                  <Text style={styles.medDoseName}>{m.name}</Text>
                  <Text style={styles.medDoseCount}>{m.count} dose{m.count !== 1 ? 's' : ''}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  heading: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
  period: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
    marginTop: 1,
  },

  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.med,
    borderRadius: 20,
    paddingVertical: 9,
    paddingHorizontal: 14,
    gap: 6,
    minWidth: 44,
    justifyContent: 'center',
  },
  exportBtnDisabled: {
    opacity: 0.45,
  },
  exportLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    fontWeight: '600',
    color: '#fff',
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadow.card,
  },
  statCardFlex: { flex: 1 },
  statNumber: {
    fontFamily: FontFamily.sans,
    fontSize: 28,
    color: Colors.text,
  },
  statHighPain: {
    color: Colors.pain,
  },
  statLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: 'center',
  },

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
    marginBottom: Spacing.md,
  },

  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  barLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.text,
    width: 88,
  },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: Colors.bg,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    backgroundColor: Colors.pain,
    borderRadius: 4,
  },
  barCount: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    width: 24,
    textAlign: 'right',
  },

  medDoseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  medDoseName: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  medDoseCount: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },

  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
  emptyBody: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.body * 1.5,
  },
});
