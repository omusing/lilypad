import { useCallback, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Switch,
  ScrollView, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import {
  Colors, FontFamily, FontSize, Spacing, Radius, Shadow, TouchTarget,
} from '@/constants/theme';
import { getSettings, updateSettings } from '@/db/settings';
import type { Settings } from '@/db/schema';

// ─── Time picker helper ───────────────────────────────────────────────────────

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour   = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [settings, setSettings]   = useState<Settings | null>(null);
  const [name, setName]           = useState('');
  const [saving, setSaving]       = useState(false);

  // Android time picker visibility
  const [showMorningPicker, setShowMorningPicker] = useState(false);
  const [showEveningPicker, setShowEveningPicker] = useState(false);

  useFocusEffect(useCallback(() => {
    getSettings().then(s => {
      setSettings(s);
      setName(s.patient_name ?? '');
    });
  }, []));

  async function save(patch: Partial<Settings>) {
    setSaving(true);
    try {
      await updateSettings(patch);
      const updated = await getSettings();
      setSettings(updated);
      setName(updated.patient_name ?? '');
    } finally {
      setSaving(false);
    }
  }

  async function saveName() {
    await save({ patient_name: name.trim() || null });
  }

  if (!settings) return null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profile section */}
        <Text style={styles.sectionLabel}>Profile</Text>
        <View style={styles.card}>
          <Text style={styles.rowLabel}>Your name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              value={name}
              onChangeText={setName}
              placeholder="Optional"
              placeholderTextColor={Colors.textSecondary}
              returnKeyType="done"
              onSubmitEditing={saveName}
              onBlur={saveName}
              autoCorrect={false}
            />
          </View>
          <Text style={styles.rowHint}>
            Used in the greeting on the home screen.
          </Text>
        </View>

        {/* Reminders section */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>Reminders</Text>
        <View style={styles.card}>
          {/* Morning */}
          <View style={styles.reminderRow}>
            <View style={styles.reminderLeft}>
              <Text style={styles.rowLabel}>Morning reminder</Text>
              <TouchableOpacity
                onPress={() => {
                  if (settings.morning_reminder) {
                    Platform.OS === 'ios'
                      ? setShowMorningPicker(v => !v)
                      : setShowMorningPicker(true);
                  }
                }}
                disabled={!settings.morning_reminder}
              >
                <Text style={[styles.timeText, !settings.morning_reminder && { opacity: 0.4 }]}>
                  {formatTime(settings.morning_time)}
                </Text>
              </TouchableOpacity>
            </View>
            <Switch
              value={settings.morning_reminder}
              onValueChange={v => save({ morning_reminder: v })}
              trackColor={{ true: Colors.brand }}
              thumbColor="#fff"
            />
          </View>

          {(showMorningPicker || (Platform.OS === 'ios' && settings.morning_reminder)) && (
            <DateTimePicker
              mode="time"
              value={parseTime(settings.morning_time)}
              onChange={(_, date) => {
                setShowMorningPicker(false);
                if (date) {
                  const hh = String(date.getHours()).padStart(2, '0');
                  const mm = String(date.getMinutes()).padStart(2, '0');
                  save({ morning_time: `${hh}:${mm}` });
                }
              }}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
            />
          )}

          <View style={styles.divider} />

          {/* Evening */}
          <View style={styles.reminderRow}>
            <View style={styles.reminderLeft}>
              <Text style={styles.rowLabel}>Evening reminder</Text>
              <TouchableOpacity
                onPress={() => {
                  if (settings.evening_reminder) {
                    Platform.OS === 'ios'
                      ? setShowEveningPicker(v => !v)
                      : setShowEveningPicker(true);
                  }
                }}
                disabled={!settings.evening_reminder}
              >
                <Text style={[styles.timeText, !settings.evening_reminder && { opacity: 0.4 }]}>
                  {formatTime(settings.evening_time)}
                </Text>
              </TouchableOpacity>
            </View>
            <Switch
              value={settings.evening_reminder}
              onValueChange={v => save({ evening_reminder: v })}
              trackColor={{ true: Colors.brand }}
              thumbColor="#fff"
            />
          </View>

          {(showEveningPicker || (Platform.OS === 'ios' && settings.evening_reminder)) && (
            <DateTimePicker
              mode="time"
              value={parseTime(settings.evening_time)}
              onChange={(_, date) => {
                setShowEveningPicker(false);
                if (date) {
                  const hh = String(date.getHours()).padStart(2, '0');
                  const mm = String(date.getMinutes()).padStart(2, '0');
                  save({ evening_time: `${hh}:${mm}` });
                }
              }}
              display={Platform.OS === 'ios' ? 'compact' : 'default'}
            />
          )}

          <Text style={styles.rowHint}>
            Reminders prompt you to log your daily pain levels.
          </Text>
        </View>

        {/* About link */}
        <Text style={[styles.sectionLabel, { marginTop: Spacing.lg }]}>App</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => router.push('/about' as never)}
          >
            <Text style={styles.linkLabel}>About Lilypad</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.border} />
          </TouchableOpacity>
        </View>

        {/* Developer tools — dev builds only */}
        {__DEV__ && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: Spacing.lg, color: Colors.pain }]}>
              Developer
            </Text>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.linkRow}
                onPress={() => router.push('/dev-tools' as never)}
              >
                <Text style={[styles.linkLabel, { color: Colors.pain }]}>Developer tools</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.border} />
              </TouchableOpacity>
            </View>
          </>
        )}

        {saving && (
          <Text style={styles.savingText}>Saving...</Text>
        )}
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
  title: {
    fontFamily: FontFamily.serif,
    fontSize: FontSize.sectionHeading,
    color: Colors.text,
  },
  backBtn: {
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

  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.card,
    padding: Spacing.md,
    ...Shadow.card,
  },

  rowLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
    fontWeight: '500',
  },
  rowHint: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: FontSize.label * 1.5,
  },

  nameRow: {
    marginTop: Spacing.sm,
  },
  nameInput: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodyLarge,
    color: Colors.text,
    paddingVertical: 8,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.border,
  },

  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget.min,
    paddingVertical: 4,
  },
  reminderLeft: {
    flex: 1,
    gap: 2,
  },
  timeText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.brand,
    fontWeight: '500',
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: TouchTarget.min,
  },
  linkLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.body,
    color: Colors.text,
  },

  savingText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.label,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.md,
  },
});
