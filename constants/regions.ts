// 12 canonical pain regions — matches body-map-coordinates.md zone mapping.
// Keys used as DB values (stored as JSON array in entries.pain_regions).
// Labels displayed in chips, Timeline cards, and exported reports.

export const REGIONS = [
  { key: 'abdomen',    label: 'Abdomen'                    },
  { key: 'arms',       label: 'Arms / Elbows / Wrists'     },
  { key: 'chest',      label: 'Chest'                      },
  { key: 'feet',       label: 'Feet'                       },
  { key: 'hands',      label: 'Hands'                      },
  { key: 'head',       label: 'Head / Face'                },
  { key: 'hips',       label: 'Hips / Pelvis'              },
  { key: 'legs',       label: 'Legs / Knees'               },
  { key: 'lower-back', label: 'Lower Back'                 },
  { key: 'neck',       label: 'Neck'                       },
  { key: 'shoulders',  label: 'Shoulders'                  },
  { key: 'upper-back', label: 'Upper Back'                 },
] as const;

export type RegionKey = typeof REGIONS[number]['key'];

// Mapping from region key → SVG zone IDs on front/back images.
// Used by BodyMap to activate the correct circles when a region is selected.
export const REGION_ZONES: Record<RegionKey, { zoneIds: string[]; views: ('front' | 'back' | 'both')[] }> = {
  'head':       { zoneIds: ['head'],                       views: ['both']  },
  'neck':       { zoneIds: ['neck'],                       views: ['both']  },
  'shoulders':  { zoneIds: ['shoulder-l', 'shoulder-r'],   views: ['both']  },
  'arms':       { zoneIds: ['arm-l', 'arm-r'],             views: ['both']  },
  'hands':      { zoneIds: ['hand-l', 'hand-r'],           views: ['both']  },
  'chest':      { zoneIds: ['chest'],                      views: ['front'] },
  'upper-back': { zoneIds: ['upper-back'],                 views: ['back']  },
  'lower-back': { zoneIds: ['lower-back'],                 views: ['back']  },
  'abdomen':    { zoneIds: ['abdomen'],                    views: ['front'] },
  'hips':       { zoneIds: ['hips'],                       views: ['both']  },
  'legs':       { zoneIds: ['leg-l', 'leg-r'],             views: ['both']  },
  'feet':       { zoneIds: ['foot-l', 'foot-r'],           views: ['both']  },
};
