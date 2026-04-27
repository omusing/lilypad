import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget } from '@/constants/theme';
import { getMedications } from '@/db/medications';
import { logDosesBatch, getLastDoseByMedication } from '@/db/doses';
import type { Medication } from '@/db/schema';
import { timeAgo } from '@/lib/time';
import { Toast } from '@/components/Toast';

// ─── Stepper ──────────────────────────────────────────────────────────────────

function Stepper({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  return (
    <View style={step.row}>
      <TouchableOpacity
        style={[step.btn, count === 0 && step.btnZero]}
        onPress={() => onChange(Math.max(0, count - 1))}
        hitSlop={8}
        activeOpacity={0.75}
      >
        <Text style={step.btnLabel}>−</Text>
      </TouchableOpacity>

      <Text style={step.count}>{count}</Text>

      <TouchableOpacity
        style={step.btn}
        onPress={() => onChange(count + 1)}
        hitSlop={8}
        activeOpacity={0.75}
      >
        <Text style={step.btnLabel}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const step = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  btn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.med,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnZero: {
    backgroundColor: Colors.border,
  },
  btnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: 20,
    color: '#fff',
    lineHeight: 24,
    fontWeight: '500',
  },
  count: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: Colors.text,
    minWidth: 24,
    textAlign: 'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogMedicationScreen() {
  const [medications, setMedications]   = useState<Medication[]>([]);
  const [lastDoseMap, setLastDoseMap]   = useState<Record<number, string>>({});
  // counts: medicationId → number of doses to log (0 = not selected)
  const [counts, setCounts]             = useState<Record<number, number>>({});
  const [note, setNote]                 = useState('');
  const [submitting, setSubmitting]     = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [loaded, setLoaded]             = useState(false);

  useFocusEffect(useCallback(() => {
    setCounts({});
    setNote('');
    setLoaded(false);
    (async () => {
      const [meds, doseMap] = await Promise.all([
        getMedications(false),
        getLastDoseByMedication(),
      ]);
      setMedications(meds);
      setLastDoseMap(doseMap);
      setLoaded(true);
    })();
  }, []));

  function setCount(medId: number, n: number) {
    setCounts(c => ({ ...c, [medId]: n }));
  }

  const totalDoses = Object.values(counts).reduce((sum, n) => sum + n, 0);
  const canLog = totalDoses > 0;

  async function handleLog() {
    if (!canLog || submitting) return;
    setSubmitting(true);
    try {
      const nonZero = Object.fromEntries(
        Object.entries(counts).filter(([, n]) => n > 0).map(([id, n]) => [Number(id), n])
      );
      await logDosesBatch(nonZero, note.trim() || undefined);
      setToastVisible(true);
      setTimeout(() => router.back(), 1700);
    } finally {
      setSubmitting(false);
    }
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      </SafeAreaView>
    );
  }

  // ── Empty state ──
  if (medications.length === 0) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Log Medication</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={styles.emptyWrap}>
          <Ionicons name="medical-outline" size={48} color={Colors.border} />
          <Text style={styles.emptyTitle}>No medications set up</Text>
          <Text style={styles.emptyBody}>
            Add your medications in the Medications tab first.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              router.back();
              router.push('/(tabs)/medications' as never);
            }}
          >
            <Text style={styles.emptyBtnLabel}>Go to Medications</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* Header — close button top-left */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={Colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.title}>Log Medication</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section label */}
          <Text style={styles.sectionLabel}>Use + to set how many doses you took</Text>

          {/* Medication list with steppers */}
          <View style={styles.medList}>
            {medications.map((med, i) => {
              const count  = counts[med.id] ?? 0;
              const lastAt = lastDoseMap[med.id];
              const isLast = i === medications.length - 1;
              const active = count > 0;
              return (
                <View
                  key={med.id}
                  style={[
                    styles.medRow,
                    active && styles.medRowActive,
                    !isLast && styles.medRowBorder,
                  ]}
                >
                  <View style={styles.medInfo}>
                    <Text style={[styles.medName, active && styles.medNameActive]}>
                      {med.name}
                    </Text>
                    {(med.dose || med.route) ? (
                      <Text style={styles.medMeta}>
                        {[med.dose, med.route].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    {lastAt ? (
                      <Text style={styles.medLastDose}>Last dose {timeAgo(lastAt)}</Text>
                    ) : null}
                  </View>
                  <Stepper count={count} onChange={n => setCount(med.id, n)} />
                </View>
              );
            })}
          </View>

          {/* Note */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>
            Note <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TextInput
            style={styles.noteInput}
            placeholder="e.g. with food, felt nauseous..."
            placeholderTextColor={Colors.textSecondary}
            value={note}
            onChangeText={setNote}
            multiline
            returnKeyType="done"
            blurOnSubmit
          />
        </ScrollView>

        {/* Submit */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.logBtn, !canLog && styles.logBtnDisabled]}
            onPress={handleLog}
            disabled={!canLog || submitting}
            activeOpacity={0.85}
          >
            <Ionicons name="medical" size={20} color="#fff" />
            <Text style={styles.logBtnLabel}>
              {submitting ? 'Logging...' : 'Log Doses'}
            </Text>
          </TouchableOpacity>
        </View>

        <Toast visible={toastVisible} message="Doses logged" />
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.medLight,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSpacer: {
    width: 44,
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  sectionLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  optional: {
    fontWeight: '400',
    color: Colors.textSecondary,
  },

  // Medication list
  medList: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.card,
  },
  medRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    minHeight: TouchTarget.min,
    gap: Spacing.sm,
  },
  medRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  medRowActive: {
    backgroundColor: Colors.medLight,
  },
  medInfo: {
    flex: 1,
    gap: 2,
  },
  medName: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  medNameActive: {
    color: Colors.med,
    fontWeight: '600',
  },
  medMeta: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },
  medLastDose: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Note
  noteInput: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    minHeight: 80,
    textAlignVertical: 'top',
    ...Shadow.card,
  },

  // Footer
  footer: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  logBtn: {
    height: TouchTarget.primary,
    backgroundColor: Colors.med,
    borderRadius: Radius.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logBtnDisabled: {
    opacity: 0.4,
  },
  logBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    fontWeight: '600',
    color: '#fff',
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
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.body * 1.5,
  },
  emptyBtn: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    backgroundColor: Colors.med,
    borderRadius: Radius.button,
  },
  emptyBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#fff',
  },
});
