import { describe, expect, it } from 'vitest';
import { berlinHour, shouldSend } from './notify';

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
