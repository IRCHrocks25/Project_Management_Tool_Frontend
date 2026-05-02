// Mirrors backend DeliverableType enum (deliverable.entity.ts). Used by
// NameCell to decide if a deliverable's display name is editable: backend
// only honors customType when type === 'Other', so for canonical types
// the rendered name IS the type and inline rename is suppressed.
export const DeliverableType = {
  LOGO:                 'Logo',
  BRAND_BOOK:           'Brand Book',
  LANDING_PAGE:         'Home Page',
  COPY_OF_LANDING_PAGE: 'Copy of Home Page',
  SPEAKER_KIT:          'Speaker Kit',
  SOCIAL_BANNERS:       'Social Banners',
  OTHER:                'Other',
} as const;
