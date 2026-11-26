-- ============================================================================
-- New permission: templates.delete (deleting furniture types).
-- Added on its own so the enum value is committed before the next migration
-- uses it.
-- ============================================================================
alter type public.app_permission add value if not exists 'templates.delete' after 'templates.edit';
