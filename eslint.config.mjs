import path from 'path';
import { fileURLToPath } from 'url';
import globals from 'globals';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default [
    {
        files: ['src/**/*.ts'],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                project: path.join(__dirname, 'tsconfig.json'),
                tsconfigRootDir: __dirname
            },
            globals: {
                ...globals.node
            }
        },
        plugins: {
            '@typescript-eslint': tseslint
        },
        rules: {
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-floating-promises': 'error',
            '@typescript-eslint/consistent-type-imports': 'off'
        }
    },
    {
        ignores: ['dist/**', 'node_modules/**']
    }
];
