// Three shelves keep the homepage focused on evidence, not a catalog dump.
// Membership, eligibility, ranking and allocation remain owned by discovery.
export const homepageSections = [
  { key: 'discover', titleKey: 'homepage.sections.discover', descriptionKey: 'discover', style: 'discover' },
  { key: 'new_on_byb', titleKey: 'homepage.sections.newOnByb', descriptionKey: 'newOnByb', style: 'newOnByb' },
  { key: 'more_to_explore', titleKey: 'homepage.sections.more', descriptionKey: 'more', style: 'more' },
] as const;
