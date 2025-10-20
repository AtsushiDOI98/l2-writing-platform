"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";

// --- 型定義 ---
type WLEntry = {
  誤り: string;
  修正: string;
  コード: string;
  説明: string;
};

export default function WritingPlatform() {
  // --- state 定義 ---
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [className, setClassName] = useState("");
  const [condition, setCondition] = useState<string | null>(null);

  const [brainstormText, setBrainstormText] = useState("");
  const [pretestText, setPretestText] = useState("");
  const [wcfText, setWcfText] = useState("");
  const [wcfLoading, setWcfLoading] = useState(false);
  const [wlEntries, setWlEntries] = useState<WLEntry[]>([]);
  const [posttestText, setPosttestText] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<{ [key: string]: number }>({});

  // --- 各ステップ開始時間と経過時間 ---
  const [brainstormStart, setBrainstormStart] = useState<number | null>(null);
  const [pretestStart, setPretestStart] = useState<number | null>(null);
  const [wlStart, setWlStart] = useState<number | null>(null);
  const [posttestStart, setPosttestStart] = useState<number | null>(null);

  const [brainstormElapsed, setBrainstormElapsed] = useState(0);
  const [pretestElapsed, setPretestElapsed] = useState(0);
  const [wlElapsed, setWlElapsed] = useState(0);
  const [posttestElapsed, setPosttestElapsed] = useState(0);

  // --- タイマー用リアルタイム秒数 ---
  const [brainstormTimer, setBrainstormTimer] = useState(0);
  const [pretestTimer, setPretestTimer] = useState(0);
  const [wlTimer, setWlTimer] = useState(0);
  const [posttestTimer, setPosttestTimer] = useState(0);

  // --- localStorage に保存 ---
  useEffect(() => {
    const state = {
      step,
      name,
      studentId,
      className,
      condition,
      brainstormText,
      pretestText,
      wcfText,
      wlEntries,
      posttestText,
      surveyAnswers,
      brainstormElapsed,
      pretestElapsed,
      wlElapsed,
      posttestElapsed,
      stateVersion: 2,
    };
    localStorage.setItem("writingPlatformState", JSON.stringify(state));
  }, [
    step,
    name,
    studentId,
    className,
    condition,
    brainstormText,
    pretestText,
    wcfText,
    wlEntries,
    posttestText,
    surveyAnswers,
    brainstormElapsed,
    pretestElapsed,
    wlElapsed,
    posttestElapsed,
  ]);

  // --- localStorage から復元 ---
  useEffect(() => {
    const saved = localStorage.getItem("writingPlatformState");
    if (saved) {
      const parsed = JSON.parse(saved);
      const version = parsed.stateVersion ?? 1;
      let restoredStep = parsed.step ?? 0;
      if (version < 2 && typeof restoredStep === "number" && restoredStep >= 7) {
        restoredStep += 1;
      }
      setStep(restoredStep);
      setName(parsed.name ?? "");
      setStudentId(parsed.studentId ?? "");
      setClassName(parsed.className ?? "");
      setCondition(parsed.condition ?? null);
      setBrainstormText(parsed.brainstormText ?? "");
      setPretestText(parsed.pretestText ?? "");
      setWcfText(parsed.wcfText ?? "");
      setWlEntries(parsed.wlEntries ?? []);
      setPosttestText(parsed.posttestText ?? "");
      setSurveyAnswers(parsed.surveyAnswers ?? {});
      setBrainstormElapsed(parsed.brainstormElapsed ?? 0);
      setPretestElapsed(parsed.pretestElapsed ?? 0);
      setWlElapsed(parsed.wlElapsed ?? 0);
      setPosttestElapsed(parsed.posttestElapsed ?? 0);
    }
  }, []);

  // --- タイマー (残り時間をリアルタイムで更新) ---
  useEffect(() => {
    const timer = setInterval(() => {
      if (brainstormStart) setBrainstormTimer(Math.floor((Date.now() - brainstormStart) / 1000));
      if (pretestStart) setPretestTimer(Math.floor((Date.now() - pretestStart) / 1000));
      if (wlStart) setWlTimer(Math.floor((Date.now() - wlStart) / 1000));
      if (posttestStart) setPosttestTimer(Math.floor((Date.now() - posttestStart) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [brainstormStart, pretestStart, wlStart, posttestStart]);

  // --- API保存処理 ---
  const saveProgress = useCallback(async () => {
    if (!studentId) return;
    try {
      await fetch("/api/participant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId,
          name,
          className,
          condition,
          currentStep: step,
          brainstorm: brainstormText,
          pretest: pretestText,
          wcfResult: wcfText,
          posttest: posttestText,
          survey: surveyAnswers,
          wlEntries,
          brainstormElapsed,
          pretestElapsed,
          wlElapsed,
          posttestElapsed,
        }),
      });
    } catch (error) {
      console.error("保存エラー:", error);
    }
  }, [
    studentId,
    name,
    className,
    condition,
    step,
    brainstormText,
    pretestText,
    wcfText,
    posttestText,
    surveyAnswers,
    wlEntries,
    brainstormElapsed,
    pretestElapsed,
    wlElapsed,
    posttestElapsed,
  ]);

  // --- AI-WCF ---
  const generateWCF = useCallback(async () => {
    setWcfLoading(true);
    try {
      const res = await fetch("/api/wcf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pretestText }),
      });
      const data = await res.json();
      if (data.result) {
        setWcfText(data.result);
      } else {
        setWcfText("エラー: フィードバックを生成できませんでした。");
      }
    } catch {
      setWcfText("エラー: API呼び出しに失敗しました。");
    } finally {
      setWcfLoading(false);
    }
  }, [pretestText]);

  // --- ステップ遷移 ---
  const goToPretest = useCallback(() => {
    if (step !== 2) return;
    if (brainstormStart) {
      setBrainstormElapsed(Math.floor((Date.now() - brainstormStart) / 1000));
    }
    setPretestStart(Date.now());
    setStep(3);
    saveProgress();
  }, [brainstormStart, saveProgress, step]);

  const goToReflectionPreparation = useCallback(() => {
    if (step !== 3) return;
    if (pretestStart) {
      setPretestElapsed(Math.floor((Date.now() - pretestStart) / 1000));
    }
    setStep(4);
    saveProgress();
  }, [pretestStart, saveProgress, step]);

  const goToPosttest = useCallback(() => {
    if (step !== 5) return;
    if (wlStart) {
      setWlElapsed(Math.floor((Date.now() - wlStart) / 1000));
    }
    setPosttestStart(Date.now());
    setStep(6);
    saveProgress();
  }, [saveProgress, step, wlStart]);

  const goToSurveyInstructions = useCallback(() => {
    if (step !== 6) return;
    if (posttestStart) {
      setPosttestElapsed(Math.floor((Date.now() - posttestStart) / 1000));
    }
    setStep(7);
    saveProgress();
  }, [posttestStart, saveProgress, step]);

  const goToSurvey = useCallback(() => {
    if (step !== 7) return;
    setStep(8);
    saveProgress();
  }, [saveProgress, step]);

  // --- 条件処理 ---
useEffect(() => {
  if (step === 4 && condition) {
    // すべて小文字に変換して比較（表記ゆれ防止）
    const cond = condition.trim().toLowerCase();

    if (cond === "control") {
      setWcfText("");
      setStep(5);
      setWlStart(Date.now());
    } else if (cond === "model text") {
      setWcfText(`Chocolate is one of the most popular sweets in the world, but making it takes many careful steps from cacao pods to a chocolate bar. First, the cocoa pods must become ripe before farmers can harvest them. After that, they open the pods and take out the beans. The beans are put into a sack, and workers weigh each one to check the amount. Then, they heave the heavy sacks onto a truck and send them to a factory.

At the factory, the beans are roasted to give them a good smell. Next, the outer shell is removed, and the inside part is pulverized into fine powder. The powder is then mixed and agitated with other ingredients, such as sugar and milk, to make a smooth liquid. Finally, the liquid chocolate is poured into a mold and left to cool.

After these fifteen steps, the chocolate is ready to eat and delivered to stores.

`);
      setStep(5);
      setWlStart(Date.now());
    } else if (cond === "ai-wcf") {
      // Step 4で待機し、生成完了後にStep 5へ遷移
      if (!wcfText && !wcfLoading) {
        setWcfText("");
        setWcfLoading(true);
        generateWCF().then(() => {
          setWlStart(Date.now());
          setStep(5);
        });
      } else if (wcfText) {
        setWlStart(Date.now());
        setStep(5);
      }
    }
  }
}, [step, condition, pretestText, wcfText, generateWCF]);

  // --- タイマー終了時の自動遷移 ---
  useEffect(() => {
    if (step === 2 && brainstormStart && brainstormTimer >= 600) {
      goToPretest();
    }
  }, [brainstormStart, brainstormTimer, goToPretest, step]);

  useEffect(() => {
    if (step === 3 && pretestStart && pretestTimer >= 1800) {
      goToReflectionPreparation();
    }
  }, [goToReflectionPreparation, pretestStart, pretestTimer, step]);

  useEffect(() => {
    if (step === 5 && wlStart && wlTimer >= 600) {
      goToPosttest();
    }
  }, [goToPosttest, step, wlStart, wlTimer]);

  useEffect(() => {
    if (step === 6 && posttestStart && posttestTimer >= 1800) {
      goToSurveyInstructions();
    }
  }, [goToSurveyInstructions, posttestStart, posttestTimer, step]);

  // --- 単語数 ---
  const wordCount = (text: string) => {
    return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  };

  // --- Excel 出力 ---
  const downloadExcel = () => {
    const ws1: XLSX.WorkSheet = XLSX.utils.json_to_sheet([
      {
        名前: name,
        学籍番号: studentId,
        授業名: className,
        条件: condition,
        "① Brainstorming": brainstormText,
        "② Pre-Test": pretestText,
        "③ Condition結果": wcfText,
        "⑤ Post-Test": posttestText,
        "Brainstorm(sec)": brainstormElapsed,
        "Pre-Test(sec)": pretestElapsed,
        "Reflection(sec)": wlElapsed, // 
        "Post-Test(sec)": posttestElapsed,
        "Pre-Test(words)": wordCount(pretestText),
        "Post-Test(words)": wordCount(posttestText),
      },
    ]);

    const ws3: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      Object.entries(surveyAnswers).map(([q, a]) => ({
        Question: q,
        Answer: a,
      }))
    );

    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Writing Session");
    XLSX.utils.book_append_sheet(wb, ws3, "Survey");
    XLSX.writeFile(wb, `${className}_${studentId}_${name}.xlsx`);
  };

  // --- アンケート質問 ---
  const surveyQuestions: { [key: string]: string[] } = {
    アンケート項目: [
      "今行ったタスクは楽しかった。",
      "課題中に内容を繰り返したり、自分に問いかけたりした。",
      "課題を終えるために必要なだけの時間をかけた。",
      "タスクがよく出来たと誇りに思い、嬉しくて胸がドキドキした。",
      "課題中に、自分に必要なことや望むことを先生に伝えた。",
      "今行ったタスクは楽しくて、参加していて元気が出た。",
      "タスクを行っている時、相手にきちんと伝わるかドキドキした。",
      "課題中に、自分の関心を先生に伝えた。",
      "今行ったタスクが早く終わって欲しいとソワソワした。",
      "今行ったタスクは、難しかった。",
      "タスクで使った自分の英語は誇りに思えるものだ。",
      "課題を行う際に、他の学生に助けを求めた。",
      "学習の助けになるように、先生に質問をした。",
      "今行ったタスクで不安を感じた。",
      "タスクを行っている際、こんな退屈なタスクをやるよりも他にできることを考えていた。",
      "タスク中、英語を間違えるのが心配だった。",
      "タスク中に退屈さを感じた。",
      "タスク中、英語を話すことに緊張した。",
      "課題中に、自分の好みや意見を表明した。",
      "タスクを達成したことを誇りに思っているので、意欲的に英語学習を続けられる。",
      "課題を正しくできているか確認するために、先生にフィードバックを求めた。",
      "今行ったタスクは、簡単だった。",
      "今行ったタスクは、手ごわかった。",
      "集中を保ち、気が散らないように最善を尽くした。",
      "課題をやり遂げるためにできる限り努力した。",
      "今行ったタスクは面白かったので、積極的に参加したくなった。",
      "必要なときには、先生に頼んだ。",
      "今行ったタスクはつまらなかった。",
      "課題の内容を、既に知っていることと結び付けようとした。",
      "課題を行う際に、先生に助けを求めた。",
      "今行ったタスクは、楽だった。",
      "課題中に、自分の言葉で要約しようとした。",
      "課題をする間、先生とやり取りすることが重要だと感じた。",
      "タスクを行っている自分を誇りに思った。",
      "課題をうまくこなすために、必要以上のことをしようとした。",
      "課題を理解しやすくするために、自分で例を作ろうとした。",
      "課題に積極的に取り組もうとした。",
      "課題をする間、他の学生とやり取りすることが重要だと感じた。",
      "課題中に、重要な概念を自分の言葉で説明しようとした。",
      "今行ったようなタスクをまた行うことが楽しみになった。",
    ],
  };

  // --- UI ---
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">L2 Writing Platform</h1>

      {/* Step 0 */}
      {step === 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">氏名、学籍番号、授業名を入力してください</h2>
          <input className="border p-2 w-full mb-2" placeholder="名前" value={name} onChange={(e) => setName(e.target.value)} />
          <input className="border p-2 w-full mb-2" placeholder="学籍番号" value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          <select className="border p-2 w-full mb-4" value={className} onChange={(e) => setClassName(e.target.value)}>
            <option value="">授業名を選択してください</option>
            <option value="月曜3限">月曜3限</option>
            <option value="月曜4限">月曜4限</option>
            <option value="木曜3限">木曜3限</option>
            <option value="木曜4限">木曜4限</option>
          </select>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={async () => {
              if (name.trim() && studentId.trim() && className !== "") {
                const res = await fetch("/api/participant", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    studentId,
                    name,
                    className,
                    condition,
                    currentStep: 0,
                    brainstorm: brainstormText,
                    pretest: pretestText,
                    wcfResult: wcfText,
                    posttest: posttestText,
                    survey: surveyAnswers,
                    wlEntries,
                    brainstormElapsed,
                    pretestElapsed,
                    wlElapsed,
                    posttestElapsed,
                  }),
                });
                const data = await res.json();
                setCondition(
                  data && data.condition
                    ? String(data.condition).trim().toLowerCase()
                    : null
                );
                setStep(1);
              } else {
                alert("氏名、学籍番号、授業名をすべて入力してください。");
              }
            }}
          >
            次へ (指示ページ)
          </button>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div>
          <p className="mb-4 text-lg font-semibold text-red-600">あなたは「{(() => {
            const c = (condition || "").trim().toLowerCase();
            return c === "control"
              ? "見直し"
              : c === "model text"
              ? "模範解答"
              : c === "ai-wcf"
              ? "AIのフィードバック"
              : condition;
          })()}」グループに割り振られました</p>
          <h2 className="text-2xl font-semibold mb-4">英作文タスクの流れ</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>ブレインストーミング (10分)</li>
            <li>英作文タスク (30分)</li>
            <li>振り返り</li>
            <li>英作文タスク (30分)</li>
            <li>アンケート</li>
          </ol>
          <button
            className="mt-6 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              setBrainstormStart(Date.now());
              setStep(2);
              saveProgress();
            }}
          >
            ブレインストーミングを開始
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">ブレインストーミング (10分)</h2>
          <p className="mb-4 text-gray-700">別紙の英作文タスクを参考にして、自分の考えを整理しましょう。下の記入欄には、英作文に書こうと思う内容をメモしてください。</p>
          <p className="mb-2 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 600 - brainstormTimer) > 0
              ? `${Math.floor((600 - brainstormTimer) / 60)}:${String((600 - brainstormTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <textarea className="border p-2 w-full h-96" value={brainstormText} onChange={(e) => setBrainstormText(e.target.value)} />
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={goToPretest}
          >
            次へ (英作文タスク)
          </button>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-4 text-gray-700">別紙の英作文タスクと自身のブレインストーミングを参照し、英作文を書いてください。その際、機械翻訳や生成AIは使用しないでください。</p>
          <p className="mb-4 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 1800 - pretestTimer) > 0
              ? `${Math.floor((1800 - pretestTimer) / 60)}:${String((1800 - pretestTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">ブレインストーミングの内容</h3>
              <div className="border p-2 h-96 overflow-y-auto whitespace-pre-line bg-white">{brainstormText}</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">英作文を書く</h3>
              <textarea className="border p-2 w-full h-96" value={pretestText} onChange={(e) => setPretestText(e.target.value)} />
              <p className="text-right mt-1 text-sm text-gray-500">単語数: {wordCount(pretestText)}</p>
            </div>
          </div>
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={goToReflectionPreparation}
          >
            次へ (振り返り準備)
          </button>
        </div>
      )}

      {/* Step 4 振り返り準備（AI-WCF待機） */}
      {step === 4 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">振り返りの準備</h2>
          {condition?.trim().toLowerCase() === "ai-wcf" ? (
            <div className="border p-6 bg-white text-gray-700 flex items-center justify-center">
              <div className="flex items-center space-x-3">
                <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span>フィードバックを作成中… 少々お待ちください。</span>
              </div>
            </div>
          ) : (
            <p className="text-gray-700">次の画面を準備しています…</p>
          )}
        </div>
      )}

      {/* Step 5 振り返り */}
      {step === 5 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">振り返り</h2>
          {condition?.trim().toLowerCase() === "control" && (
            <p className="mb-4 text-gray-700">自身の英作文を読み返し、正しく書けているか確認してください。</p>
          )}
          {condition?.trim().toLowerCase() === "model text" && (
            <p className="mb-4 text-gray-700">自身の英作文と模範解答を比較して、どのように修正すべきか考えてください。</p>
          )}
          {condition?.trim().toLowerCase() === "ai-wcf" && (
            <p className="mb-4 text-gray-700">自身の英作文とAIのフィードバックを比較して、どのように修正すべきか考えてください。</p>
          )}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold mb-2">元の文</h3>
              <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">{pretestText}</div>
            </div>
            {condition?.trim().toLowerCase() !== "control" && (
              <div>
                <h3 className="font-semibold mb-2">
                  {(() => {
                    const c = (condition || "").trim().toLowerCase();
                    return c === "control"
                      ? "見直し"
                      : c === "model text"
                      ? "模範解答"
                      : c === "ai-wcf"
                      ? "AIのフィードバック"
                      : condition;
                  })()}
                </h3>
                {condition?.trim().toLowerCase() === "ai-wcf" && wcfLoading ? (
                  <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white flex items-center justify-center text-gray-600">
                    <div className="flex items-center space-x-3">
                      <svg className="animate-spin h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                      </svg>
                      <span>フィードバックを作成中…</span>
                    </div>
                  </div>
                ) : (
                  <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">{wcfText}</div>
                )}
              </div>
            )}
          </div>
          <p className="mb-2 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 600 - wlTimer) > 0
              ? `${Math.floor((600 - wlTimer) / 60)}:${String((600 - wlTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={goToPosttest}
          >
            次へ (英作文タスク)
          </button>
        </div>
      )}

      {/* Step 6 */}
      {step === 6 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-2 text-gray-700">
            別紙の英作文タスクを参照し、英作文を書き直してください。その際、機械翻訳や生成AIは使用しないでください。
          </p>
          <p className="mb-4 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 1800 - posttestTimer) > 0
              ? `${Math.floor((1800 - posttestTimer) / 60)}:${String((1800 - posttestTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <textarea
            className="border p-2 w-full h-96"
            value={posttestText}
            onChange={(e) => setPosttestText(e.target.value)}
          />
          <p className="text-right mt-1 text-sm text-gray-500">単語数: {wordCount(posttestText)}</p>
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={goToSurveyInstructions}
          >
            次へ(担当者の指示)
          </button>
        </div>
      )}

      {/* Step 7 指示画面 */}
      {step === 7 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">次のステップに進む前に</h2>
          <p className="mb-6 text-gray-700">担当者の指示に従ってください。</p>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={goToSurvey}
          >
            アンケートへ進む
          </button>
        </div>
      )}

      {/* Step 8 アンケート */}
      {step === 8 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">アンケート</h2>
          <p>以下の各項目について、<strong>1（全くそう思わない）～5（非常にそう思う）</strong> で答えてください。</p>
          {Object.entries(surveyQuestions).map(([cat, qs]) => (
            <div key={cat} className="mt-6">
              <h3 className="text-lg font-semibold">{cat}</h3>
              {qs.map((q) => (
                <div key={q} className="my-2">
                  <p>{q}</p>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="mr-4">
                      <input
                        type="radio"
                        name={q}
                        value={n}
                        checked={surveyAnswers[q] === n}
                        onChange={() => setSurveyAnswers({ ...surveyAnswers, [q]: n })}
                      />{" "}
                      {n}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              const totalQuestions = Object.values(surveyQuestions).reduce((sum, arr) => sum + arr.length, 0);
              const answeredCount = Object.keys(surveyAnswers).length;
              if (answeredCount < totalQuestions) {
                alert("すべての質問に回答してください。");
              } else {
                setStep(9);
                saveProgress();
              }
            }}
          >
            送信 (次のページへ)
          </button>
        </div>
      )}

      {/* Step 9 完了 */}
      {step === 9 && (
        <div>
          <h2 className="text-2xl font-semibold">完了</h2>
          <p className="mb-4">すべてのステップが完了しました。以下のボタンからデータをダウンロードしてください。</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={downloadExcel}>
            結果をExcelでダウンロード
          </button>
        </div>
      )}
    </div>
  );
}

