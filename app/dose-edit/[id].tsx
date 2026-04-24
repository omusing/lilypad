import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget } from '@/constants/theme';
import { getMedications, getMedication } from '@/db/medications';
import { getDose, updateDose, deleteDose } from '@/db/doses';
import type { Dose, Medication } from '@/db/schema';

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
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  btn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.med,
    alignItems: 'center', justifyContent: 'center',
  },
  btnZero: { backgroundColor: Colors.border },
  btnLabel: {
    fontFamily: FontFamily.sans, fontSize: 20,
    color: '#fff', lineHeight: 24, fontWeight: '500',
  },
  count: {
    fontFamily: FontFamily.sans, fontSize: FontSize.body,
    fontWeight: '600', color: Colors.text,
    minWidth: 24, textAlign: 'center',
  },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DoseEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const doseId = Number(id);

  const [dose, setDose]           = useState<Dose | null>(null);
  const [medications, setMeds]    = useState<Medication[]>([]);
  const [quantity, setQuantity]   = useState(1);
  const [note, setNote]           = useState('');
  const [takenAt, setTakenAt]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    (async () => {
      const d = await getDose(doseId);
      if (!d) { router.back(); return; }

      setDose(d);
      setQuantity(d.quantity);
      setNote(d.note ?? '');
      setTakenAt(new Date(d.taken_at).toLocaleString('en-US', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false,
      }));

      // Union: active medications + this dose's medication (even if archived).
      const [activeMeds, thisMed] = await Promise.all([
        getMedications(false),
        getMedication(d.medication_id),
      ]);

      const union = [...activeMeds];
      if (thisMed && !activeMeds.some(m => m.id === thisMed.id)) {
        union.unshift(thisMed);
      }
      setMeds(union);
      setLoading(false);
    })();
  }, [doseId]);

  async function handleSave() {
    if (saving || quantity < 1) return;
    setSaving(true);
    try {
      await updateDose(doseId, {
        quantity,
        note: note.trim() || null,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      'Delete Dose',
      'Delete this dose record? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDose(doseId);
            router.back();
          },
        },
      ]
    );
  }

  if (loading || !dose) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      </SafeAreaView>
    );
  }

  const thisMed = medications.find(m => m.id === dose.medication_id);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Edit Dose</Text>
          <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Medication name (read-only display) */}
          <Text style={styles.sectionLabel}>Medication</Text>
          <View style={styles.infoCard}>
            <Text style={styles.medName}>{thisMed?.name ?? `Medication #${dose.medication_id}`}</Text>
            {thisMed?.dose || thisMed?.route ? (
              <Text style={styles.medMeta}>
                {[thisMed.dose, thisMed.route].filter(Boolean).join(' · ')}
              </Text>
            ) : null}
            {thisMed && !thisMed.is_active ? (
              <Text style={styles.archivedBadge}>Archived</Text>
            ) : null}
          </View>

          {/* Quantity */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Quantity</Text>
          <View style={[styles.infoCard, styles.quantityRow]}>
            <Text style={styles.quantityLabel}>
              {quantity} {quantity === 1 ? 'dose' : 'doses'}
              {thisMed?.dose ? ` of ${thisMed.dose}` : ''}
            </Text>
            <Stepper count={quantity} onChange={setQuantity} />
          </View>

          {/* Time logged (informational) */}
          <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Time logged</Text>
          <View style={styles.infoCard}>
            <Text style={styles.timeText}>{takenAt}</Text>
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

          {/* Delete */}
          <TouchableOpacity style={styles.deleteBtn} onPress={confirmDelete}>
            <Ionicons name="trash-outline" size={18} color={Colors.pain} />
            <Text style={styles.deleteBtnLabel}>Delete this dose</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Save footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveBtn, quantity < 1 && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={quantity < 1 || saving}
            activeOpacity={0.85}
          >
            <Text style={styles.saveBtnLabel}>{saving ? 'Saving...' : 'Save Changes'}</Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: 'center', justifyContent: 'center',
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

  infoCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: 4,
    ...Shadow.card,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  medName: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '600',
  },
  medMeta: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },
  archivedBadge: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  quantityLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  timeText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
  },

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

  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  deleteBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.pain,
    fontWeight: '500',
  },

  footer: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  saveBtn: {
    height: TouchTarget.primary,
    backgroundColor: Colors.med,
    borderRadius: Radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    fontWeight: '600',
    color: '#fff',
  },
});
