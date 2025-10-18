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

  // ---- サンプル作文 ----
  const essay = `Chocolate is made from cocoa beans. People pick cocoa fruits from the trees. Then, they open the fruits and take out the beans.

Next, the beans are dried under the sun. The bags go to a chocolate factory and it is measured.

In the factory, the beans are cooked. Then, the outside part is taken off.

The powder is mixed well. Then, it is put into a box with a shape. After some time, it becomes a chocolate bar.

I think making chocolate is fun and exciting.`;

  // ---- 1️⃣ 事前作文 (Pre-test 提出) ----
  sleep(30 + Math.floor(Math.random() * 20 - 10));  // 書く時間 ±10秒

  const preRes = http.post(
    "https://l2-writing-platform.onrender.com/api/wcf",
    JSON.stringify({ text: essay }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(preRes, { "✅ pre status 200": (r) => r.status === 200 });

  // ---- レスポンスのサンプル出力（VU1〜3だけ） ----
  if (__VU <= 3) {
    console.log(`VU ${__VU} (${condition}) pre: ${preRes.status}`);
  }

  // ---- クールダウン ----
  sleep(Math.random() * 5);
}
