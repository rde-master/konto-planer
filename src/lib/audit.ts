import { formatEuro } from './money.js';
import { ACCOUNT_COLORS } from './colors.js';
import { KIND_LABELS, PAYMENT_METHOD_LABELS } from './recurring.js';

// Shared (client-safe) vocabulary of the audit log: entity types, actions and German labels.

export const ENTITY_TYPES = [
	'auth',
	'user',
	'account',
	'category',
	'recurring',
	'booking',
	'template',
	'settings'
] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const ACTIONS = [
	'create',
	'update',
	'delete',
	'login',
	'login_failed',
	'locked',
	'unlock',
	'logout',
	'password_reset',
	'password_change',
	'archive',
	'restore',
	'access_change',
	'amount_change',
	'attachment_add',
	'attachment_delete',
	'pause',
	'resume'
] as const;
export type AuditAction = (typeof ACTIONS)[number];

export const ENTITY_LABELS: Record<EntityType, string> = {
	auth: 'Anmeldung',
	user: 'Benutzer',
	account: 'Konto',
	category: 'Kategorie',
	recurring: 'Dauerposten',
	booking: 'Buchung',
	template: 'Vorlage',
	settings: 'Einstellungen'
};

export const ACTION_LABELS: Record<AuditAction, string> = {
	create: 'Angelegt',
	update: 'Geändert',
	delete: 'Gelöscht',
	login: 'Angemeldet',
	login_failed: 'Anmeldung fehlgeschlagen',
	locked: 'Anmeldung gesperrt',
	unlock: 'Sperre aufgehoben',
	logout: 'Abgemeldet',
	password_reset: 'Passwort zurückgesetzt',
	password_change: 'Passwort geändert',
	archive: 'Archiviert',
	restore: 'Wiederhergestellt',
	access_change: 'Zugriffe geändert',
	amount_change: 'Betrag geändert',
	attachment_add: 'Anhang hinzugefügt',
	attachment_delete: 'Anhang gelöscht',
	pause: 'Pausiert',
	resume: 'Pause beendet'
};

/** Short title for a log row, e.g. "Benutzer angelegt" or "Anmeldung fehlgeschlagen". */
export function entryTitle(entityType: string, action: string): string {
	const actionLabel = ACTION_LABELS[action as AuditAction] ?? action;
	// These actions need the entity ("Konto archiviert"); the others speak for themselves.
	if (!['create', 'update', 'delete', 'archive', 'restore'].includes(action)) return actionLabel;
	const entity = ENTITY_LABELS[entityType as EntityType] ?? entityType;
	return `${entity} ${actionLabel.toLowerCase()}`;
}

const FIELD_LABELS: Record<string, string> = {
	name: 'Name',
	username: 'Benutzername',
	email: 'E-Mail',
	role: 'Rolle',
	lockedUntil: 'Gesperrt bis',
	failedCount: 'Fehlversuche',
	reason: 'Grund',
	type: 'Typ',
	color: 'Farbe',
	iban: 'IBAN',
	openingBalance: 'Startsaldo',
	openingDate: 'Stand am',
	overdraftLimit: 'Dispo',
	parent: 'Hauptkategorie',
	account: 'Konto',
	kind: 'Art',
	targetAccount: 'Zielkonto',
	counterparty: 'Empfänger/Zahler',
	mandateReference: 'Mandatsreferenz',
	creditorId: 'Gläubiger-ID',
	category: 'Kategorie',
	interval: 'Intervall',
	startDate: 'Start',
	endDate: 'Ende',
	variable: 'Schwankend',
	isSalary: 'Gehalt',
	paymentMethod: 'Zahlart',
	amount: 'Betrag',
	validFrom: 'Gültig ab',
	bookingDate: 'Buchungstag',
	purpose: 'Verwendungszweck',
	pauseFrom: 'Pause ab',
	pauseUntil: 'Pause bis',
	contract: 'Kündbarer Vertrag',
	termEnd: 'Laufzeit bis',
	notice: 'Kündigungsfrist',
	renewal: 'Verlängerung',
	leadDays: 'Vorlauf (Tage)',
	cancelledOn: 'Gekündigt am',
	cancelAddress: 'Kündigungsadresse',
	customerNumber: 'Kundennummer',
	note: 'Notiz',
	fileName: 'Datei',
	size: 'Größe (Bytes)',
	defaultLeadDays: 'Standard-Vorlauf (Tage)',
	shared: 'Für alle',
	position: 'Position'
};

export function fieldLabel(field: string): string {
	return FIELD_LABELS[field] ?? field;
}

const VALUE_LABELS: Record<string, Record<string, string>> = {
	role: { admin: 'Admin', user: 'Benutzer' },
	type: { giro: 'Girokonto', sparbuch: 'Sparbuch' },
	kind: KIND_LABELS,
	paymentMethod: PAYMENT_METHOD_LABELS,
	color: Object.fromEntries(Object.entries(ACCOUNT_COLORS).map(([k, v]) => [k, v.label])),
	reason: {
		locked: 'Anmeldung war gesperrt',
		wrong_credentials: 'Falscher Benutzername oder falsches Passwort'
	}
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const dateTime = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	dateStyle: 'medium',
	timeStyle: 'short'
});

/** Fields stored in cents. */
const CENT_FIELDS = new Set(['openingBalance', 'overdraftLimit', 'amount']);
/** Values that mean the same in every field (access levels). */
const COMMON_VALUES: Record<string, string> = { view: 'Sehen', edit: 'Bearbeiten' };

export function formatFieldValue(field: string, value: unknown): string {
	if (value === null || value === undefined || value === '') return '–';
	if (typeof value === 'number' && CENT_FIELDS.has(field)) return formatEuro(value);
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value))
		return new Date(`${value}T12:00:00Z`).toLocaleDateString('de-DE');
	if (typeof value === 'string' && ISO_DATE.test(value)) return dateTime.format(new Date(value));
	if (typeof value === 'string')
		return VALUE_LABELS[field]?.[value] ?? COMMON_VALUES[value] ?? value;
	if (typeof value === 'boolean') return value ? 'Ja' : 'Nein';
	if (typeof value === 'number') return String(value);
	return JSON.stringify(value);
}
