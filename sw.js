self.addEventListener('install', (e) => {
    console.log('[Service Worker] インストール完了');
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    console.log('[Service Worker] アクティベート完了');
});

self.addEventListener('fetch', (e) => {
    // キャッシュ処理などを将来入れる場所（今回は空でOK）
});