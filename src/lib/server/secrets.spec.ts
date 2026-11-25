import { describe, expect, it } from 'vitest';

describe('secrets', () => {
	it('encrypts and decrypts with APP_SECRET; tampering fails', async () => {
		process.env.APP_SECRET = 'test-secret-for-unit-tests';
		const { encrypt, decrypt } = await import('./secrets');
		const enc = encrypt('geheimes-passwort');
		expect(enc).toMatch(/^v1:/);
		expect(enc).not.toContain('geheimes');
		expect(decrypt(enc)).toBe('geheimes-passwort');
		expect(encrypt('x')).not.toBe(encrypt('x'));
		const parts = enc.split(':');
		parts[3] = Buffer.from('anders').toString('base64');
		expect(decrypt(parts.join(':'))).toBeNull();
		expect(decrypt(null)).toBeNull();
	});
});
