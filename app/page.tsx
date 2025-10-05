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
      setStep(parsed.step ?? 0);
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
  const saveProgress = async () => {
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
  };

  // --- AI-WCF ---
  const generateWCF = useCallback(async () => {
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
    }
  }, [pretestText]);

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
      setWcfText(`
Chocolate is one of the most popular sweets in the world.
It is made from cacao beans through many careful steps.

First, farmers wait until the cacao pods are ripe.
Then they harvest the pods and take out the cacao beans.
The beans are dried in the sun and packed into a sack.
After that, workers weigh the sacks and heave them onto trucks for transport to a factory.

At the factory, the beans are cleaned and roasted to bring out a rich smell.
Then, the thin layer of shell is removed.
The inside part is ground to pulverize the beans.
Next, machines agitate the mixture to make it smooth and creamy.
Finally, the chocolate is poured into a mold to give it its shape.

After cooling, the chocolate is wrapped and ready to be enjoyed by people all over the world.
Making chocolate takes time, care, and skill, but the result is delicious.
`);
      setStep(5);
      setWlStart(Date.now());
    } else if (cond === "ai-wcf" && !wcfText) {
      generateWCF().then(() => {
        setStep(5);
        setWlStart(Date.now());
      });
    }
  }
}, [step, condition, pretestText, wcfText, generateWCF]);

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
                setCondition(data.condition ?? null);
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
          <p className="mb-4 text-lg font-semibold text-red-600">あなたは「{condition}」グループに割り振られました</p>
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
          <p className="mb-4 text-gray-700">別紙の英作文タスクを参照しながら自身のアイデアを整理し、以下の記入欄にアイデアを書いてください。</p>
          <p className="mb-2 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 600 - brainstormTimer) > 0
              ? `${Math.floor((600 - brainstormTimer) / 60)}:${String((600 - brainstormTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <textarea className="border p-2 w-full h-96" value={brainstormText} onChange={(e) => setBrainstormText(e.target.value)} />
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              if (brainstormStart) setBrainstormElapsed(Math.floor((Date.now() - brainstormStart) / 1000));
              setPretestStart(Date.now());
              setStep(3);
              saveProgress();
            }}
          >
            次へ (英作文タスク)
          </button>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-4 text-gray-700">別紙の英作文タスクと自身のブレインストーミングを参照し、英作文を書いてください。</p>
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
            onClick={() => {
              if (pretestStart) setPretestElapsed(Math.floor((Date.now() - pretestStart) / 1000));
              setStep(4);
              saveProgress();
            }}
          >
            次へ (振り返り準備)
          </button>
        </div>
      )}

      {/* Step 5 振り返り */}
{step === 5 && (
  <div>
    <h2 className="text-2xl font-semibold mb-4">振り返り</h2>

    {condition === "Control" && (
      <p className="mb-4 text-gray-700">
        自身の英作文を読み返し、正しく書けているか確認してください。
      </p>
    )}
    {condition === "Model text" && (
      <p className="mb-4 text-gray-700">
        自身の英作文とモデル文を比較して、どのように修正すべきか考えてください。
      </p>
    )}
    {condition === "AI-WCF" && (
      <p className="mb-4 text-gray-700">
        自身の英作文とAIによるWCFを比較して、どのように修正すべきか考えてください。
      </p>
    )}

    {/* レイアウト切り替え */}
    <div
      className={`mb-6 ${
        condition?.toLowerCase() === "control"
          ? "grid grid-cols-1"
          : "grid grid-cols-2 gap-6"
      }`}
    >
      {/* 左：元の文 */}
      <div>
        <h3 className="font-semibold mb-2">元の文 (Pre-Test)</h3>
        <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">
          {pretestText}
        </div>
      </div>

      {/* 右：Model text / AI-WCF のみ */}
      {condition?.toLowerCase() !== "control" && (
        <div>
          <h3 className="font-semibold mb-2">{condition}</h3>
          <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">
            {wcfText}
          </div>
        </div>
      )}
    </div>

    {/* 残り時間表示 */}
    <p className="mb-2 text-gray-600">
      残り時間:{" "}
      {Math.max(0, 600 - wlTimer) > 0
        ? `${Math.floor((600 - wlTimer) / 60)}:${String(
            (600 - wlTimer) % 60
          ).padStart(2, "0")}`
        : "00:00"}
    </p>

    <button
      className="bg-blue-500 text-white px-4 py-2 rounded"
      onClick={() => {
        if (wlStart) setWlElapsed(Math.floor((Date.now() - wlStart) / 1000));
        setPosttestStart(Date.now());
        setStep(6);
        saveProgress();
      }}
    >
      次へ (英作文タスク)
    </button>
  </div>
)}


      {/* Step 6 */}
      {step === 6 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-4 text-gray-700">自身が書いた英作文を参照し、書き直してください。</p>
          <p className="mb-4 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 1800 - posttestTimer) > 0
              ? `${Math.floor((1800 - posttestTimer) / 60)}:${String((1800 - posttestTimer) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">前回の英作文 (Pre-Test)</h3>
              <div className="border p-2 h-96 overflow-y-auto whitespace-pre-line bg-white">{pretestText}</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">修正版の英作文 (Post-Test)</h3>
              <textarea className="border p-2 w-full h-96" value={posttestText} onChange={(e) => setPosttestText(e.target.value)} />
              <p className="text-right mt-1 text-sm text-gray-500">単語数: {wordCount(posttestText)}</p>
            </div>
          </div>
          <button
            className="mt-4 bg-blue-500 text-white px-4 py-2 rounded"
            onClick={() => {
              if (posttestStart) setPosttestElapsed(Math.floor((Date.now() - posttestStart) / 1000));
              setStep(7);
              saveProgress();
            }}
          >
            次へ (アンケート)
          </button>
        </div>
      )}

      {/* Step 7 アンケート */}
      {step === 7 && (
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
                setStep(8);
                saveProgress();
              }
            }}
          >
            送信 (次のページへ)
          </button>
        </div>
      )}

      {/* Step 8 完了 */}
      {step === 8 && (
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
