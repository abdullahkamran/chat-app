// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// Native dialogs ignore the Tide design system. See "Dialogs" in CLAUDE.md.
const nativeDialogs = {
  name: 'react-native',
  importNames: ['Alert', 'ActionSheetIOS'],
  message: 'Use showDialog / showErrorDialog from @/components/ui (or showToast for notices). See "Dialogs" in CLAUDE.md.',
};
const rawModal = {
  name: 'react-native',
  importNames: ['Modal'],
  message: 'Use <Dialog> from @/components/ui, or the room Drawer for bottom sheets. See "Dialogs" in CLAUDE.md.',
};

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    rules: {
      'no-restricted-imports': ['error', { paths: [nativeDialogs, rawModal] }],
    },
  },
  {
    // The primitives that wrap Modal themselves.
    files: ['components/ui/Dialog.tsx', 'lib/room-engine/components/MailboxModal.tsx'],
    rules: {
      'no-restricted-imports': ['error', { paths: [nativeDialogs] }],
    },
  },
]);
