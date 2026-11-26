import { describe, expect, it } from 'vitest';
import { widgetScript } from './widgets';

// Runs the generated script against a minimal stand-in of Scriptable's API.
type Body = Record<string, unknown>;

function scriptable(response: Body | null, family: string) {
	const log: string[] = [];
	class Item {
		[k: string]: unknown;
		centerAlignImage() {}
	}
	class Stack extends Item {
		centerAlignContent() {}
		addText(t: string) {
			log.push(`text:${t}`);
			return new Item();
		}
		addSpacer() {}
	}
	class ListWidget extends Stack {
		setPadding() {}
		addStack() {
			return new Stack();
		}
		addImage() {
			log.push('image');
			return new Item();
		}
		presentSmall() {
			return Promise.resolve();
		}
		presentMedium() {
			return Promise.resolve();
		}
		presentLarge() {
			return Promise.resolve();
		}
	}
	class Color {
		static dynamic() {
			return new Color();
		}
		static white() {
			return new Color();
		}
	}
	class DrawContext {
		[k: string]: unknown;
		addPath() {}
		setFillColor() {}
		fillPath() {}
		setLineWidth() {}
		setStrokeColor() {}
		strokePath() {}
		setTextColor() {}
		setFont() {}
		setTextAlignedCenter() {}
		drawTextInRect() {}
		getImage() {
			return {};
		}
	}
	class Path {
		addRoundedRect() {}
		addLines() {}
	}
	const noop = class {};
	const files = new Map<string, string>();
	const env = {
		Request: class {
			headers = {};
			response = { statusCode: response ? 200 : 500 };
			loadJSON() {
				return response ? Promise.resolve(response) : Promise.reject(new Error('offline'));
			}
		},
		FileManager: {
			local: () => ({
				joinPath: (a: string, b: string) => `${a}/${b}`,
				documentsDirectory: () => '/docs',
				writeString: (p: string, v: string) => files.set(p, v),
				readString: (p: string) => files.get(p),
				fileExists: (p: string) => files.has(p)
			})
		},
		Color,
		ListWidget,
		DrawContext,
		Path,
		Point: noop,
		Rect: noop,
		Size: noop,
		LinearGradient: noop,
		Font: new Proxy({}, { get: () => () => ({}) }),
		Script: { setWidget: () => log.push('set'), complete: () => log.push('done') },
		config: { runsInWidget: true, widgetFamily: family }
	};
	return { env, log };
}

async function run(body: Body | null, family: string) {
	const { env, log } = scriptable(body, family);
	const code = widgetScript({ url: 'https://x/api/widget', token: 't', id: '12345678', name: 'T' });
	const proto = Object.getPrototypeOf(async () => {}) as {
		constructor: new (...args: string[]) => (...a: unknown[]) => Promise<void>;
	};
	const fn = new proto.constructor(...Object.keys(env), code);
	await fn(...Object.values(env));
	return log;
}

const base = { generatedAt: '2026-11-26T10:00:00Z', appUrl: null };

describe('widget script', () => {
	it('draws home screen blocks', async () => {
		const log = await run(
			{
				...base,
				size: 'medium',
				blocks: [
					{ type: 'title', text: 'Konten' },
					{ type: 'big', value: '1 €', color: 'accent' },
					{ type: 'bar', value: 0.5, color: 'accent' },
					{ type: 'row', label: 'Giro', value: '1 €' },
					{ type: 'spacer' }
				],
				style: {
					gradient: [
						['#000000', '#000000'],
						['#111111', '#111111']
					],
					scale: 1.2
				}
			},
			'medium'
		);
		expect(log).toContain('text:Konten');
		expect(log).toContain('image');
		expect(log.at(-1)).toBe('done');
	});
	it('draws the three lock screen forms', async () => {
		for (const [size, lock] of [
			['lockRect', { lines: ['Verfügbar', '600 €'], gauge: null }],
			['lockInline', { lines: ['600 € frei'], gauge: null }],
			['lockCircle', { lines: [], gauge: { value: 0.4, label: '600' } }]
		] as const) {
			const log = await run({ ...base, size, blocks: [], lock }, 'accessoryRectangular');
			expect(log).toContain('set');
			if (lock.gauge) expect(log).toContain('image');
			else expect(log).toContain(`text:${lock.lines[0]}`);
		}
	});
	it('says so without connection and cache', async () => {
		const log = await run(null, 'small');
		expect(log).toContain('text:Konto Planer: keine Verbindung');
	});
});
