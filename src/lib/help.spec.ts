import { describe, expect, it } from 'vitest';
import { chapterFrom, renderHelp, searchHelp, slugify } from './help';

describe('renderHelp', () => {
	it('renders headings, lists, code and safe links', () => {
		const html = renderHelp(
			[
				'## Mindestbestand verstehen',
				'',
				'Text mit **fett** und `code` und [Einrichtung](01-einrichtung.md#docker).',
				'',
				'- eins',
				'  weiter',
				'- zwei',
				'',
				'1. erstens',
				'',
				'```',
				'docker compose up -d <x>',
				'```'
			].join('\n'),
			'/hilfe'
		);
		expect(html).toContain('<h3 id="mindestbestand-verstehen">Mindestbestand verstehen</h3>');
		expect(html).toContain('<strong>fett</strong> und <code>code</code>');
		expect(html).toContain('<a href="/hilfe/einrichtung#docker">Einrichtung</a>');
		expect(html).toContain('<ul>\n<li>eins weiter</li>\n<li>zwei</li>\n</ul>');
		expect(html).toContain('<ol>\n<li>erstens</li>\n</ol>');
		expect(html).toContain('<pre><code>docker compose up -d &lt;x&gt;</code></pre>');
	});
	it('escapes HTML and drops unsafe links', () => {
		const html = renderHelp('<script>x</script> [klick](javascript:alert(1))', '/hilfe');
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('javascript:');
		expect(html).toContain('klick');
	});
	it('opens external https links in a new tab', () => {
		expect(renderHelp('[GitHub](https://github.com)', '/hilfe')).toContain(
			'<a href="https://github.com" rel="external noopener" target="_blank">GitHub</a>'
		);
	});
});

describe('chapters and search', () => {
	const c = chapterFrom(
		'docs/hilfe/02-erste-schritte.md',
		'# Erste Schritte\n\nIntro.\n\n## Konten anlegen\n\nGirokonto mit Startsaldo.\n\n## Stichtag\n\nGehalt.'
	);
	it('takes title and slug from the file', () => {
		expect(c.slug).toBe('erste-schritte');
		expect(c.title).toBe('Erste Schritte');
		expect(slugify('Über Dispo & Puffer')).toBe('ueber-dispo-puffer');
	});
	it('finds sections with all words', () => {
		const hits = searchHelp([c], 'startsaldo girokonto');
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ heading: 'Konten anlegen', anchor: 'konten-anlegen' });
		expect(searchHelp([c], 'x')).toEqual([]);
	});
});
