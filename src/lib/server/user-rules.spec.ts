import { describe, expect, it } from 'vitest';
import {
	checkDelete,
	checkRoleChange,
	parseRole,
	validateNewUser,
	validatePasswordPair,
	validateProfile
} from './user-rules';

const ADMIN = 'a1';
const OTHER = 'b2';

describe('checkRoleChange', () => {
	it('allows promoting a user to admin', () => {
		expect(
			checkRoleChange({
				actorId: ADMIN,
				targetId: OTHER,
				currentRole: 'user',
				newRole: 'admin',
				adminCount: 1
			})
		).toBeUndefined();
	});

	it('allows demoting another admin while a second admin remains', () => {
		expect(
			checkRoleChange({
				actorId: ADMIN,
				targetId: OTHER,
				currentRole: 'admin',
				newRole: 'user',
				adminCount: 2
			})
		).toBeUndefined();
	});

	it('keeps the last admin', () => {
		expect(
			checkRoleChange({
				actorId: ADMIN,
				targetId: ADMIN,
				currentRole: 'admin',
				newRole: 'user',
				adminCount: 1
			})
		).toBe('Es muss mindestens einen Admin geben.');
	});

	it('stops admins from demoting themselves', () => {
		expect(
			checkRoleChange({
				actorId: ADMIN,
				targetId: ADMIN,
				currentRole: 'admin',
				newRole: 'user',
				adminCount: 3
			})
		).toBe('Du kannst dir die Admin-Rolle nicht selbst entziehen.');
	});

	it('ignores unchanged roles', () => {
		expect(
			checkRoleChange({
				actorId: ADMIN,
				targetId: ADMIN,
				currentRole: 'admin',
				newRole: 'admin',
				adminCount: 1
			})
		).toBeUndefined();
	});
});

describe('checkDelete', () => {
	it('allows deleting a normal user', () => {
		expect(
			checkDelete({ actorId: ADMIN, targetId: OTHER, targetRole: 'user', adminCount: 1 })
		).toBeUndefined();
	});

	it('forbids deleting yourself', () => {
		expect(
			checkDelete({ actorId: ADMIN, targetId: ADMIN, targetRole: 'admin', adminCount: 2 })
		).toBe('Du kannst dich nicht selbst löschen.');
	});

	it('forbids deleting the last admin', () => {
		expect(
			checkDelete({ actorId: ADMIN, targetId: OTHER, targetRole: 'admin', adminCount: 1 })
		).toBe('Der letzte Admin kann nicht gelöscht werden.');
	});

	it('allows deleting another admin while one remains', () => {
		expect(
			checkDelete({ actorId: ADMIN, targetId: OTHER, targetRole: 'admin', adminCount: 2 })
		).toBeUndefined();
	});
});

describe('validation', () => {
	it('parses only known roles', () => {
		expect(parseRole('admin')).toBe('admin');
		expect(parseRole('user')).toBe('user');
		expect(parseRole('root')).toBeUndefined();
	});

	it('validates the profile', () => {
		expect(validateProfile({ name: 'Anna', email: '', role: 'user' })).toBeNull();
		expect(validateProfile({ name: '  ', email: 'x', role: 'boss' })).toEqual({
			name: 'Bitte einen Namen angeben.',
			email: 'Keine gültige E-Mail-Adresse.',
			role: 'Unbekannte Rolle.'
		});
	});

	it('validates password pairs', () => {
		expect(validatePasswordPair('lang-genug-1', 'lang-genug-1')).toBeNull();
		expect(validatePasswordPair('kurz', 'anders')).toMatchObject({
			password: 'Mindestens 10 Zeichen.',
			confirm: 'Die Passwörter stimmen nicht überein.'
		});
	});

	it('validates a complete new user and normalises the username', () => {
		const base = {
			name: 'Max',
			email: '',
			role: 'user',
			password: 'lang-genug-1',
			confirm: 'lang-genug-1'
		};
		expect(validateNewUser({ ...base, username: '  Max.M ' })).toBeNull();
		expect(validateNewUser({ ...base, username: 'x' })).toMatchObject({
			username: 'Mindestens 3 Zeichen.'
		});
	});
});
