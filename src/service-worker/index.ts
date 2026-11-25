// Caches only the app shell (build output and static files) so the installed PWA starts fast.
// Financial data and pages are never cached: they always come from the server.
import { self } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

const CACHE = `kp-shell-${version}`;
const SHELL = [...immutable.map((f) => f.path), ...assets.map((f) => f.path)];
// Manifest paths are relative to the base path; compare by absolute pathname.
const SHELL_SET = new Set<string>(SHELL.map((p) => new URL(p, self.registration.scope).pathname));

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(CACHE)
			.then((cache) => cache.addAll(SHELL))
			.then(() => self.skipWaiting())
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener('fetch', (event) => {
	const { request } = event;
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin || !SHELL_SET.has(url.pathname)) return;

	event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});

// Web push: show the message; tapping it opens the page it belongs to.
type PushMessage = { title?: string; body?: string; url?: string };

self.addEventListener('push', (event) => {
	let message: PushMessage;
	try {
		message = (event.data?.json() as PushMessage | undefined) ?? {};
	} catch {
		message = { body: event.data?.text() };
	}
	event.waitUntil(
		self.registration.showNotification(message.title || 'Konto Planer', {
			body: message.body ?? '',
			icon: new URL('icons/icon-192.png', self.registration.scope).href,
			data: { url: message.url ?? '' }
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const path = (event.notification.data as { url?: string } | null)?.url ?? '';
	const target = new URL(path.replace(/^\/+/, ''), self.registration.scope);
	// Only pages of this app.
	const url = target.origin === self.location.origin ? target.href : self.registration.scope;
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (list) => {
			const open = list.find((c) => c.url.startsWith(self.registration.scope));
			if (open) {
				await open.focus();
				return open.navigate(url);
			}
			return self.clients.openWindow(url);
		})
	);
});
