// Help pages ("Hilfe"): a small Markdown subset rendered to safe HTML, plus search.

export type HelpChapter = { slug: string; title: string; markdown: string };

function escape(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Anchor id of a heading ("Mindestbestand verstehen" → "mindestbestand-verstehen"). */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/ä/g, 'ae')
		.replace(/ö/g, 'oe')
		.replace(/ü/g, 'ue')
		.replace(/ß/g, 'ss')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

function safeHref(href: string, base: string): string | null {
	if (/^https:\/\//.test(href)) return href;
	if (/^#[a-z0-9-]+$/.test(href)) return href;
	// Links between help chapters: "erste-schritte.md#konten" → base/erste-schritte#konten
	const m = /^(?:\.\/)?([a-z0-9-]+)\.md(#[a-z0-9-]+)?$/.exec(href);
	return m ? `${base}/${m[1].replace(/^\d+-/, '')}${m[2] ?? ''}` : null;
}

function inline(text: string, base: string): string {
	let out = escape(text);
	out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
	out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
		const target = safeHref(href.replace(/&amp;/g, '&'), base);
		if (!target) return label;
		const external = target.startsWith('https://');
		return `<a href="${escape(target)}"${external ? ' rel="external noopener" target="_blank"' : ''}>${label}</a>`;
	});
	return out;
}

/** Renders the Markdown subset used in docs/hilfe (headings, paragraphs, lists, code, links). */
export function renderHelp(md: string, base: string): string {
	const out: string[] = [];
	let list: 'ul' | 'ol' | null = null;
	let para: string[] = [];
	let code: string[] | null = null;
	const flushPara = () => {
		if (para.length) out.push(`<p>${inline(para.join(' '), base)}</p>`);
		para = [];
	};
	const closeList = () => {
		if (list) out.push(`</${list}>`);
		list = null;
	};
	for (const raw of md.split(/\r?\n/)) {
		if (code) {
			if (raw.startsWith('```')) {
				out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
				code = null;
			} else code.push(raw);
			continue;
		}
		const line = raw.trimEnd();
		if (line.startsWith('```')) {
			flushPara();
			closeList();
			code = [];
			continue;
		}
		const h = /^(#{1,3}) (.+)$/.exec(line);
		if (h) {
			flushPara();
			closeList();
			const level = h[1].length + 1;
			out.push(`<h${level} id="${slugify(h[2])}">${inline(h[2], base)}</h${level}>`);
			continue;
		}
		const li = /^(?:(-)|\d+\.) (.+)$/.exec(line);
		if (li) {
			flushPara();
			const kind = li[1] ? 'ul' : 'ol';
			if (list !== kind) {
				closeList();
				out.push(`<${kind}>`);
				list = kind;
			}
			out.push(`<li>${inline(li[2], base)}</li>`);
			continue;
		}
		if (!line.trim()) {
			flushPara();
			closeList();
			continue;
		}
		if (list && /^\s{2,}/.test(raw)) {
			const last = out.pop()!;
			out.push(last.replace(/<\/li>$/, ` ${inline(line.trim(), base)}</li>`));
			continue;
		}
		closeList();
		para.push(line.trim());
	}
	if (code) out.push(`<pre><code>${escape(code.join('\n'))}</code></pre>`);
	flushPara();
	closeList();
	return out.join('\n');
}

/** Chapter from a file: first "# " line is the title; slug from the file name without number. */
export function chapterFrom(fileName: string, markdown: string): HelpChapter {
	const slug = fileName.replace(/^.*\//, '').replace(/\.md$/, '').replace(/^\d+-/, '');
	const title = /^# (.+)$/m.exec(markdown)?.[1].trim() ?? slug;
	return { slug, title, markdown: markdown.replace(/^# .+\n?/m, '') };
}

export type HelpHit = {
	slug: string;
	chapter: string;
	heading: string;
	anchor: string;
	text: string;
};

/** Sections ("## …") that contain all words of the query. */
export function searchHelp(chapters: HelpChapter[], query: string): HelpHit[] {
	const words = query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 1);
	if (!words.length) return [];
	const hits: HelpHit[] = [];
	for (const c of chapters) {
		const parts = c.markdown.split(/^## /m);
		parts.forEach((part, i) => {
			const heading = i === 0 ? c.title : part.split('\n')[0].trim();
			const body = i === 0 ? part : part.slice(part.indexOf('\n') + 1);
			const hay = `${heading} ${body}`.toLowerCase();
			if (!words.every((w) => hay.includes(w))) return;
			const plain = body
				.replace(/[#*`[\]()]/g, '')
				.replace(/\s+/g, ' ')
				.trim();
			const at = Math.max(0, plain.toLowerCase().indexOf(words[0]) - 40);
			hits.push({
				slug: c.slug,
				chapter: c.title,
				heading,
				anchor: i === 0 ? '' : slugify(heading),
				text: (at ? '…' : '') + plain.slice(at, at + 140) + (plain.length > at + 140 ? '…' : '')
			});
		});
	}
	return hits.slice(0, 20);
}
