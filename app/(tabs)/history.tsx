import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, SectionList,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget, PainScale,
} from '@/constants/theme';
import { getEntries } from '@/db/entries';
import { REGIONS } from '@/constants/regions';
import type { Entry } from '@/db/schema';
import { timeAgo } from '@/lib/time';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSectionDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // noon avoids DST edge
  const today     = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (dateStr === today.toISOString().slice(0, 10))     return 'Today';
  if (dateStr === yesterday.toISOString().slice(0, 10)) return 'Yesterday';

  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function regionLabels(keys: string[]): string {
  if (keys.length === 0) return '';
  const labels = keys.map(k => REGIONS.find(r => r.key === k)?.label ?? k);
  if (labels.length <= 2) return labels.join(', ');
  return `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

// ─── Entry row ────────────────────────────────────────────────────────────────

function EntryRow({ entry }: { entry: Entry }) {
  const scale  = PainScale[entry.pain_level];
  const regions = regionLabels(entry.pain_regions);
  const moodLabel  = entry.mood        ? ['😞','😕','😐','🙂','😊'][entry.mood - 1]  : null;
  const sleepLabel = entry.sleep_quality ? ['😩','😟','😐','😌','😊'][entry.sleep_quality - 1] : null;

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onPress={() => router.push(`/entry/${entry.id}` as never)}
      activeOpacity={0.75}
    >
      {/* Pain badge */}
      <View style={[styles.painBadge, { backgroundColor: scale.bg }]}>
        <Text style={[styles.painNumber, { color: scale.text }]}>{entry.pain_level}</Text>
      </View>

      {/* Main content */}
      <View style={styles.entryContent}>
        <View style={styles.entryTopRow}>
          <Text style={styles.regionsText} numberOfLines={1}>{regions || 'No regions'}</Text>
          <Text style={styles.timeText}>{timeAgo(entry.created_at)}</Text>
        </View>

        {/* Badges row */}
        <View style={styles.badgesRow}>
          {entry.pain_qualities.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{entry.pain_qualities[0]}</Text>
            </View>
          )}
          {moodLabel && (
            <Text style={styles.emojiChip}>{moodLabel}</Text>
          )}
          {sleepLabel && (
            <Text style={styles.emojiChip}>{sleepLabel}</Text>
          )}
          {entry.note ? (
            <View style={styles.badge}>
              <Ionicons name="document-text-outline" size={11} color={Colors.textSecondary} />
            </View>
          ) : null}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={Colors.border} />
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

interface Section {
  title: string;
  data:  Entry[];
}

function groupByDate(entries: Entry[]): Section[] {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const key = e.entry_date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a)) // most recent date first
    .map(([date, data]) => ({
      title: formatSectionDate(date),
      data:  data.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    }));
}

export default function HistoryScreen() {
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading]   = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const entries = await getEntries();
      setSections(groupByDate(entries));
      setLoading(false);
    })();
  }, []));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>History</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      ) : sections.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="time-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No entries yet</Text>
          <Text style={styles.emptyBody}>
            Log your first pain entry and it will appear here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => <EntryRow entry={item} />}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
        />
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
    marginBottom: Spacing.xs,
  },
  heading: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },

  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  sectionHeader: {
    backgroundColor: Colors.bg,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    minHeight: TouchTarget.min,
    ...Shadow.card,
  },

  painBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.rateChip,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  painNumber: {
    fontFamily: FontFamily.sans,
    fontSize: 20,
    fontWeight: '600',
  },

  entryContent: {
    flex: 1,
    gap: 4,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  regionsText: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  timeText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    flexShrink: 0,
  },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.bg,
    borderRadius: Radius.rateChip,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  badgeText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
  },
  emojiChip: {
    fontSize: 14,
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
