import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget } from '@/constants/theme';
import { getMedications } from '@/db/medications';
import { logDoseNow } from '@/db/doses';
import type { Medication } from '@/db/schema';
import { timeAgo } from '@/lib/time';
import { getLastDoseByMedication } from '@/db/doses';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View style={[toast.wrap, { opacity }]} pointerEvents="none">
      <Ionicons name="checkmark-circle" size={18} color="#fff" />
      <Text style={toast.text}>Dose logged</Text>
    </Animated.View>
  );
}

const toast = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.med, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 24,
  },
  text: { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: '#fff', fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function LogMedicationScreen() {
  const [medications, setMedications]     = useState<Medication[]>([]);
  const [lastDoseMap, setLastDoseMap]     = useState<Record<number, string>>({});
  const [selectedId, setSelectedId]       = useState<number | null>(null);
  const [note, setNote]                   = useState('');
  const [submitting, setSubmitting]       = useState(false);
  const [toastVisible, setToastVisible]   = useState(false);
  const [loaded, setLoaded]               = useState(false);

  useEffect(() => {
    (async () => {
      const [meds, doseMap] = await Promise.all([
        getMedications(false),
        getLastDoseByMedication(),
      ]);
      setMedications(meds);
      setLastDoseMap(doseMap);
      setLoaded(true);
    })();
  }, []);

  async function handleLog() {
    if (selectedId === null || submitting) return;
    setSubmitting(true);
    try {
      await logDoseNow(selectedId, note.trim() || undefined);
      setToastVisible(true);
      setTimeout(() => router.back(), 1700);
    } finally {
      setSubmitting(false);
    }
  }

  const canLog = selectedId !== null;

  // ── Empty state ──
  if (loaded && medications.length === 0) {
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Log Medication</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section label */}
          <Text style={styles.sectionLabel}>Which medication did you take?</Text>

          {/* Medication list */}
          <View style={styles.medList}>
            {medications.map((med, i) => {
              const selected = selectedId === med.id;
              const lastAt   = lastDoseMap[med.id];
              const isLast   = i === medications.length - 1;
              return (
                <TouchableOpacity
                  key={med.id}
                  style={[
                    styles.medRow,
                    selected && styles.medRowSelected,
                    !isLast && styles.medRowBorder,
                  ]}
                  onPress={() => setSelectedId(selected ? null : med.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.medInfo}>
                    <Text style={[styles.medName, selected && styles.medNameSelected]}>
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
                  <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                    {selected && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </View>
                </TouchableOpacity>
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
              {submitting ? 'Logging...' : 'Log Dose'}
            </Text>
          </TouchableOpacity>
        </View>

        <Toast visible={toastVisible} />
      </SafeAreaView>
    </KeyboardAvoidingView>
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
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
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

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },

  sectionLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  optional: {
    fontWeight: '400',
    textTransform: 'none',
    letterSpacing: 0,
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
  },
  medRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  medRowSelected: {
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
  medNameSelected: {
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.md,
  },
  checkboxSelected: {
    backgroundColor: Colors.med,
    borderColor: Colors.med,
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
    fontSize: FontSize.body,
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
    fontFamily: FontFamily.serif,
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
