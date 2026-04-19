import { useCallback, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  StyleSheet, Modal, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Fuse from 'fuse.js';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget,
} from '@/constants/theme';
import {
  getMedications, insertMedication, updateMedication,
  archiveMedication, unarchiveMedication,
} from '@/db/medications';
import { getTodayDoseCountByMedication, getLastDoseByMedication } from '@/db/doses';
import type { Medication } from '@/db/schema';
import { timeAgo } from '@/lib/time';
import { MEDICATION_CATALOG, type MedCatalogEntry } from '@/constants/medicationCatalog';

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormData {
  name:      string;
  dose:      string;
  route:     string;
  frequency: string;
}

const EMPTY_FORM: FormData = { name: '', dose: '', route: '', frequency: '' };

// ─── Add / Edit Sheet ─────────────────────────────────────────────────────────

interface SheetProps {
  visible:   boolean;
  editing:   Medication | null;
  onClose:   () => void;
  onSaved:   () => void;
}

function MedSheet({ visible, editing, onClose, onSaved }: SheetProps) {
  const [form, setForm]               = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving]           = useState(false);
  const [nameError, setNameError]     = useState(false);
  const [suggestions, setSuggestions] = useState<MedCatalogEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<MedCatalogEntry | null>(null);
  const fuseRef = useRef<Fuse<MedCatalogEntry> | null>(null);

  // Build Fuse index and reset state on modal open
  const handleOpen = useCallback(() => {
    setForm(
      editing
        ? { name: editing.name, dose: editing.dose ?? '', route: editing.route ?? '', frequency: editing.frequency ?? '' }
        : EMPTY_FORM
    );
    setNameError(false);
    setSuggestions([]);
    setSelectedEntry(null);
    fuseRef.current = new Fuse(MEDICATION_CATALOG, {
      keys: [
        { name: 'genericName', weight: 0.6 },
        { name: 'brandNames',  weight: 0.8 },
      ],
      threshold: 0.3,
    });
  }, [editing]);

  async function handleSave() {
    if (!form.name.trim()) { setNameError(true); return; }
    setSaving(true);
    try {
      const payload = {
        name:      form.name.trim(),
        dose:      form.dose.trim()      || null,
        route:     form.route.trim()     || null,
        frequency: form.frequency.trim() || null,
        catalog_rxcui: selectedEntry?.rxcui ?? null,
      };
      if (editing) {
        await updateMedication(editing.id, {
          name: payload.name, dose: payload.dose, route: payload.route, frequency: payload.frequency,
          ...(selectedEntry ? { catalog_rxcui: selectedEntry.rxcui } : {}),
        });
      } else {
        await insertMedication(payload);
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  function patch(key: keyof FormData) {
    return (val: string) => {
      setForm(f => ({ ...f, [key]: val }));
      if (key === 'name') {
        setNameError(false);
        if (selectedEntry) setSelectedEntry(null);
        setSuggestions(
          val.length >= 2 && fuseRef.current
            ? fuseRef.current.search(val).slice(0, 5).map(r => r.item)
            : []
        );
      }
    };
  }

  function selectCatalogEntry(entry: MedCatalogEntry) {
    const displayName = entry.brandNames[0] ?? entry.genericName;
    setForm(f => ({
      ...f,
      name:  displayName,
      dose:  entry.strengths[0] ?? f.dose,
      route: entry.routes[0]    ?? f.route,
    }));
    setSelectedEntry(entry);
    setSuggestions([]);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onShow={handleOpen}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SafeAreaView style={sheet.root} edges={['top', 'bottom']}>
          {/* Header */}
          <View style={sheet.header}>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Text style={sheet.cancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={sheet.title}>{editing ? 'Edit Medication' : 'Add Medication'}</Text>
            <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={saving}>
              <Text style={[sheet.save, saving && { opacity: 0.5 }]}>
                {saving ? 'Saving...' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={sheet.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {/* Name */}
            <Text style={sheet.label}>
              Medication name <Text style={sheet.required}>*</Text>
            </Text>
            <TextInput
              style={[sheet.input, nameError && sheet.inputError]}
              placeholder="e.g. Ibuprofen"
              placeholderTextColor={Colors.textSecondary}
              value={form.name}
              onChangeText={patch('name')}
              autoFocus
              returnKeyType="next"
            />
            {nameError && <Text style={sheet.errorText}>Name is required</Text>}

            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <View style={sheet.suggestions}>
                {suggestions.map(entry => (
                  <TouchableOpacity
                    key={entry.rxcui}
                    style={sheet.suggestionRow}
                    onPress={() => selectCatalogEntry(entry)}
                    activeOpacity={0.75}
                  >
                    <Text style={sheet.suggestionName}>
                      {entry.brandNames[0] ?? entry.genericName}
                    </Text>
                    <Text style={sheet.suggestionMeta}>
                      {entry.genericName !== (entry.brandNames[0] ?? '') ? `${entry.genericName} · ` : ''}{entry.drugClass}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Dose */}
            <Text style={[sheet.label, { marginTop: Spacing.md }]}>
              Dose <Text style={sheet.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={sheet.input}
              placeholder="e.g. 200mg"
              placeholderTextColor={Colors.textSecondary}
              value={form.dose}
              onChangeText={patch('dose')}
              returnKeyType="next"
            />

            {/* Strength chips — shown after catalog selection */}
            {selectedEntry && selectedEntry.strengths.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheet.chipScroll}>
                {selectedEntry.strengths.map(strength => (
                  <TouchableOpacity
                    key={strength}
                    style={[sheet.chip, form.dose === strength && sheet.chipSelected]}
                    onPress={() => setForm(f => ({ ...f, dose: strength }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sheet.chipText, form.dose === strength && sheet.chipTextSelected]}>
                      {strength}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Route */}
            <Text style={[sheet.label, { marginTop: Spacing.md }]}>
              Route <Text style={sheet.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={sheet.input}
              placeholder="e.g. oral, topical, IV"
              placeholderTextColor={Colors.textSecondary}
              value={form.route}
              onChangeText={patch('route')}
              returnKeyType="next"
            />

            {/* Route chips — shown after catalog selection with multiple routes */}
            {selectedEntry && selectedEntry.routes.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={sheet.chipScroll}>
                {selectedEntry.routes.map(route => (
                  <TouchableOpacity
                    key={route}
                    style={[sheet.chip, form.route === route && sheet.chipSelected]}
                    onPress={() => setForm(f => ({ ...f, route }))}
                    activeOpacity={0.75}
                  >
                    <Text style={[sheet.chipText, form.route === route && sheet.chipTextSelected]}>
                      {route}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Frequency */}
            <Text style={[sheet.label, { marginTop: Spacing.md }]}>
              Frequency <Text style={sheet.optional}>(optional)</Text>
            </Text>
            <TextInput
              style={sheet.input}
              placeholder="e.g. as needed, twice daily"
              placeholderTextColor={Colors.textSecondary}
              value={form.frequency}
              onChangeText={patch('frequency')}
              returnKeyType="done"
              blurOnSubmit
            />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sheet = StyleSheet.create({
  root:      { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title:     { fontFamily: FontFamily.serif, fontSize: FontSize.body + 1, color: Colors.text, fontWeight: '600' },
  cancel:    { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.textSecondary },
  save:      { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.med, fontWeight: '600' },
  scroll:    { padding: Spacing.lg, paddingBottom: Spacing.xl },
  label:     { fontFamily: FontFamily.sans, fontSize: FontSize.label, fontWeight: '600', color: Colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: Spacing.xs },
  required:  { color: Colors.pain },
  optional:  { fontWeight: '400', textTransform: 'none', letterSpacing: 0, color: Colors.textSecondary },
  input: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    ...Shadow.card,
  },
  inputError: { borderWidth: 1.5, borderColor: Colors.pain },
  errorText:  { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.pain, marginTop: 4 },

  suggestions: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    marginTop: 4,
    ...Shadow.card,
    overflow: 'hidden',
  },
  suggestionRow: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  suggestionName: { fontFamily: FontFamily.sans, fontSize: FontSize.body, color: Colors.text, fontWeight: '500' },
  suggestionMeta: { fontFamily: FontFamily.sans, fontSize: FontSize.label, color: Colors.textSecondary, marginTop: 2 },

  chipScroll: { marginTop: Spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.chip,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginRight: Spacing.xs,
  },
  chipSelected: { backgroundColor: Colors.medLight, borderColor: Colors.med },
  chipText: { fontFamily: FontFamily.sans, fontSize: FontSize.bodySmall, color: Colors.text },
  chipTextSelected: { color: Colors.med, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function MedicationsScreen() {
  const [active,   setActive]   = useState<Medication[]>([]);
  const [archived, setArchived] = useState<Medication[]>([]);
  const [dosesToday, setDosesToday]   = useState<Record<number, number>>({});
  const [lastDoseMap, setLastDoseMap] = useState<Record<number, string>>({});
  const [loading,  setLoading]  = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  // Sheet state
  const [sheetOpen,   setSheetOpen]   = useState(false);
  const [editingMed,  setEditingMed]  = useState<Medication | null>(null);

  async function load() {
    const [all, todayCounts, lastDoses] = await Promise.all([
      getMedications(true),
      getTodayDoseCountByMedication(),
      getLastDoseByMedication(),
    ]);
    setActive(all.filter(m => m.is_active));
    setArchived(all.filter(m => !m.is_active));
    setDosesToday(todayCounts);
    setLastDoseMap(lastDoses);
    setLoading(false);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  function openAdd()               { setEditingMed(null);  setSheetOpen(true); }
  function openEdit(m: Medication) { setEditingMed(m);     setSheetOpen(true); }
  function closeSheet()            { setSheetOpen(false); }
  function handleSaved()           { setSheetOpen(false); load(); }

  function confirmArchive(med: Medication) {
    Alert.alert(
      'Archive Medication',
      `Archive "${med.name}"? It will be hidden but dose history is preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', style: 'destructive',
          onPress: () => archiveMedication(med.id).then(load),
        },
      ]
    );
  }

  function confirmUnarchive(med: Medication) {
    Alert.alert(
      'Restore Medication',
      `Restore "${med.name}" to your active list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restore', onPress: () => unarchiveMedication(med.id).then(load) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Medications</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} hitSlop={8}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.textSecondary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          {/* Active list */}
          {active.length === 0 ? (
            <View style={styles.emptyWrap}>
              <Ionicons name="medical-outline" size={48} color={Colors.border} />
              <Text style={styles.emptyTitle}>No medications yet</Text>
              <Text style={styles.emptyBody}>
                Tap the + button to add your first medication.
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              {active.map((med, i) => {
                const todayCount = dosesToday[med.id] ?? 0;
                const lastAt     = lastDoseMap[med.id];
                const isLast     = i === active.length - 1;
                return (
                  <View key={med.id} style={[styles.row, !isLast && styles.rowBorder]}>
                    <TouchableOpacity
                      style={styles.rowMain}
                      onPress={() => openEdit(med)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.medDot} />
                      <View style={styles.medInfo}>
                        <Text style={styles.medName}>{med.name}</Text>
                        {(med.dose || med.route || med.frequency) ? (
                          <Text style={styles.medMeta}>
                            {[med.dose, med.route, med.frequency].filter(Boolean).join(' · ')}
                          </Text>
                        ) : null}
                        <Text style={styles.medStatus}>
                          {todayCount > 0
                            ? `${todayCount} dose${todayCount > 1 ? 's' : ''} today`
                            : lastAt
                              ? `Last: ${timeAgo(lastAt)}`
                              : 'No doses logged yet'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.archiveBtn}
                      onPress={() => confirmArchive(med)}
                      hitSlop={8}
                    >
                      <Ionicons name="archive-outline" size={18} color={Colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* Archived section */}
          {archived.length > 0 && (
            <>
              <TouchableOpacity
                style={styles.archivedToggle}
                onPress={() => setShowArchived(v => !v)}
              >
                <Text style={styles.archivedToggleLabel}>
                  Archived ({archived.length})
                </Text>
                <Ionicons
                  name={showArchived ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.textSecondary}
                />
              </TouchableOpacity>

              {showArchived && (
                <View style={[styles.card, styles.archivedCard]}>
                  {archived.map((med, i) => (
                    <View
                      key={med.id}
                      style={[styles.row, i < archived.length - 1 && styles.rowBorder]}
                    >
                      <View style={[styles.rowMain, { opacity: 0.6 }]}>
                        <View style={[styles.medDot, { backgroundColor: Colors.border }]} />
                        <View style={styles.medInfo}>
                          <Text style={styles.medName}>{med.name}</Text>
                          {(med.dose || med.route) ? (
                            <Text style={styles.medMeta}>
                              {[med.dose, med.route].filter(Boolean).join(' · ')}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.archiveBtn}
                        onPress={() => confirmUnarchive(med)}
                        hitSlop={8}
                      >
                        <Ionicons name="refresh-outline" size={18} color={Colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}

      <MedSheet
        visible={sheetOpen}
        editing={editingMed}
        onClose={closeSheet}
        onSaved={handleSaved}
      />
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
    paddingVertical: Spacing.md,
    marginBottom: Spacing.xs,
  },
  heading: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.med,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.card,
  },

  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.md,
  },

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    overflow: 'hidden',
    ...Shadow.card,
  },
  archivedCard: {
    opacity: 0.85,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget.min,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  medDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.med,
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
  medMeta: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
  },
  medStatus: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.med,
    marginTop: 2,
  },
  archiveBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
  },

  archivedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  archivedToggleLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  emptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: FontFamily.serif,
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
