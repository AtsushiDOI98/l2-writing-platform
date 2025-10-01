import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    class_simulation: {
      executor: 'per-vu-iterations',
      vus: 30,             // 30人
      iterations: 1,       // 各人は一連の流れを1回
      maxDuration: '10m',  // 10分のプレ授業シナリオ
    },
  },
};

export default function () {
  // ---- 条件割り当て ----
  let condition;
  if (__VU <= 10) {
    condition = "Control";
  } else if (__VU <= 20) {
    condition = "Model text";
  } else {
    condition = "AI-WCF";
  }

  const essay = `The process begins when ripe cocoa pods are collected from the trees...`;

  // ---- 1. 事前作文 (Pre-test 提出) ----
  sleep(30 + Math.floor(Math.random() * 20 - 10));  // 書く時間 ±10秒
  let preRes = http.post("https://l2-writing-platform.onrender.com/api/wcf", JSON.stringify({ text: essay }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(preRes, { "pre status 200": (r) => r.status === 200 });

  // ---- 2. フィードバック閲覧 (API呼び出しなし) ----
  sleep(20);  // フィードバックを読む時間（仮に20秒）

  // ---- 3. 事後作文 (Post-test 提出) ----
  sleep(30 + Math.floor(Math.random() * 20 - 10));
  let postRes = http.post("https://l2-writing-platform.onrender.com/api/wcf", JSON.stringify({ text: essay + " final" }), {
    headers: { 'Content-Type': 'application/json' },
  });
  check(postRes, { "post status 200": (r) => r.status === 200 });

  // ---- レスポンスのサンプル出力（VU1〜3だけ） ----
  if (__VU <= 3) {
    console.log(`VU ${__VU} (${condition}) pre: ${preRes.status}, post: ${postRes.status}`);
  }
}
