import { useCallback } from 'react';
import { View, Image, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { REGIONS, REGION_ZONES, type RegionKey } from '@/constants/regions';
import { Colors, Spacing, Radius, FontFamily, FontSize } from '@/constants/theme';

// ─── Zone definitions (from body-map-coordinates.md) ─────────────────────────

interface ZoneDef {
  id:    string;
  cx:    number; // px in 381×917 coordinate space
  cy:    number;
  r:     number;
  view:  'front' | 'back' | 'both';
}

const ZONES: ZoneDef[] = [
  { id: 'head',       cx: 191, cy:  62, r: 50, view: 'both'  },
  { id: 'neck',       cx: 191, cy: 138, r: 22, view: 'both'  },
  { id: 'shoulder-l', cx: 102, cy: 188, r: 40, view: 'both'  },
  { id: 'shoulder-r', cx: 280, cy: 188, r: 40, view: 'both'  },
  { id: 'chest',      cx: 191, cy: 258, r: 52, view: 'front' },
  { id: 'upper-back', cx: 191, cy: 252, r: 58, view: 'back'  },
  { id: 'arm-l',      cx:  76, cy: 355, r: 32, view: 'both'  },
  { id: 'arm-r',      cx: 305, cy: 355, r: 32, view: 'both'  },
  { id: 'abdomen',    cx: 191, cy: 370, r: 46, view: 'front' },
  { id: 'lower-back', cx: 191, cy: 382, r: 50, view: 'back'  },
  { id: 'hips',       cx: 191, cy: 462, r: 56, view: 'both'  },
  { id: 'hand-l',     cx:  50, cy: 488, r: 30, view: 'both'  },
  { id: 'hand-r',     cx: 332, cy: 488, r: 30, view: 'both'  },
  { id: 'leg-l',      cx: 155, cy: 650, r: 40, view: 'both'  },
  { id: 'leg-r',      cx: 228, cy: 650, r: 40, view: 'both'  },
  { id: 'foot-l',     cx: 148, cy: 872, r: 28, view: 'both'  },
  { id: 'foot-r',     cx: 234, cy: 872, r: 28, view: 'both'  },
];

// Minimum display radius to keep tap targets reachable on small screens.
const MIN_DISPLAY_R = 22;

// Which zone IDs are active for a given set of selected region keys.
function activeZoneIds(selected: string[]): Set<string> {
  const ids = new Set<string>();
  for (const key of selected) {
    const mapping = REGION_ZONES[key as RegionKey];
    if (mapping) mapping.zoneIds.forEach(id => ids.add(id));
  }
  return ids;
}

// Which region key a zone belongs to (for tap → region toggle).
function regionForZone(zoneId: string): RegionKey | null {
  for (const [regionKey, mapping] of Object.entries(REGION_ZONES)) {
    if (mapping.zoneIds.includes(zoneId)) return regionKey as RegionKey;
  }
  return null;
}

// ─── SVG overlay for one image (front or back) ───────────────────────────────

function BodySvg({
  side,
  selected,
  onToggle,
  displayWidth,
}: {
  side: 'front' | 'back';
  selected: string[];
  onToggle: (regionKey: RegionKey) => void;
  displayWidth: number;
}) {
  // Scale factor from 381px coordinate space to actual display width.
  const scale = displayWidth / 381;
  const displayHeight = 917 * scale;
  const activeIds = activeZoneIds(selected);

  const zones = ZONES.filter(z => z.view === side || z.view === 'both');

  return (
    <View style={{ width: displayWidth, height: displayHeight }}>
      <Image
        source={
          side === 'front'
            ? require('@/assets/images/body-anatomy-front.png')
            : require('@/assets/images/body-anatomy-back.png')
        }
        style={{ width: displayWidth, height: displayHeight, position: 'absolute' }}
        resizeMode="contain"
        accessibilityElementsHidden
      />
      <Svg
        width={displayWidth}
        height={displayHeight}
        viewBox="0 0 381 917"
        style={{ position: 'absolute' }}
      >
        {zones.map(zone => {
          const isActive = activeIds.has(zone.id);
          // Enforce minimum display radius for small screens.
          const displayR = Math.max(MIN_DISPLAY_R / scale, zone.r);
          const regionKey = regionForZone(zone.id);

          return (
            <Circle
              key={zone.id}
              cx={zone.cx}
              cy={zone.cy}
              r={displayR}
              fill={isActive ? 'rgba(168, 74, 66, 0.38)' : 'transparent'}
              stroke={isActive ? 'rgba(168, 74, 66, 0.85)' : 'rgba(168, 74, 66, 0.22)'}
              strokeWidth={isActive ? 2 : 1.5}
              strokeDasharray={isActive ? undefined : '4 3'}
              onPress={regionKey ? () => onToggle(regionKey) : undefined}
              accessibilityLabel={regionKey ? REGIONS.find(r => r.key === regionKey)?.label : undefined}
              accessibilityRole="button"
            />
          );
        })}
      </Svg>
    </View>
  );
}

// ─── BodyMap — main export ────────────────────────────────────────────────────

interface Props {
  selected: string[];          // array of RegionKey
  onChange: (keys: string[]) => void;
  displayWidth?: number;       // total width available for both images combined
}

export default function BodyMap({ selected, onChange, displayWidth = 320 }: Props) {
  const imageWidth = Math.floor((displayWidth - Spacing.sm) / 2);

  const toggle = useCallback((regionKey: RegionKey) => {
    onChange(
      selected.includes(regionKey)
        ? selected.filter(k => k !== regionKey)
        : [...selected, regionKey]
    );
  }, [selected, onChange]);

  // Sorted selected labels for the chip echo row.
  const selectedRegions = REGIONS.filter(r => selected.includes(r.key));

  return (
    <View>
      {/* Side-by-side body images with SVG overlays */}
      <View style={styles.imagesRow}>
        <BodySvg side="front" selected={selected} onToggle={toggle} displayWidth={imageWidth} />
        <BodySvg side="back"  selected={selected} onToggle={toggle} displayWidth={imageWidth} />
      </View>

      {/* Selected zone chips echoed below for accessibility */}
      {selectedRegions.length > 0 && (
        <View style={styles.chipRow}>
          {selectedRegions.map(r => (
            <TouchableOpacity
              key={r.key}
              style={styles.chip}
              onPress={() => toggle(r.key)}
              activeOpacity={0.75}
              accessibilityLabel={`Remove ${r.label}`}
            >
              <Text style={styles.chipLabel}>{r.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  imagesRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.chip,
    backgroundColor: Colors.painLight,
    borderWidth: 1.5,
    borderColor: Colors.pain,
  },
  chipLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.bodySmall,
    color: Colors.pain,
    fontWeight: '600',
  },
});
