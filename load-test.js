import http from "k6/http";
import { sleep } from "k6";

export let options = {
  vus: 30,          // 仮想ユーザー数（同時アクセス人数）
  duration: "10s",  // テスト時間
};

export default function () {
  const url = "http://localhost:3000/api/participant"; // テスト対象API
  const payload = JSON.stringify({
    id: `TEST${__VU}`,  // ユニークIDにする
    name: `User${__VU}`,
    className: "月曜3限",
    currentStep: 1,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
  };

  http.post(url, payload, params);
  sleep(1); // 次リクエストまでの待ち時間
}
