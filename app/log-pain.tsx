import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, Animated, KeyboardAvoidingView, Platform,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, TouchTarget, PainScale, MoodScale, SleepScale } from '@/constants/theme';
import { QUALITIES } from '@/constants/qualities';
import { TRIGGERS } from '@/constants/triggers';
import { insertEntry, getLatestEntry } from '@/db/entries';
import BodyMap from '@/components/BodyMap';

// ─── Wizard state ─────────────────────────────────────────────────────────────

interface WizardData {
  pain_level:     number | null;
  pain_regions:   string[];
  pain_qualities: string[];
  triggers:       string[];
  mood:           number | null;
  sleep_quality:  number | null;
  note:           string;
}

const EMPTY: WizardData = {
  pain_level: null, pain_regions: [], pain_qualities: [],
  triggers: [], mood: null, sleep_quality: null, note: '',
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
  track: { flex: 1, height: 4, backgroundColor: Colors.painDeep, borderRadius: 2, overflow: 'hidden', opacity: 0.3 },
  fill:  { height: '100%', backgroundColor: Colors.pain, borderRadius: 2 },
  label: { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary, width: 36, textAlign: 'right' },
});

// ─── Step 1 — Pain score ──────────────────────────────────────────────────────

function StepPainScore({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <>
      <Text style={s.heading}>How is your pain right now?</Text>
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
                {scale.label}
              </Text>
              {selected && <Ionicons name="checkmark" size={18} color={Colors.pain} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

// ─── Step 2 — Body map ────────────────────────────────────────────────────────

function StepRegions({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { width } = useWindowDimensions();
  const mapWidth = width - Spacing.lg * 2;
  return (
    <>
      <Text style={s.heading}>Where is your pain?</Text>
      <BodyMap selected={value} onChange={onChange} displayWidth={mapWidth} />
    </>
  );
}

// ─── Step 3 — Quality + Triggers ─────────────────────────────────────────────

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
      <ChipGroup title="Pain qualities" items={QUALITIES} value={qualities} onChange={onQualitiesChange} />
      <ChipGroup title="Triggers" items={TRIGGERS} value={triggers} onChange={onTriggersChange} />
    </>
  );
}

// ─── Step 4 — Mood, sleep, note + exit actions ───────────────────────────────

function BadgeScale({
  title,
  scale,
  value,
  onChange,
}: {
  title: string;
  scale: readonly ({ bg: string; text: string; label: string } | null)[];
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <View style={{ marginBottom: Spacing.xl }}>
      <Text style={s.sectionTitle}>{title}</Text>
      <View style={s.badgeRow}>
        {[1, 2, 3, 4, 5].map(v => {
          const entry = scale[v];
          if (!entry) return null;
          const on = value === v;
          return (
            <TouchableOpacity
              key={v}
              style={[s.badgeBtn, on && { borderColor: Colors.med, borderWidth: 3 }]}
              onPress={() => onChange(v)}
              activeOpacity={0.75}
              accessibilityLabel={entry.label}
            >
              <View style={[s.badge, { backgroundColor: entry.bg }]}>
                <Text style={[s.badgeNum, { color: entry.text }]}>{v}</Text>
              </View>
              <Text style={s.badgeLabel}>{entry.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepMoodSleep({
  mood, sleep, note,
  onMoodChange, onSleepChange, onNoteChange,
}: {
  mood: number | null; sleep: number | null; note: string;
  onMoodChange: (v: number) => void;
  onSleepChange: (v: number) => void;
  onNoteChange: (v: string) => void;
}) {
  return (
    <>
      <Text style={s.heading}>How are you feeling overall?</Text>
      <BadgeScale title="Mood" scale={MoodScale} value={mood} onChange={onMoodChange} />
      <BadgeScale title="Sleep quality" scale={SleepScale} value={sleep} onChange={onSleepChange} />

      <Text style={s.sectionTitle}>Note for your provider</Text>
      <TextInput
        style={s.noteInput}
        placeholder="Anything your provider should know…"
        placeholderTextColor={Colors.textFaint}
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
      <Ionicons name="checkmark-circle" size={18} color={Colors.toastText} />
      <Text style={toast.text}>Pain log saved</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.toastBg, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24,
  },
  text: { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.toastText, fontWeight: '600' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

export default function LogPainScreen() {
  const [step, setStep]                     = useState(1);
  const [data, setData]                     = useState<WizardData>(EMPTY);
  const [submitting, setSubmitting]         = useState(false);
  const [toastVisible, setToastVisible]     = useState(false);
  // Tracks whether the user has made any explicit input — pre-loaded defaults don't count.
  const [userTouched, setUserTouched]       = useState(false);

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
    setUserTouched(true);
    setData(d => ({ ...d, [key]: val }));
  }

  function handleCancel() {
    if (userTouched && isDirty(data)) {
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

  async function saveEntry(): Promise<boolean> {
    if (submitting) return false;
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
        medication_ids: [],
        note:           data.note.trim() || null,
      });
      return true;
    } catch (e) {
      console.error(e);
      Alert.alert('Couldn\'t save', 'Please try again.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSavePainLog() {
    const ok = await saveEntry();
    if (!ok) return;
    setToastVisible(true);
    setTimeout(() => router.back(), 1600);
  }

  async function handleSaveAndLogMedication() {
    const ok = await saveEntry();
    if (!ok) return;
    router.replace('/log-medication' as never);
  }

  function handleNext() {
    if (step < TOTAL_STEPS) setStep(s => s + 1);
  }

  const isLastStep = step === TOTAL_STEPS;
  const disabled   = nextDisabled() || submitting;

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
              mood={data.mood} sleep={data.sleep_quality} note={data.note}
              onMoodChange={v => patch('mood', v)}
              onSleepChange={v => patch('sleep_quality', v)}
              onNoteChange={v => patch('note', v)}
            />
          )}
        </ScrollView>

        {/* Footer */}
        <View style={s.footer}>
          {isLastStep ? (
            <>
              <TouchableOpacity
                style={[s.primaryBtn, submitting && s.btnDisabled]}
                onPress={handleSavePainLog}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={s.primaryBtnLabel}>
                  {submitting ? 'Saving…' : 'Save Pain Log'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.secondaryBtn, submitting && s.btnDisabled]}
                onPress={handleSaveAndLogMedication}
                disabled={submitting}
                activeOpacity={0.85}
              >
                <Text style={s.secondaryBtnLabel}>Save and Log Medication</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, disabled && s.btnDisabled]}
              onPress={handleNext}
              disabled={disabled}
              activeOpacity={0.85}
            >
              <Text style={s.primaryBtnLabel}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

      </KeyboardAvoidingView>

      {toastVisible && <Toast visible={toastVisible} />}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.painLight },
  header:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.md },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  content:   { padding: Spacing.lg, paddingBottom: Spacing.xl },

  heading:      { fontFamily: FontFamily.sans, fontSize: FontSize.sectionHeading, fontWeight: '700', color: Colors.text, marginBottom: Spacing.md },
  sectionTitle: { fontFamily: FontFamily.sans, fontSize: FontSize.label, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },

  // Pain score list
  painList:          { backgroundColor: Colors.card, borderRadius: Radius.card, overflow: 'hidden' },
  painRow:           { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, height: TouchTarget.min, borderBottomWidth: 1, borderBottomColor: Colors.border },
  painRowSelected:   { backgroundColor: Colors.painLight },
  painBadge:         { width: 34, height: 34, borderRadius: Radius.badge, alignItems: 'center', justifyContent: 'center' },
  painBadgeNum:      { fontFamily: FontFamily.sans, fontSize: 15, fontWeight: '700' },
  painRowLabel:      { flex: 1, fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text },
  painRowLabelSelected: { fontWeight: '600' },

  // Chip grid (step 3)
  chipGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip:         { paddingHorizontal: 16, paddingVertical: 10, borderRadius: Radius.chip, backgroundColor: Colors.card, borderWidth: 1.5, borderColor: Colors.border },
  chipOn:       { backgroundColor: Colors.painLight, borderColor: Colors.pain },
  chipLabel:    { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.text },
  chipLabelOn:  { color: Colors.pain, fontWeight: '600' },

  // Badge scale (step 4 — mood + sleep)
  badgeRow:    { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  badgeBtn:    { alignItems: 'center', gap: 4, flex: 1, borderRadius: Radius.badge, padding: 4 },
  badge:       { width: 50, height: 50, borderRadius: Radius.badge, alignItems: 'center', justifyContent: 'center' },
  badgeNum:    { fontFamily: FontFamily.sans, fontSize: FontSize.body, fontWeight: '700' },
  badgeLabel:  { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary, textAlign: 'center' },

  // Note
  noteInput: {
    backgroundColor: Colors.card, borderRadius: Radius.card,
    padding: Spacing.md, fontFamily: FontFamily.sans, fontSize: FontSize.body,
    color: Colors.text, minHeight: 100, borderWidth: 1.5,
    borderColor: Colors.border, textAlignVertical: 'top',
    marginTop: Spacing.sm,
  },

  // Footer
  footer:           { padding: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
  primaryBtn:       { height: 54, borderRadius: Radius.button, backgroundColor: Colors.pain, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnLabel:  { fontFamily: FontFamily.sans, fontSize: FontSize.bodyLarge, fontWeight: '600', color: '#fff' },
  secondaryBtn:     { height: 46, borderRadius: Radius.button, borderWidth: 2, borderColor: Colors.med, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnLabel:{ fontFamily: FontFamily.sans, fontSize: FontSize.body, fontWeight: '600', color: Colors.med },
  btnDisabled:      { opacity: 0.4 },
});
