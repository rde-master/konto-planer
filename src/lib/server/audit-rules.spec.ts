import { describe, expect, it } from 'vitest';
import { diff, parseAuditFilter, sanitize } from './audit-rules';
import { entryTitle, formatFieldValue } from '../audit';

describe('sanitize', () => {
	it('never keeps passwords, hashes or tokens – at any depth', () => {
		expect(
			sanitize({
				name: 'Anna',
				passwordHash: '$argon2id$...',
				password: 'geheim',
				nested: { apiToken: 'x', smtpPassword: 'y', host: 'mail' },
				list: [{ secret: 1, ok: 2 }]
			})
		).toEqual({ name: 'Anna', nested: { host: 'mail' }, list: [{ ok: 2 }] });
	});

	it('turns dates into ISO strings and drops undefined', () => {
		expect(sanitize({ at: new Date(Date.UTC(2026, 0, 2)), x: undefined, y: null })).toEqual({
			at: '2026-01-02T00:00:00.000Z',
			y: null
		});
	});
});

describe('diff', () => {
	it('keeps only changed fields', () => {
		expect(
			diff(
				{ name: 'Max', email: null, role: 'user' },
				{ name: 'Max', email: 'm@x.de', role: 'admin' }
			)
		).toEqual({ before: { email: null, role: 'user' }, after: { email: 'm@x.de', role: 'admin' } });
	});

	it('returns null when nothing changed', () => {
		expect(diff({ name: 'Max' }, { name: 'Max' })).toBeNull();
	});

	it('does not reveal password changes as values', () => {
		expect(diff({ passwordHash: 'a' }, { passwordHash: 'b' })).toBeNull();
	});
});

describe('labels', () => {
	it('builds readable titles', () => {
		expect(entryTitle('user', 'create')).toBe('Benutzer angelegt');
		expect(entryTitle('auth', 'login_failed')).toBe('Anmeldung fehlgeschlagen');
		expect(entryTitle('user', 'password_reset')).toBe('Passwort zurückgesetzt');
		expect(entryTitle('user', 'delete')).toBe('Benutzer gelöscht');
	});

	it('formats values', () => {
		expect(formatFieldValue('role', 'admin')).toBe('Admin');
		expect(formatFieldValue('email', null)).toBe('–');
		expect(formatFieldValue('lockedUntil', '2026-11-23T11:15:00.000Z')).toBe('23.11.2026, 12:15');
		expect(formatFieldValue('reason', 'locked')).toBe('Anmeldung war gesperrt');
	});
});

describe('parseAuditFilter', () => {
	const known = { entities: ['auth', 'user'], actions: ['create', 'login'] };
	const parse = (q: string) => parseAuditFilter(new URLSearchParams(q), known);

	it('reads all valid filters', () => {
		expect(
			parse(
				'benutzer=0b5e0c1e-1111-4222-8333-444455556666&bereich=user&aktion=create&von=2026-11-01&bis=2026-11-23&vor=120'
			)
		).toEqual({
			actor: '0b5e0c1e-1111-4222-8333-444455556666',
			entity: 'user',
			action: 'create',
			from: '2026-11-01',
			to: '2026-11-23',
			before: 120
		});
	});

	it('ignores unknown or malformed values', () => {
		expect(
			parse('benutzer=1;drop table&bereich=konto&aktion=hack&von=2026-02-30&bis=gestern&vor=-3')
		).toEqual({});
	});

	it('returns an empty filter for no parameters', () => {
		expect(parse('')).toEqual({});
	});
});
