import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow,
  PainScale, MoodScale, SleepScale, TouchTarget,
} from '@/constants/theme';
import { getEntry, updateEntry, deleteEntry } from '@/db/entries';
import { QUALITIES } from '@/constants/qualities';
import { TRIGGERS } from '@/constants/triggers';
import type { Entry } from '@/db/schema';
import BodyMap from '@/components/BodyMap';
import { RateChip } from '@/components/RateChip';

// ─── ChipGroup ────────────────────────────────────────────────────────────────

function ChipGroup({
  title, items, value, onChange,
}: {
  title: string;
  items: readonly { key: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
}) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  }
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.chipGrid}>
        {items.map(item => {
          const on = value.includes(item.key);
          return (
            <TouchableOpacity
              key={item.key}
              style={[s.chip, on && s.chipOn]}
              onPress={() => toggle(item.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipLabel, on && s.chipLabelOn]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── RateChipScale ────────────────────────────────────────────────────────────

function RateChipScale({
  title, scale, type, value, onChange,
}: {
  title: string;
  scale: readonly ({ bg: string; text: string; label: string } | null)[];
  type: 'mood' | 'sleep';
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={s.sectionLabel}>{title}</Text>
      <View style={s.rateRow}>
        {[1, 2, 3, 4, 5].map(v => {
          const entry = scale[v];
          if (!entry) return null;
          return (
            <TouchableOpacity
              key={v}
              style={s.rateBtn}
              onPress={() => onChange(v)}
              activeOpacity={0.75}
              accessibilityLabel={entry.label}
            >
              <RateChip size={50} scale={entry} payload={type} selected={value === v} />
              <Text style={s.rateLabel}>{entry.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function EntryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();

  const [entry, setEntry]             = useState<Entry | null>(null);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);

  // Edit state — mirrors the fields from log-pain wizard
  const [entryDate, setEntryDate]     = useState(new Date());
  const [painLevel, setPainLevel]     = useState<number | null>(null);
  const [regions, setRegions]         = useState<string[]>([]);
  const [qualities, setQualities]     = useState<string[]>([]);
  const [triggers, setTriggers]       = useState<string[]>([]);
  const [mood, setMood]               = useState<number | null>(null);
  const [sleep, setSleep]             = useState<number | null>(null);
  const [note, setNote]               = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const e = await getEntry(Number(id));
      setEntry(e);
      if (e) {
        setEntryDate(new Date(e.entry_date + 'T12:00:00'));
        setPainLevel(e.pain_level);
        setRegions(e.pain_regions);
        setQualities(e.pain_qualities);
        setTriggers(e.triggers);
        setMood(e.mood);
        setSleep(e.sleep_quality);
        setNote(e.note ?? '');
      }
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

  async function handleSave() {
    if (!entry || painLevel === null || regions.length === 0) return;
    setSaving(true);
    try {
      await updateEntry(entry.id, {
        entry_date:     entryDate.toISOString().slice(0, 10),
        pain_level:     painLevel,
        pain_regions:   regions,
        pain_qualities: qualities,
        triggers:       triggers,
        mood:           mood,
        sleep_quality:  sleep,
        note:           note.trim() || null,
      });
      router.back();
    } catch {
      Alert.alert('Couldn\'t save', 'Please try again.');
    } finally {
      setSaving(false);
    }
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
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>Entry not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  const mapWidth = width - Spacing.lg * 2;
  const canSave  = painLevel !== null && regions.length > 0 && !saving;

  const dateLabel = entryDate.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Entry</Text>
          <TouchableOpacity onPress={handleDelete} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={20} color={Colors.pain} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date */}
          <View style={{ marginBottom: Spacing.md }}>
            <Text style={s.sectionLabel}>Date</Text>
            <TouchableOpacity
              style={styles.datePill}
              onPress={() => setShowDatePicker(v => !v)}
              activeOpacity={0.75}
            >
              <Ionicons name="calendar-outline" size={16} color={Colors.text} />
              <Text style={styles.datePillLabel}>{dateLabel}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={entryDate}
                mode="date"
                display="inline"
                maximumDate={new Date()}
                onChange={(_e, d) => {
                  setShowDatePicker(false);
                  if (d) setEntryDate(d);
                }}
              />
            )}
          </View>

          {/* Pain score */}
          <Text style={s.sectionLabel}>Pain score</Text>
          <View style={styles.painList}>
            {Array.from({ length: 11 }, (_, i) => {
              const selected = painLevel === i;
              const sc = PainScale[i];
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.painRow, selected && styles.painRowSelected]}
                  onPress={() => setPainLevel(i)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.painBadge, { backgroundColor: sc.bg }]}>
                    <Text style={[styles.painNum, { color: sc.text }]}>{i}</Text>
                  </View>
                  <Text style={[styles.painRowLabel, selected && { fontWeight: '600' }]}>
                    {sc.label}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={18} color={Colors.pain} />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Body regions */}
          <View style={{ marginTop: Spacing.lg, marginBottom: Spacing.md }}>
            <Text style={s.sectionLabel}>Body regions</Text>
            <BodyMap selected={regions} onChange={setRegions} displayWidth={mapWidth} />
          </View>

          {/* Qualities + Triggers */}
          <ChipGroup title="Pain qualities" items={QUALITIES} value={qualities} onChange={setQualities} />
          <ChipGroup title="Triggers" items={TRIGGERS} value={triggers} onChange={setTriggers} />

          {/* Mood + Sleep */}
          <RateChipScale title="Mood" scale={MoodScale} type="mood" value={mood} onChange={setMood} />
          <RateChipScale title="Sleep quality" scale={SleepScale} type="sleep" value={sleep} onChange={setSleep} />

          {/* Note */}
          <Text style={s.sectionLabel}>Note for your provider</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Anything your provider should know..."
            placeholderTextColor={Colors.textFaint}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnLabel}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Shared section label + chip styles ──────────────────────────────────────

const s = StyleSheet.create({
  sectionLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: Radius.chip, backgroundColor: Colors.card,
    borderWidth: 1.5, borderColor: Colors.border,
  },
  chipOn: { backgroundColor: Colors.painLight, borderColor: Colors.pain },
  chipLabel: { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.text },
  chipLabelOn: { color: Colors.pain, fontWeight: '600' },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  rateBtn: { alignItems: 'center', gap: 4, flex: 1 },
  rateLabel: { fontFamily: FontFamily.sans, fontSize: FontSize.label, fontWeight: '600', color: Colors.text, textAlign: 'center' },
});

// ─── Screen styles ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.card,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    ...Shadow.cardSoft,
  },
  datePillLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '500',
    color: Colors.text,
  },

  painList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  painRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    height: TouchTarget.min,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  painRowSelected: { backgroundColor: Colors.painLight },
  painBadge: {
    width: 34, height: 34,
    borderRadius: Radius.rateChip,
    alignItems: 'center', justifyContent: 'center',
  },
  painNum: { fontFamily: FontFamily.sans, fontSize: 15, fontWeight: '700' },
  painRowLabel: { flex: 1, fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text },

  noteInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: Colors.border,
    textAlignVertical: 'top',
    marginTop: Spacing.sm,
  },

  footer: { padding: Spacing.lg, paddingTop: Spacing.sm },
  saveBtn: {
    height: 54,
    borderRadius: Radius.button,
    backgroundColor: Colors.pain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    fontWeight: '600',
    color: '#fff',
  },

  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
});
