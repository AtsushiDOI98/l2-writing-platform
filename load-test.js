import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  scenarios: {
    staggered_registration: {
      executor: "per-vu-iterations",
      vus: 30,          // 30人
      iterations: 1,    // 全員1回だけ実行
    }
  }
};

const CLASSES = ["月曜3限", "月曜4限", "木曜3限", "木曜4限"];
const API_BASE = __ENV.API_BASE_URL || "https://l2-writing-platform.onrender.com";

export default function () {
  // 🌟 0.5〜1.0秒のランダム遅延
  sleep(Math.random() * 0.5 + 0.5);  
  //            0〜0.5       +0.5 → 0.5〜1.0秒

  const uniqueSuffix = `${__VU}-${Date.now()}`;
  const payload = {
    studentId: `stu-${uniqueSuffix}`,
    name: `テスター${String(__VU).padStart(2, "0")}`,
    className: CLASSES[(__VU - 1) % CLASSES.length],
    condition: null,
    currentStep: 0,
    brainstorm: "",
    pretest: "",
    wcfResult: "",
    posttest: "",
    survey: {},
  };

  const res = http.post(
    `${API_BASE}/api/participant`,
    JSON.stringify(payload),
    { headers: { "Content-Type": "application/json" } }
  );

  let body;
  try {
    body = res.json();
  } catch (_) {
    body = null;
  }

  check(res, {
    "status is 200": (r) => r.status === 200,
    "id echoed back": () => body?.id === payload.studentId,
    "condition assigned": () =>
      typeof body?.condition === "string" && body.condition.length > 0,
  });

  if (__VU <= 3) {
    console.log(
      `VU ${__VU}: status=${res.status}, condition=${body?.condition || "N/A"}`
    );
  }
}
