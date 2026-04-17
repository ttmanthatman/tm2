/**
 * TeamChat 推送通知客户端
 * Service Worker 注册、推送订阅
 */
let swReg = null, pushSub = null;

async function initSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    swReg = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    swReg.update().catch(() => {});
    if (!swReg.active) swReg = await navigator.serviceWorker.ready;
  } catch(e) {}
}

async function checkPush() {
  if (!swReg || !('PushManager' in window)) {
    return { supported: false, subscribed: false, reason: '不支持推送' };
  }
  if ('Notification' in window && Notification.permission === 'denied') {
    return { supported: true, subscribed: false, reason: '通知权限已拒绝' };
  }
  try {
    const sub = await swReg.pushManager.getSubscription();
    if (sub) {
      pushSub = sub;
      if (store.token) {
        fetch(API + '/api/push/subscribe', {
          method: 'POST',
          headers: authH({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ subscription: sub.toJSON() })
        }).catch(() => {});
      }
      return { supported: true, subscribed: true };
    }
    return { supported: true, subscribed: false };
  } catch(e) {
    return { supported: false, subscribed: false, reason: e.message };
  }
}

async function togglePush() {
  if (pushSub) {
    const ep = pushSub.endpoint;
    await pushSub.unsubscribe();
    fetch(API + '/api/push/unsubscribe', {
      method: 'POST',
      headers: authH({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ endpoint: ep })
    }).catch(() => {});
    pushSub = null;
    return false;
  }

  const kr = await fetch(API + '/api/push/vapid-key');
  const kd = await kr.json();
  if (!kd.publicKey) { alert('服务器推送未配置'); return false; }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return false;

  if (!swReg) await initSW();
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: Uint8Array.from(
      atob(kd.publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - kd.publicKey.length % 4) % 4)),
      c => c.charCodeAt(0)
    )
  });

  await fetch(API + '/api/push/subscribe', {
    method: 'POST',
    headers: authH({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ subscription: sub.toJSON() })
  });

  pushSub = sub;
  return true;
}
