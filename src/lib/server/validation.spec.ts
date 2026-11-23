import { describe, expect, it } from 'vitest';
import {
	formString,
	normalizeUsername,
	validateEmail,
	validatePassword,
	validateUsername
} from './validation';

describe('username', () => {
	it('is trimmed and lower-cased', () => {
		expect(normalizeUsername('  Daniel ')).toBe('daniel');
	});

	it.each(['anna', 'max.mustermann', 'k_1-2'])('accepts %s', (name) => {
		expect(validateUsername(name)).toBeUndefined();
	});

	it.each(['ab', 'a'.repeat(33), 'mit leerzeichen', 'umläut'])('rejects %s', (name) => {
		expect(validateUsername(name)).toBeTypeOf('string');
	});
});

describe('password', () => {
	it('needs at least 10 characters', () => {
		expect(validatePassword('123456789')).toBeTypeOf('string');
		expect(validatePassword('1234567890')).toBeUndefined();
	});
});

describe('email', () => {
	it('is optional but must look valid when given', () => {
		expect(validateEmail('')).toBeUndefined();
		expect(validateEmail('a@b.de')).toBeUndefined();
		expect(validateEmail('kein-at')).toBeTypeOf('string');
	});
});

describe('formString', () => {
	it('returns text values and ignores files or missing fields', () => {
		const data = new FormData();
		data.set('name', 'Anna');
		data.set('file', new Blob(['x']));
		expect(formString(data, 'name')).toBe('Anna');
		expect(formString(data, 'file')).toBe('');
		expect(formString(data, 'missing')).toBe('');
	});
});
