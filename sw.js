self.addEventListener('install', (e) => {
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(self.clients.claim());
});

// ★ サーバーからプッシュ通知を受信したときの処理
self.addEventListener('push', (e) => {
    if (e.data) {
        const data = e.data.json();
        const options = {
            body: data.body,
            icon: 'icon.png',
            badge: 'icon.png', // Android等用のステータスバーアイコン
            vibrate: [200, 100, 200, 100, 200], // バイブレーション
            data: { url: '/' } // 通知をタップした時に開くURL
        };

        // 通知をスマホの画面に表示！
        e.waitUntil(self.registration.showNotification(data.title, options));
    }
});

// ★ 通知がタップされたときの処理（アプリを開く）
self.addEventListener('notificationclick', (e) => {
    e.notification.close();
    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            for (let i = 0; i < windowClients.length; i++) {
                let client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
