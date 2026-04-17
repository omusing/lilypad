import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, PainScale,
} from '@/constants/theme';
import { getEntry, deleteEntry } from '@/db/entries';
import { getMedications } from '@/db/medications';
import { REGIONS } from '@/constants/regions';
import { QUALITIES } from '@/constants/qualities';
import { TRIGGERS } from '@/constants/triggers';
import type { Entry, Medication } from '@/db/schema';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function labelFor(keys: string[], map: { key: string; label: string }[]): string[] {
  return keys.map(k => map.find(m => m.key === k)?.label ?? k);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

const MOOD_LABELS  = ['Very low', 'Low', 'Neutral', 'Good', 'Great'];
const SLEEP_LABELS = ['Very poor', 'Poor', 'Fair', 'Good', 'Great'];
const MOOD_EMOJI   = ['😞', '😕', '😐', '🙂', '😊'];
const SLEEP_EMOJI  = ['😩', '😟', '😐', '😌', '😊'];

// ─── Detail row ───────────────────────────────────────────────────────────────

function DetailSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={detail.wrap}>
      <Text style={detail.label}>{label}</Text>
      {children}
    </View>
  );
}

function ChipList({ items }: { items: string[] }) {
  if (items.length === 0) return <Text style={detail.none}>—</Text>;
  return (
    <View style={detail.chips}>
      {items.map(item => (
        <View key={item} style={detail.chip}>
          <Text style={detail.chipText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const detail = StyleSheet.create({
  wrap:     { gap: 6 },
  label:    { fontFamily: FontFamily.sans, fontSize: FontSize.label, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase' },
  none:     { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.textSecondary },
  chips:    { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip:     { backgroundColor: Colors.bg, borderRadius: Radius.chip, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.text },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry]           = useState<Entry | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading]       = useState(true);

  useFocusEffect(useCallback(() => {
    (async () => {
      const [e, meds] = await Promise.all([
        getEntry(Number(id)),
        getMedications(true),
      ]);
      setEntry(e);
      setMedications(meds);
      setLoading(false);
    })();
  }, [id]));

  function handleDelete() {
    if (!entry) return;
    Alert.alert(
      'Delete Entry',
      'This entry will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            router.back();
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      </SafeAreaView>
    );
  }

  if (!entry) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Entry not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scale         = PainScale[entry.pain_level];
  const regionLabels  = labelFor(entry.pain_regions,   [...REGIONS]);
  const qualityLabels = labelFor(entry.pain_qualities,  [...QUALITIES]);
  const triggerLabels = labelFor(entry.triggers,        [...TRIGGERS]);
  const medNames      = entry.medication_ids.map(mid =>
    medications.find(m => m.id === mid)?.name ?? `Medication #${mid}`
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pain Entry</Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={12} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={20} color={Colors.pain} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: pain score */}
        <View style={styles.heroCard}>
          <View style={[styles.painBadge, { backgroundColor: scale.bg }]}>
            <Text style={[styles.painNumber, { color: scale.text }]}>{entry.pain_level}</Text>
            <Text style={[styles.painOf10, { color: scale.text }]}>/ 10</Text>
          </View>
          <View style={styles.heroMeta}>
            <Text style={styles.heroDate}>{formatDateTime(entry.created_at)}</Text>
            {entry.updated_at && (
              <Text style={styles.heroEdited}>Edited</Text>
            )}
          </View>
        </View>

        {/* Details card */}
        <View style={styles.detailCard}>
          <DetailSection label="Regions">
            <ChipList items={regionLabels} />
          </DetailSection>

          <View style={styles.divider} />

          <DetailSection label="Qualities">
            <ChipList items={qualityLabels} />
          </DetailSection>

          <View style={styles.divider} />

          <DetailSection label="Triggers">
            <ChipList items={triggerLabels} />
          </DetailSection>
        </View>

        {/* Mood + Sleep */}
        {(entry.mood !== null || entry.sleep_quality !== null) && (
          <View style={styles.detailCard}>
            {entry.mood !== null && (
              <DetailSection label="Mood">
                <Text style={styles.emojiRow}>
                  {MOOD_EMOJI[entry.mood - 1]} {MOOD_LABELS[entry.mood - 1]}
                </Text>
              </DetailSection>
            )}
            {entry.mood !== null && entry.sleep_quality !== null && (
              <View style={styles.divider} />
            )}
            {entry.sleep_quality !== null && (
              <DetailSection label="Sleep">
                <Text style={styles.emojiRow}>
                  {SLEEP_EMOJI[entry.sleep_quality - 1]} {SLEEP_LABELS[entry.sleep_quality - 1]}
                </Text>
              </DetailSection>
            )}
          </View>
        )}

        {/* Medications */}
        {medNames.length > 0 && (
          <View style={styles.detailCard}>
            <DetailSection label="Medications taken">
              <ChipList items={medNames} />
            </DetailSection>
          </View>
        )}

        {/* Note */}
        {entry.note ? (
          <View style={styles.detailCard}>
            <DetailSection label="Note">
              <Text style={styles.noteText}>{entry.note}</Text>
            </DetailSection>
          </View>
        ) : null}
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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.body + 1,
    color: Colors.text,
    fontWeight: '600',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.painLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  // Hero
  heroCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    ...Shadow.card,
  },
  painBadge: {
    width: 72,
    height: 72,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  painNumber: {
    fontFamily: FontFamily.serif,
    fontSize: 32,
    fontWeight: '600',
    lineHeight: 36,
  },
  painOf10: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
  },
  heroMeta: {
    flex: 1,
    gap: 4,
  },
  heroDate: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  heroEdited: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },

  // Detail card
  detailCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    gap: Spacing.md,
    ...Shadow.card,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  emojiRow: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
  },
  noteText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    lineHeight: FontSize.body * 1.6,
  },

  // Empty / not found
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
});
