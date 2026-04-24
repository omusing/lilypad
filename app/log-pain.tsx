import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, TouchTarget, PainScale } from '@/constants/theme';
import { REGIONS } from '@/constants/regions';
import { QUALITIES } from '@/constants/qualities';
import { TRIGGERS } from '@/constants/triggers';
import { getMedications } from '@/db/medications';
import { insertEntry, getLatestEntry } from '@/db/entries';
import { logDoseNow } from '@/db/doses';
import type { Medication } from '@/db/schema';

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardData {
  pain_level:     number | null;
  pain_regions:   string[];
  pain_qualities: string[];
  triggers:       string[];
  mood:           number | null;
  sleep_quality:  number | null;
  medication_ids: number[];
  note:           string;
}

const EMPTY: WizardData = {
  pain_level: null, pain_regions: [], pain_qualities: [],
  triggers: [], mood: null, sleep_quality: null,
  medication_ids: [], note: '',
};

function isDirty(d: WizardData): boolean {
  return d.pain_level !== null || d.pain_regions.length > 0;
}

// ─── Shared chrome ────────────────────────────────────────────────────────────

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={prog.row}>
      <View style={prog.track}>
        <View style={[prog.fill, { width: `${(step / total) * 100}%` as `${number}%` }]} />
      </View>
      <Text style={prog.label}>{step} of {total}</Text>
    </View>
  );
}

const prog = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg },
  track: { flex: 1, height: 4, backgroundColor: Colors.border, borderRadius: 2, overflow: 'hidden' },
  fill:  { height: '100%', backgroundColor: Colors.brand, borderRadius: 2 },
  label: { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary, width: 36, textAlign: 'right' },
});

// ─── Step 1 — Pain score ──────────────────────────────────────────────────────

const PAIN_LABELS = [
  'No pain',
  'Very mild, barely noticeable',
  'Mild, can be ignored',
  'Noticeable, distracting',
  'Moderate, hard to ignore',
  'Moderate, affects daily tasks',
  'Severe, limits concentration',
  'Very severe, limits activity',
  'Intense, barely functional',
  'Excruciating',
  'Worst imaginable',
];

function StepPainScore({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <>
      <Text style={s.heading}>How is your pain right now?</Text>
      <Text style={s.sub}>0 = no pain · 10 = worst imaginable</Text>
      <View style={s.painList}>
        {Array.from({ length: 11 }, (_, i) => {
          const selected = value === i;
          const scale = PainScale[i];
          return (
            <TouchableOpacity
              key={i}
              style={[s.painRow, selected && s.painRowSelected]}
              onPress={() => onChange(i)}
              activeOpacity={0.7}
            >
              <View style={[s.painBadge, { backgroundColor: scale.bg }]}>
                <Text style={[s.painBadgeNum, { color: scale.text }]}>{i}</Text>
              </View>
              <Text style={[s.painRowLabel, selected && s.painRowLabelSelected]}>
                {PAIN_LABELS[i]}
              </Text>
              {selected && <Ionicons name="checkmark" size={18} color={Colors.pain} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// ─── Step 2 — Regions ────────────────────────────────────────────────────────

function StepRegions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key]);
  }
  return (
    <>
      <Text style={s.heading}>Where is your pain?</Text>
      <Text style={s.sub}>Select all that apply (at least one required)</Text>
      <View style={s.chipGrid}>
        {REGIONS.map(r => {
          const on = value.includes(r.key);
          return (
            <TouchableOpacity
              key={r.key}
              style={[s.chip, on && s.chipOn]}
              onPress={() => toggle(r.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.chipLabel, on && s.chipLabelOn]}>{r.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// ─── Step 3 — Qualities + Triggers ───────────────────────────────────────────

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
    <View style={{ marginBottom: Spacing.lg }}>
      <Text style={s.sectionTitle}>{title}</Text>
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

function StepQualitiesTriggers({
  qualities, triggers, onQualitiesChange, onTriggersChange,
}: {
  qualities: string[]; triggers: string[];
  onQualitiesChange: (v: string[]) => void;
  onTriggersChange: (v: string[]) => void;
}) {
  return (
    <>
      <Text style={s.heading}>Describe your pain</Text>
      <Text style={s.sub}>Both sections are optional</Text>
      <ChipGroup title="Pain qualities" items={QUALITIES} value={qualities} onChange={onQualitiesChange} />
      <ChipGroup title="Triggers" items={TRIGGERS} value={triggers} onChange={onTriggersChange} />
    </>
  );
}

// ─── Step 4 — Mood + Sleep ────────────────────────────────────────────────────

const MOOD_EMOJI  = ['😞','😕','😐','🙂','😊'];
const MOOD_LABEL  = ['Terrible','Not great','Okay','Pretty good','Great'];
const SLEEP_EMOJI = ['😩','😟','😐','😌','😊'];
const SLEEP_LABEL = ['Very poor','Poor','Fair','Good','Great'];

function EmojiScale({
  title, emojis, labels, value, onChange,
}: {
  title: string; emojis: string[]; labels: string[];
  value: number | null; onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.emojiRow}>
        {emojis.map((emoji, i) => {
          const v = i + 1;
          const on = value === v;
          return (
            <TouchableOpacity
              key={v}
              style={[s.emojiBtn, on && s.emojiBtnOn]}
              onPress={() => onChange(v)}
              activeOpacity={0.75}
            >
              <Text style={s.emojiChar}>{emoji}</Text>
              <Text style={[s.emojiNum, on && s.emojiNumOn]}>{v}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {value !== null && (
        <Text style={s.emojiSelectedLabel}>{labels[value - 1]}</Text>
      )}
    </View>
  );
}

function StepMoodSleep({
  mood, sleep, onMoodChange, onSleepChange,
}: {
  mood: number | null; sleep: number | null;
  onMoodChange: (v: number) => void; onSleepChange: (v: number) => void;
}) {
  return (
    <>
      <Text style={s.heading}>How are you feeling overall?</Text>
      <Text style={s.sub}>Both are optional</Text>
      <EmojiScale title="Mood" emojis={MOOD_EMOJI} labels={MOOD_LABEL} value={mood} onChange={onMoodChange} />
      <EmojiScale title="Sleep quality" emojis={SLEEP_EMOJI} labels={SLEEP_LABEL} value={sleep} onChange={onSleepChange} />
    </>
  );
}

// ─── Step 5 — Medications + Note ─────────────────────────────────────────────

function StepMedsNote({
  medicationIds, note, onMedsChange, onNoteChange,
}: {
  medicationIds: number[]; note: string;
  onMedsChange: (v: number[]) => void; onNoteChange: (v: string) => void;
}) {
  const [meds, setMeds] = useState<Medication[]>([]);

  useEffect(() => {
    getMedications().then(setMeds).catch(console.error);
  }, []);

  function toggleMed(id: number) {
    onMedsChange(
      medicationIds.includes(id) ? medicationIds.filter(m => m !== id) : [...medicationIds, id]
    );
  }

  return (
    <>
      <Text style={s.heading}>Medications and notes</Text>

      <Text style={s.sectionTitle}>Medications taken</Text>
      <Text style={s.sub}>Quick reference only — optional</Text>

      {meds.length === 0 ? (
        <Text style={s.emptyMeds}>No medications added yet.</Text>
      ) : (
        <View style={s.medList}>
          {meds.map(med => {
            const on = medicationIds.includes(med.id);
            return (
              <TouchableOpacity
                key={med.id}
                style={[s.medRow, on && s.medRowOn]}
                onPress={() => toggleMed(med.id)}
                activeOpacity={0.75}
              >
                <View style={[s.checkbox, on && s.checkboxOn]}>
                  {on && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.medName}>{med.name}</Text>
                  {med.dose ? <Text style={s.medDose}>{med.dose}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[s.sectionTitle, { marginTop: Spacing.lg }]}>Note for your provider</Text>
      <TextInput
        style={s.noteInput}
        placeholder="Anything your provider should know..."
        placeholderTextColor={Colors.textSecondary}
        value={note}
        onChangeText={onNoteChange}
        multiline
        numberOfLines={4}
        textAlignVertical="top"
      />
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1200),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [visible]);

  return (
    <Animated.View style={[toast.wrap, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={toast.text}>Pain log saved</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.med, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4,
  },
  text: { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: '#fff', fontWeight: '600' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5;

export default function LogPainScreen() {
  const [step, setStep]         = useState(1);
  const [data, setData]         = useState<WizardData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    getLatestEntry().then(entry => {
      if (!entry) return;
      setData(d => ({
        ...d,
        pain_regions:   entry.pain_regions,
        pain_qualities: entry.pain_qualities,
        triggers:       entry.triggers,
      }));
    }).catch(console.error);
  }, []);

  function patch<K extends keyof WizardData>(key: K, val: WizardData[K]) {
    setData(d => ({ ...d, [key]: val }));
  }

  function handleCancel() {
    if (isDirty(data)) {
      Alert.alert('Discard this pain log?', '', [
        { text: 'Keep Editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  }

  function handleBack() {
    if (step === 1) handleCancel();
    else setStep(s => s - 1);
  }

  function nextDisabled(): boolean {
    if (step === 1) return data.pain_level === null;
    if (step === 2) return data.pain_regions.length === 0;
    return false;
  }

  async function handleNext() {
    if (step < TOTAL_STEPS) { setStep(s => s + 1); return; }
    // Step 5 — submit
    setSubmitting(true);
    try {
      await insertEntry({
        entry_date:     new Date().toISOString().slice(0, 10),
        pain_level:     data.pain_level!,
        pain_regions:   data.pain_regions,
        pain_qualities: data.pain_qualities,
        triggers:       data.triggers,
        mood:           data.mood,
        sleep_quality:  data.sleep_quality,
        medication_ids: data.medication_ids,
        note:           data.note.trim() || null,
      });
      // Best-effort dose log — failures are silent; pain entry is already saved.
      if (data.medication_ids.length > 0) {
        await Promise.allSettled(data.medication_ids.map(id => logDoseNow(id)));
      }
      setToastVisible(true);
      setTimeout(() => router.back(), 1600);
    } catch (e) {
      console.error(e);
      Alert.alert('Something went wrong', 'Could not save your pain log. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const nextLabel = step === TOTAL_STEPS ? 'Save Pain Log' : 'Next';
  const disabled  = nextDisabled() || submitting;

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleBack} hitSlop={12} style={s.headerBtn}>
            <Ionicons name={step === 1 ? 'close' : 'arrow-back'} size={24} color={Colors.text} />
          </TouchableOpacity>
          <ProgressBar step={step} total={TOTAL_STEPS} />
        </View>

        {/* Step content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 && (
            <StepPainScore value={data.pain_level} onChange={v => patch('pain_level', v)} />
          )}
          {step === 2 && (
            <StepRegions value={data.pain_regions} onChange={v => patch('pain_regions', v)} />
          )}
          {step === 3 && (
            <StepQualitiesTriggers
              qualities={data.pain_qualities} triggers={data.triggers}
              onQualitiesChange={v => patch('pain_qualities', v)}
              onTriggersChange={v => patch('triggers', v)}
            />
          )}
          {step === 4 && (
            <StepMoodSleep
              mood={data.mood} sleep={data.sleep_quality}
              onMoodChange={v => patch('mood', v)}
              onSleepChange={v => patch('sleep_quality', v)}
            />
          )}
          {step === 5 && (
            <StepMedsNote
              medicationIds={data.medication_ids} note={data.note}
              onMedsChange={v => patch('medication_ids', v)}
              onNoteChange={v => patch('note', v)}
            />
          )}
        </ScrollView>

        {/* Footer nav */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.nextBtn, disabled && s.nextBtnDisabled]}
            onPress={handleNext}
            disabled={disabled}
            activeOpacity={0.85}
          >
            <Text style={s.nextLabel}>{submitting ? 'Saving…' : nextLabel}</Text>
            {!submitting && step < TOTAL_STEPS && (
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {toastVisible && <Toast visible={toastVisible} />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.bg },
  header:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xl },

  heading: { fontFamily: FontFamily.sans, fontSize: FontSize.sectionHeading, fontWeight: '600', color: Colors.text, letterSpacing: -0.3, marginBottom: 6 },
  sub:     { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.textSecondary, marginBottom: Spacing.lg },
  sectionTitle: { fontFamily: FontFamily.sans, fontSize: FontSize.label, fontWeight: '600', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },

  // Pain score list
  painList:     { backgroundColor: Colors.card, borderRadius: Radius.card, overflow: 'hidden', ...require('@/constants/theme').Shadow.card },
  painRow:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, height: TouchTarget.min, borderBottomWidth: 1, borderBottomColor: Colors.border },
  painRowSelected: { backgroundColor: Colors.painLight },
  painBadge:    { width: 34, height: 34, borderRadius: Radius.badge, alignItems: 'center', justifyContent: 'center' },
  painBadgeNum: { fontFamily: FontFamily.sans, fontSize: 15, fontWeight: '700' },
  painRowLabel: { flex: 1, fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text },
  painRowLabelSelected: { fontWeight: '600' },

  // Chip grid
  chipGrid:  { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:      { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.chip, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  chipOn:    { backgroundColor: Colors.painLight, borderColor: Colors.pain },
  chipLabel: { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.text },
  chipLabelOn: { color: Colors.pain, fontWeight: '600' },

  // Emoji scale
  emojiRow:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  emojiBtn:  { alignItems: 'center', gap: 4, padding: 8, borderRadius: 12, flex: 1 },
  emojiBtnOn: { backgroundColor: Colors.card },
  emojiChar: { fontSize: 32 },
  emojiNum:  { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary },
  emojiNumOn: { color: Colors.text, fontWeight: '600' },
  emojiSelectedLabel: { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.textSecondary, textAlign: 'center', marginTop: 8 },

  // Meds
  emptyMeds: { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.textSecondary, marginBottom: Spacing.md },
  medList:   { backgroundColor: Colors.card, borderRadius: Radius.card, overflow: 'hidden', marginBottom: Spacing.md },
  medRow:    { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, height: TouchTarget.min, borderBottomWidth: 1, borderBottomColor: Colors.border },
  medRowOn:  { backgroundColor: Colors.medLight },
  checkbox:  { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: Colors.med, borderColor: Colors.med },
  medName:   { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text },
  medDose:   { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary },

  // Note
  noteInput: { backgroundColor: Colors.card, borderRadius: Radius.card, padding: Spacing.md, fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text, minHeight: 100, borderWidth: 1.5, borderColor: Colors.border },

  // Footer
  footer:  { padding: Spacing.lg, paddingTop: Spacing.sm },
  nextBtn: { height: TouchTarget.primary, borderRadius: Radius.button, backgroundColor: Colors.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  nextBtnDisabled: { opacity: 0.4 },
  nextLabel: { fontFamily: FontFamily.sans, fontSize: FontSize.bodyLarge, fontWeight: '600', color: '#fff' },
});
