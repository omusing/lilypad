import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, PainScale,
} from '@/constants/theme';
import { getEntries, deleteEntry } from '@/db/entries';
import { getAllDosesWithMedication } from '@/db/doses';
import { REGIONS } from '@/constants/regions';
import type { Entry } from '@/db/schema';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DoseEvent {
  id:            number;
  medication_id: number;
  taken_at:      string;
  quantity:      number;
  note:          string | null;
  med_name:      string;
  med_dose:      string | null;
}

// One "day" bucket: keyed by YYYY-MM-DD, contains pain entries and dose events.
interface DayBucket {
  date:    string;     // YYYY-MM-DD
  entries: Entry[];    // pain entries for this date (by entry_date)
  doses:   DoseEvent[]; // medication doses for this date (by taken_at date)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDividerDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }).toUpperCase();
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function regionLabels(keys: string[]): string {
  if (keys.length === 0) return '';
  const labels = keys.map(k => REGIONS.find(r => r.key === k)?.label ?? k);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function isoToDate(iso: string): string {
  return iso.slice(0, 10);
}

function buildDayBuckets(entries: Entry[], doses: DoseEvent[]): DayBucket[] {
  const map = new Map<string, DayBucket>();

  function getOrCreate(date: string): DayBucket {
    if (!map.has(date)) map.set(date, { date, entries: [], doses: [] });
    return map.get(date)!;
  }

  for (const e of entries)  getOrCreate(e.entry_date).entries.push(e);
  for (const d of doses)    getOrCreate(isoToDate(d.taken_at)).doses.push(d);

  return Array.from(map.values())
    .sort((a, b) => b.date.localeCompare(a.date)) // newest first
    .map(bucket => ({
      ...bucket,
      entries: bucket.entries.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      doses:   bucket.doses.sort((a, b) => b.taken_at.localeCompare(a.taken_at)),
    }));
}

// ─── Pain card (left column) ──────────────────────────────────────────────────

function PainCard({ entry, onDelete }: { entry: Entry; onDelete: (id: number) => void }) {
  const scale   = PainScale[entry.pain_level];
  const regions = regionLabels(entry.pain_regions);

  function confirmDelete() {
    Alert.alert(
      'Delete Entry',
      'Delete this pain log? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(entry.id) },
      ]
    );
  }

  return (
    <TouchableOpacity
      style={[styles.painCard, { borderRightColor: scale.bg, borderRightWidth: 4 }]}
      onPress={() => router.push(`/entry/${entry.id}` as never)}
      onLongPress={confirmDelete}
      activeOpacity={0.75}
    >
      <View style={styles.cardTopRow}>
        <View style={[styles.painBadge, { backgroundColor: scale.bg }]}>
          <Text style={[styles.painNum, { color: scale.text }]}>{entry.pain_level}</Text>
        </View>
        <Text style={styles.timeText}>{formatTime(entry.created_at)}</Text>
      </View>
      {regions ? (
        <Text style={styles.regionsText} numberOfLines={2}>{regions}</Text>
      ) : null}
      {entry.note ? (
        <Text style={styles.noteExcerpt} numberOfLines={1}>{entry.note}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Medication card (right column) ──────────────────────────────────────────

function MedCard({ dose }: { dose: DoseEvent }) {
  const doseLabel = dose.med_dose
    ? `${dose.quantity}× ${dose.med_dose}`
    : dose.quantity > 1 ? `${dose.quantity}×` : null;

  return (
    <TouchableOpacity
      style={styles.medCard}
      onPress={() => router.push(`/dose-edit/${dose.id}` as never)}
      activeOpacity={0.75}
    >
      <Text style={styles.medName} numberOfLines={1}>{dose.med_name}</Text>
      {doseLabel ? (
        <Text style={styles.medDose} numberOfLines={1}>{doseLabel}</Text>
      ) : null}
      <Text style={styles.timeText}>{formatTime(dose.taken_at)}</Text>
    </TouchableOpacity>
  );
}

// ─── Day row ──────────────────────────────────────────────────────────────────

function DayRow({ bucket, onDeleteEntry }: { bucket: DayBucket; onDeleteEntry: (id: number) => void }) {
  const maxRows = Math.max(bucket.entries.length, bucket.doses.length);

  return (
    <View style={styles.dayBlock}>
      {/* Date divider */}
      <View style={styles.dividerRow}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{formatDividerDate(bucket.date)}</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Two-column event area */}
      {maxRows > 0 && (
        <View style={styles.columns}>
          {/* Left: pain entries */}
          <View style={styles.col}>
            {bucket.entries.map(e => (
              <PainCard key={e.id} entry={e} onDelete={onDeleteEntry} />
            ))}
          </View>

          {/* Vertical rule */}
          <View style={styles.vertRule} />

          {/* Right: medication doses */}
          <View style={styles.col}>
            {bucket.doses.map(d => (
              <MedCard key={d.id} dose={d} />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TimelineScreen() {
  const [buckets, setBuckets] = useState<DayBucket[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [entries, doses] = await Promise.all([
      getEntries(),
      getAllDosesWithMedication(),
    ]);
    setBuckets(buildDayBuckets(entries, doses));
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function handleDeleteEntry(id: number) {
    await deleteEntry(id);
    load();
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Timeline</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      ) : buckets.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptyBody}>
            Use the Log Pain or Log Medication buttons on the Home screen to get started.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {buckets.map(b => (
            <DayRow key={b.date} bucket={b} onDeleteEntry={handleDeleteEntry} />
          ))}
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  heading: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },

  listContent: {
    paddingBottom: Spacing.xl,
  },

  // Day block
  dayBlock: {
    marginBottom: Spacing.md,
  },

  // Date divider: ─────── APRIL 17 ───────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.divider,
  },
  dividerText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },

  // Two-column layout
  columns: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: 0,
  },
  col: {
    flex: 1,
    gap: Spacing.xs,
  },
  vertRule: {
    width: 1,
    backgroundColor: Colors.divider,
    marginHorizontal: Spacing.xs,
    alignSelf: 'stretch',
  },

  // Pain card (left column)
  painCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    gap: 4,
    ...Shadow.card,
    // right border added inline per pain level
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  painBadge: {
    width: 34,
    height: 34,
    borderRadius: Radius.badge,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painNum: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '700',
  },
  regionsText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.text,
    fontWeight: '500',
  },
  noteExcerpt: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Medication card (right column)
  medCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.sm,
    gap: 2,
    borderLeftWidth: 4,
    borderLeftColor: Colors.med,
    ...Shadow.card,
  },
  medName: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.text,
    fontWeight: '600',
  },
  medDose: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.med,
  },

  timeText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },

  // Empty state
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
