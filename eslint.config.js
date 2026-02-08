import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import security from 'eslint-plugin-security'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      security.configs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSInterfaceDeclaration[id.name='ClientProfile']",
          message: 'Do not define a local ClientProfile interface. Use the shared type from src/types/clientProfile.',
        },
      ],
    },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "TSInterfaceDeclaration[id.name='Source']",
          message: 'Do not define a local Source interface. Use the shared type from src/types/gofrIQ.',
        },
        {
          selector: "TSInterfaceDeclaration[id.name='Instrument']",
          message: 'Do not define a local Instrument interface. Use the shared type from src/types/gofrIQ.',
        },
      ],
    },
  },
  {
    files: ['src/types/clientProfile.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
])
