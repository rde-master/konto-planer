import { describe, expect, it } from 'vitest';
import { berlinHour, isMissing, shouldSend } from './notify';

describe('notifications', () => {
	it('repeat once or daily', () => {
		expect(shouldSend(null, 'once', '2026-11-25')).toBe(true);
		expect(shouldSend('2026-11-20', 'once', '2026-11-25')).toBe(false);
		expect(shouldSend('2026-11-24', 'daily', '2026-11-25')).toBe(true);
		expect(shouldSend('2026-11-25', 'daily', '2026-11-25')).toBe(false);
	});
	it('Berlin hour', () => {
		expect(berlinHour(new Date('2026-11-25T07:30:00Z'))).toBe(8);
		expect(berlinHour(new Date('2026-07-01T05:59:00Z'))).toBe(7);
	});
});

describe('missing payments', () => {
	it('after the tolerance, only for accounts with imports', () => {
		expect(isMissing('2026-11-20', '2026-11-25', 3, true)).toBe(true);
		expect(isMissing('2026-11-23', '2026-11-25', 3, true)).toBe(false);
		expect(isMissing('2026-11-22', '2026-11-25', 3, true)).toBe(true);
		expect(isMissing('2026-11-01', '2026-11-25', 3, false)).toBe(false);
	});
});
