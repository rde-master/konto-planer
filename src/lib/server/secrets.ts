import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Key for stored credentials (SMTP password, Home Assistant token): from APP_SECRET, otherwise a
 * random key created once in the data volume (`secret.key`).
 */
function key(): Buffer {
	const env = process.env.APP_SECRET?.trim();
	if (env) return createHash('sha256').update(env).digest();
	const dir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
	const file = path.join(dir, 'secret.key');
	try {
		return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64');
	} catch {
		mkdirSync(dir, { recursive: true });
		const fresh = randomBytes(32);
		writeFileSync(file, fresh.toString('base64'), { mode: 0o600 });
		return fresh;
	}
}

let cached: Buffer | undefined;
const secretKey = () => (cached ??= key());

/** AES-256-GCM: "v1:<iv>:<tag>:<data>" (base64). */
export function encrypt(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
	const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	return [
		'v1',
		iv.toString('base64'),
		cipher.getAuthTag().toString('base64'),
		data.toString('base64')
	].join(':');
}

/** Decrypts; null if the value cannot be read (e.g. the key changed). */
export function decrypt(value: string | null): string | null {
	if (!value) return null;
	const [v, iv, tag, data] = value.split(':');
	if (v !== 'v1' || !iv || !tag || !data) return null;
	try {
		const decipher = createDecipheriv('aes-256-gcm', secretKey(), Buffer.from(iv, 'base64'));
		decipher.setAuthTag(Buffer.from(tag, 'base64'));
		return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString(
			'utf8'
		);
	} catch {
		return null;
	}
}
