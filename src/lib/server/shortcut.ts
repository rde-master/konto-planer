import { error } from '@sveltejs/kit';
import type { Viewer } from './account-rules.js';
import { tokenAuth } from './api.js';
import {
	ImportError,
	MAX_IMPORT_BYTES,
	commitImport,
	createDraft,
	discardDraft,
	importView
} from './imports.js';
import { ImportFormatError, parseExport } from '../csv-import.js';
import { formatIban } from '../iban.js';
import { bookingFormContext, BookingError, createBooking, getBookingFor } from './bookings.js';
import { quickTemplates } from './templates.js';
import { reportCategories } from './reports.js';
import { budgetHint } from './budgets.js';
import { listAccountsFor } from './accounts.js';
import { balancesOf } from './bookings.js';
import { plansFor } from './minimum.js';
import {
	chosenOption,
	importReply,
	importTarget,
	nothingNewReply,
	previewReply,
	shortcutAmount,
	shortcutOptions,
	shortcutReply,
	type ShortcutOption
} from '../shortcut.js';
import { todayBerlin } from '../dates.js';

export class ShortcutError extends Error {}

/** The shortcut's access from the request's bearer token; only tokens made for shortcuts. */
export async function shortcutAuth(request: Request) {
	const a = await tokenAuth(request);
	if (!a) error(401, 'Ungültiges oder fehlendes Token.');
	if (a.purpose !== 'shortcut') error(403, 'Dieser Zugang darf nicht buchen.');
	return a;
}

/** Choices for "Aus Liste wählen": the viewer's templates (usable accounts) and categories. */
export async function optionsFor(viewer: Viewer): Promise<ShortcutOption[]> {
	const { ctx } = await bookingFormContext(viewer);
	const [templates, cats] = await Promise.all([
		quickTemplates(viewer, ctx.accountIds),
		reportCategories()
	]);
	const names = new Map(cats.map((c) => [c.id, c.name]));
	return shortcutOptions(
		templates,
		cats.map((c) => ({
			id: c.id,
			name: c.name,
			parentName: c.parentId ? (names.get(c.parentId) ?? null) : null
		}))
	);
}

/** Books from the shortcut: today, on the template's account or the token's default account. */
export async function bookFromShortcut(
	viewer: Viewer & { name: string },
	defaultAccountId: string | null,
	body: { amount?: unknown; choice?: unknown; payee?: unknown }
): Promise<string> {
	const options = await optionsFor(viewer);
	const choice = chosenOption(options, body.choice);
	if (!choice) throw new ShortcutError('Unbekannte Auswahl. Bitte den Kurzbefehl neu laden.');
	const template = choice.type === 'template' ? choice.template : null;
	const amount = shortcutAmount(body.amount, template?.kind === 'income');
	if (amount === null) throw new ShortcutError('Bitte einen Betrag größer 0 eingeben.');
	const accountId = template?.accountId ?? defaultAccountId;
	if (!accountId) throw new ShortcutError('Für diesen Zugang ist kein Konto festgelegt.');
	const categoryId = template
		? template.categoryId
		: choice.type === 'category'
			? choice.categoryId
			: null;
	const payee =
		typeof body.payee === 'string' && body.payee.trim()
			? body.payee.trim().slice(0, 100)
			: (template?.counterparty ?? null);
	const today = todayBerlin();
	let bookingId: string;
	try {
		bookingId = await createBooking(viewer, {
			accountId,
			bookingDate: today,
			amount,
			categoryId,
			counterparty: payee,
			purpose: 'per Kurzbefehl'
		});
	} catch (e) {
		if (e instanceof BookingError) throw new ShortcutError(e.message);
		throw e;
	}
	const account = (await listAccountsFor(viewer)).find((a) => a.id === accountId);
	let available: number | null = null;
	if (account?.type === 'giro') {
		const balances = await balancesOf([account]);
		available =
			(await plansFor(viewer, [account], balances)).get(account.id)?.plan.available ?? null;
	}
	return shortcutReply({
		amount,
		// Without a chosen category a rule may have set one: name what was booked.
		label: template
			? template.name
			: ((await getBookingFor(viewer, bookingId))?.category?.name ??
				choice.label.split(' › ').at(-1)!),
		account: account?.name ?? '',
		budget: amount < 0 ? await budgetHint(viewer, categoryId, accountId, today.slice(0, 7)) : null,
		available
	});
}

/**
 * Bank export from the shortcut. The account is the one with the file's IBAN. Without
 * `preview` every new row is taken over as the preview would preselect it (automatic
 * assignment, no new recurring items, amounts of recurring items unchanged); with it the file
 * only waits as a draft. `path` leads to the preview or the result in the app.
 */
export async function importFromShortcut(
	viewer: Viewer & { name: string },
	defaultAccountId: string | null,
	file: { bytes: Uint8Array; name: string | null },
	preview: boolean
): Promise<{ message: string; path: string }> {
	if (!file.bytes.length) throw new ShortcutError('Es ist keine Datei angekommen.');
	if (file.bytes.length > MAX_IMPORT_BYTES)
		throw new ShortcutError('Die Datei ist größer als 5 MB.');
	let ibans: string[];
	try {
		ibans = parseExport(file.bytes).rows.map((r) => r.accountIban);
	} catch (e) {
		if (e instanceof ImportFormatError) throw new ShortcutError(e.message);
		throw e;
	}
	const accounts = await listAccountsFor(viewer);
	const target = importTarget(
		ibans,
		accounts.map((a) => ({
			id: a.id,
			type: a.type,
			iban: a.iban,
			archived: a.archivedAt !== null
		})),
		defaultAccountId
	);
	if ('error' in target)
		throw new ShortcutError(
			target.error === 'several'
				? 'Die Datei enthält Buchungen mehrerer Konten. Bitte je Konto eine Datei senden.'
				: `Zur IBAN ${formatIban(ibans.find(Boolean) ?? '') || 'der Datei'} gibt es kein Konto, auf das du importieren darfst. Bitte die IBAN am Konto eintragen.`
		);
	const { accountId } = target;
	const account = accounts.find((a) => a.id === accountId)!;
	const name = file.name?.trim().slice(0, 200) || 'Per Kurzbefehl';
	let importId: string;
	try {
		importId = await createDraft(viewer, accountId, new File([file.bytes as BlobPart], name));
	} catch (e) {
		if (e instanceof ImportError) throw new ShortcutError(e.message);
		throw e;
	}
	const draft = await importView(viewer, accountId, importId);
	if (!draft) throw new ShortcutError('Der Import ließ sich nicht anlegen.');
	const fresh = draft.rows.filter((r) => r.status !== 'duplicate');
	const duplicates = draft.rows.length - fresh.length;
	if (!fresh.length) {
		await discardDraft(viewer, accountId, importId);
		return {
			message: nothingNewReply(account.name, duplicates),
			path: `konten/${accountId}/import`
		};
	}
	const path = `konten/${accountId}/import/${importId}`;
	// A card without IBAN cannot be recognised in the file: never booked without a look.
	if (preview || !target.certain)
		return {
			message: previewReply({ account: account.name, fresh: fresh.length, duplicates }),
			path
		};
	try {
		await commitImport(viewer, accountId, importId, {
			lines: new Set(fresh.map((r) => r.line)),
			amountLines: new Set(),
			suggestions: new Set(),
			salaries: new Set()
		});
	} catch (e) {
		if (e instanceof ImportError) throw new ShortcutError(e.message);
		throw e;
	}
	const done = await importView(viewer, accountId, importId);
	return {
		message: importReply({
			account: account.name,
			created: done?.newCount ?? fresh.length,
			matched: done?.matchedCount ?? 0,
			duplicates,
			bankBalance: done?.bankBalance ?? null,
			appBalance: done?.appBalance ?? null
		}),
		path
	};
}
