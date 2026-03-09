/**
 * Source of truth for mandatory avatar defaults.
 * Applied to the create-avatar editor as the initial selection for each required part.
 *
 * Item names must match AvatarItem.name values in avatar-items.catalog.ts.
 * If a named item doesn't exist in the DB, the GET /avatar/defaults endpoint
 * omits that category but creation still succeeds for the remaining parts.
 */
export const AVATAR_DEFAULTS_CATALOG: Record<string, string> = {
    skin:    'Default Skin',
    face:    'Normal Face',
    eye:     'Test Eyes 1',
    nose:    'Normal Nose',
    mouth:   'Happy Mouth',
    tops:    'T-Shirt',
    bottoms: 'Jeans',
};
