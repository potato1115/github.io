const express = require('express');
const webpush = require('web-push');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. VAPIDキーの設定
// ==========================================
const vapidKeys = webpush.generateVAPIDKeys();
webpush.setVapidDetails(
    'mailto:your-email@example.com',
    vapidKeys.publicKey,
    vapidKeys.privateKey
);

console.log('★フロントエンド設定用 PublicKey:', vapidKeys.publicKey);

// ==========================================
// 2. 購読情報の保存とAPIエンドポイント
// ==========================================
let subscriptions = [];

app.get('/vapidPublicKey', (req, res) => {
    res.send(vapidKeys.publicKey);
});

app.post('/subscribe', (req, res) => {
    const subscription = req.body;
    const exists = subscriptions.find(sub => sub.endpoint === subscription.endpoint);
    if (!exists) subscriptions.push(subscription);
    res.status(201).json({ message: '登録完了' });
    console.log(`📱 新規端末が通知登録しました（現在: ${subscriptions.length}台）`);
});

// ==========================================
// ★ ここが追加された「テスト発射口（/test-push）」です！ ★
// ==========================================
app.post('/test-push', (req, res) => {
    console.log("🚨 テスト通知の遠隔リクエストを受信しました");
    const payload = {
        title: "📲 遠隔テスト通知",
        body: "PCからの遠隔テスト送信が正常にスマホへ届きました！\n（プッシュシステムは完璧に稼働しています）"
    };
    subscriptions.forEach(sub => {
        webpush.sendNotification(sub, JSON.stringify(payload))
            .catch(err => console.error("通知送信エラー:", err));
    });
    res.status(200).json({ message: "テスト通知を全端末に送信しました" });
});

// ==========================================
// 3. 地震情報フォーマット生成
// ==========================================
const scaleMap = { "10": "1", "20": "2", "30": "3", "40": "4", "45": "5弱", "50": "5強", "55": "6弱", "60": "6強", "70": "7" };
const issueTypeMap = { "ScalePrompt": "震度速報", "Destination": "震源に関する情報", "ScaleAndDestination": "震源・震度情報", "DetailScale": "各地の震度情報", "Foreign": "遠地地震情報" };

function createPushPayload(data) {
    const e = data.earthquake || {}; const h = e.hypocenter || {}; const issue = data.issue || {}; const pts = data.points || [];
    const typeStr = issueTypeMap[issue.type] || "地震情報";
    const scaleStr = (e.maxScale !== undefined && e.maxScale !== -1) ? scaleMap[e.maxScale] : '調査中';
    const hypName = h.name || '調査中';
    const magStr = (h.magnitude !== undefined && h.magnitude !== -1) ? `M${h.magnitude}` : '調査中';
    const depthStr = (h.depth !== undefined && h.depth !== -1) ? (h.depth === 0 ? "ごく浅い" : `約${h.depth}km`) : '調査中';

    let tsMsg = "津波調査中";
    if (e.domesticTsunami === "None" || e.domesticTsunami === "NonEffective") tsMsg = "津波の心配なし";
    else if (e.domesticTsunami && e.domesticTsunami !== "Unknown" && e.domesticTsunami !== "Checking") tsMsg = "津波情報あり";

    let title = `【${typeStr}】最大震度${scaleStr}`;
    let body = `${hypName}で地震\nマグニチュード: ${magStr} / 震源の深さ: ${depthStr}\n${tsMsg}`;

    if (pts.length > 0) {
        body += `\n\n[観測震度]`;
        const scalePrefMap = {};
        pts.forEach(pt => {
            const s = String(pt.scale);
            const pref = pt.pref || pt.addr.match(/^(.+?[都道府県])/)?.[1] || "不明";
            if (!scalePrefMap[s]) scalePrefMap[s] = new Set();
            scalePrefMap[s].add(pref);
        });

        [70, 60, 55, 50, 45, 40, 30, 20, 10].forEach(s => {
            if (scalePrefMap[s]) body += `\n震度${scaleMap[s]}: ${Array.from(scalePrefMap[s]).join('、')}`;
        });
    }
    return { title, body };
}

// ==========================================
// 4. 地震APIの監視ループ（3秒ごと）
// ==========================================
let lastEventId = null;
async function pollEarthquakeData() {
    try {
        const res = await fetch("https://api.p2pquake.net/v2/history?codes=551&limit=1");
        const data = await res.json();
        const latest = data[0];

        if (latest && latest.id !== lastEventId) {
            if (lastEventId !== null) {
                console.log("🚨 新しい地震情報を検知しました。通知を送信します。");
                const payload = createPushPayload(latest);
                subscriptions.forEach(sub => {
                    webpush.sendNotification(sub, JSON.stringify(payload)).catch(err => console.error(err));
                });
            }
            lastEventId = latest.id;
        }
    } catch (e) {
        // エラーログは省略
    }
}
setInterval(pollEarthquakeData, 3000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 サーバー起動: PORT ${PORT}`);
    console.log(`📡 P2P地震情報の監視を開始しました...`);
});
