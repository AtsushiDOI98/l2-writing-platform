"use client";

import { useState, useEffect } from "react";
import * as XLSX from "xlsx";

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
  const [wlEntries, setWlEntries] = useState<any[]>([]);
  const [posttestText, setPosttestText] = useState("");
  const [surveyAnswers, setSurveyAnswers] = useState<{ [key: string]: number }>({});

  const [brainstormStart, setBrainstormStart] = useState<number | null>(null);
  const [pretestStart, setPretestStart] = useState<number | null>(null);
  const [wlStart, setWlStart] = useState<number | null>(null);
  const [posttestStart, setPosttestStart] = useState<number | null>(null);

  const [brainstormElapsed, setBrainstormElapsed] = useState(0);
  const [pretestElapsed, setPretestElapsed] = useState(0);
  const [wlElapsed, setWlElapsed] = useState(0);
  const [posttestElapsed, setPosttestElapsed] = useState(0);

  // --- タイマー ---
  useEffect(() => {
    const timer = setInterval(() => {
      if (brainstormStart) setBrainstormElapsed(Math.floor((Date.now() - brainstormStart) / 1000));
      if (pretestStart) setPretestElapsed(Math.floor((Date.now() - pretestStart) / 1000));
      if (wlStart) setWlElapsed(Math.floor((Date.now() - wlStart) / 1000));
      if (posttestStart) setPosttestElapsed(Math.floor((Date.now() - posttestStart) / 1000));
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
          id: studentId,
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
        }),
      });
    } catch (error) {
      console.error("保存エラー:", error);
    }
  };

  // --- AI-WCF ---
  const generateWCF = async () => {
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
  };

  // --- 条件処理 ---
  useEffect(() => {
    if (step === 4) {
      if (condition === "Control") {
        setWcfText(pretestText);
        setStep(5);
        setWlStart(Date.now());
      } else if (condition === "Model text") {
        setWcfText(
          "Many young people in the United States actively participate in volunteer work, often joining local community programs or school-based activities.\nIn contrast, Japanese youth tend to have fewer opportunities to engage in volunteering, which may be due to differences in cultural expectations, educational systems, and the availability of volunteer organizations.\nThis suggests that social and institutional factors play a major role in shaping how young people in different countries contribute to their communities."
        );
        setStep(5);
        setWlStart(Date.now());
      } else if (condition === "AI-WCF" && !wcfText) {
        generateWCF().then(() => {
          setStep(5);
          setWlStart(Date.now());
        });
      }
    }
  }, [step, condition, pretestText, wcfText]);

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
        "Reflection(sec)": wlElapsed,
        "Post-Test(sec)": posttestElapsed,
        "Pre-Test(words)": wordCount(pretestText),
        "Post-Test(words)": wordCount(posttestText),
      },
    ]);
    const ws2: XLSX.WorkSheet = XLSX.utils.json_to_sheet(wlEntries);
    const ws3: XLSX.WorkSheet = XLSX.utils.json_to_sheet(
      Object.entries(surveyAnswers).map(([q, a]) => ({ Question: q, Answer: a }))
    );
    const wb: XLSX.WorkBook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Writing Session");
    XLSX.utils.book_append_sheet(wb, ws2, "Reflection");
    XLSX.utils.book_append_sheet(wb, ws3, "Survey");
    XLSX.writeFile(wb, `${className}_${studentId}_${name}.xlsx`);
  };

  // --- アンケート ---
  const surveyQuestions: { [key: string]: string[] } = {
    行動的エンゲージメント: [
      "1.課題をうまくこなすために、必要以上のことをしようとした。",
      "2.集中を保ち、気が散らないように最善を尽くした。",
      "3.課題を終えるために必要なだけの時間をかけた。",
      "4.課題をやり遂げるためにできる限り努力した。",
      "5.課題に積極的に取り組もうとした。",
    ],
    情緒的エンゲージメント: [
      "1.課題をするのは楽しかった。",
      "2.課題をしているとき、興味を感じた。",
      "3.課題をすることで好奇心がかき立てられた。",
      "4.課題をしているとき、楽しいと感じた。",
      "5.課題をしているとき、熱意を感じた。",
    ],
    認知的エンゲージメント: [
      "1.課題中に、重要な概念を自分の言葉で説明しようとした。",
      "2.課題中に、自分の言葉で要約しようとした。",
      "3.課題の内容を、既に知っていることと結び付けようとした。",
      "4.課題を理解しやすくするために、自分で例を作ろうとした。",
      "5.課題中に内容を繰り返したり、自分に問いかけたりした。",
    ],
    主体的エンゲージメント: [
      "1.課題中に、自分に必要なことや望むことを先生に伝えた。",
      "2.課題中に、自分の関心を先生に伝えた。",
      "3.課題中に、自分の好みや意見を表明した。",
      "4.学習の助けになるように、先生に質問をした。",
      "5.必要なときには、先生に頼んだ。",
    ],
    社会的エンゲージメント: [
      "1.課題を行う際に、先生に助けを求めた。",
      "2.課題を行う際に、他の学生に助けを求めた。",
      "3.課題をする間、先生とやり取りすることが重要だと感じた。",
      "4.課題をする間、他の学生とやり取りすることが重要だと感じた。",
      "5.課題を正しくできているか確認するために、先生にフィードバックを求めた。",
    ],
  };

  // --- UI ---
  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">L2 Writing Platform</h1>

      {/* Step 0 */}
{step === 0 && (
  <div>
    <h2 className="text-2xl font-semibold mb-4">
      氏名、学籍番号、授業名を入力してください
    </h2>

    <p className="mb-4 text-gray-700 whitespace-pre-line">
      <strong>
        ※途中でページを閉じたり更新した場合は、
        最初の画面で必ず同じ氏名・学籍番号・授業名を入力してください。{"\n"}
        　これまでの作業内容が復元され、続きから再開できます。
      </strong>
    </p>

    <input
      className="border p-2 w-full mb-2"
      placeholder="名前"
      value={name}
      onChange={(e) => setName(e.target.value)}
    />
    <input
      className="border p-2 w-full mb-2"
      placeholder="学籍番号"
      value={studentId}
      onChange={(e) => setStudentId(e.target.value)}
    />
    <select
      className="border p-2 w-full mb-4"
      value={className}
      onChange={(e) => setClassName(e.target.value)}
    >
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
          try {
            const res = await fetch("/api/participant", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: studentId,
                name,
                className,
                currentStep: 0,
              }),
            });
            const data = await res.json();

            if (data.error) {
              alert("エラー: " + data.error);
              return;
            }

            // サーバー側で割り当てられた condition を反映
            setCondition(data.condition);
            setStep(1);
          } catch (err) {
            console.error(err);
            alert("サーバーとの通信に失敗しました。");
          }
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
          <h2 className="text-2xl font-semibold mb-4">英作文タスクの流れ</h2>
          <ol className="list-decimal pl-6 space-y-2">
            <li>ブレインストーミング (10分)</li>
            <li>英作文タスク (30分)</li>
            <li>振り返り</li>
            <li>英作文タスク (30分)</li>
            <li>アンケート</li>
          </ol>
          <button className="mt-6 bg-blue-500 text-white px-4 py-2 rounded" onClick={async () => { await saveProgress(); setStep(2); setBrainstormStart(Date.now()); }}>
            ブレインストーミングを開始
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">ブレインストーミング (10分)</h2>
          <p className="mb-2 text-gray-600">
            残り時間: {Math.max(0, 600 - brainstormElapsed) > 0
              ? `${Math.floor((600 - brainstormElapsed) / 60)}:${String((600 - brainstormElapsed) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>
          <p className="mb-4">別紙に記載されている英作文タスクに取り組むにあたり、自身の考えをまとめましょう。以下にアイデアを書いてください。</p>
          <textarea className="border p-2 w-full h-96" value={brainstormText} onChange={(e) => setBrainstormText(e.target.value)} />
          <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded" onClick={async () => { await saveProgress(); setStep(3); setPretestStart(Date.now()); }}>
            次へ (英作文タスク)
          </button>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-4 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 1800 - pretestElapsed) > 0
              ? `${Math.floor((1800 - pretestElapsed) / 60)}:${String((1800 - pretestElapsed) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">ブレインストーミングの内容</h3>
              <div className="border p-2 h-96 overflow-y-auto whitespace-pre-line bg-white">
                {brainstormText}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">英作文を書いてください</h3>
              <textarea
                className="border p-2 w-full h-96"
                value={pretestText}
                onChange={(e) => setPretestText(e.target.value)}
              />
              <p className="text-right mt-1 text-sm text-gray-500">単語数: {wordCount(pretestText)}</p>
              <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded" onClick={async () => { await saveProgress(); setStep(4); }}>
                次へ (振り返り準備)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5 */}
      {step === 5 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">振り返り</h2>
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold">指示</h3>
              <p className="text-sm mb-2">
                フィードバックを参照しながら自身の英作文を読み返し、誤りを特定してください。<br />
                それぞれの言語形式がなぜ誤っているのか、説明してください。<br />
                また、フィードバックと自身の英作文を比較し、気づいたことや考えたことを記入してください。<br />
                記入の際は、例にならって４つの項目を記入してください。<br />
                「➕ Add」を押すと記録され、新しく記入できます。
              </p>
            </div>
            <div>
              <h3 className="font-semibold">例</h3>
              <table className="table-auto border-collapse border text-sm">
                <thead>
                  <tr>
                    <th className="border px-2">誤り</th>
                    <th className="border px-2">フィードバック</th>
                    <th className="border px-2">コード</th>
                    <th className="border px-2">説明</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border px-2">He go</td>
                    <td className="border px-2">He goes</td>
                    <td className="border px-2">GR</td>
                    <td className="border px-2">主語と動詞の一致の誤り</td>
                  </tr>
                </tbody>
              </table>
              <p className="mt-2 text-sm">
                <strong>コード:</strong> L=語彙 | GR=文法 | SP=スペル | P=句読点 | O=その他
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="font-semibold mb-2">元の文 (Pre-Test)</h3>
              <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">{pretestText}</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">{condition}</h3>
              <div className="border p-2 h-64 overflow-y-auto whitespace-pre-line bg-white">{wcfText}</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="grid grid-cols-4 gap-2 mb-2">
              <input id="err" className="border p-1" placeholder="誤り" />
              <input id="cor" className="border p-1" placeholder="修正" />
              <select id="code" className="border p-1">
                <option value="">コード</option>
                <option value="L">L</option>
                <option value="GR">GR</option>
                <option value="SP">SP</option>
                <option value="P">P</option>
                <option value="O">O</option>
              </select>
              <input id="exp" className="border p-1" placeholder="説明" />
            </div>
            <button
              className="bg-green-500 text-white px-2 py-1 rounded"
              onClick={() => {
                const err = (document.getElementById("err") as HTMLInputElement).value;
                const cor = (document.getElementById("cor") as HTMLInputElement).value;
                const code = (document.getElementById("code") as HTMLSelectElement).value;
                const exp = (document.getElementById("exp") as HTMLInputElement).value;
                if (err && cor && code) {
                  setWlEntries([...wlEntries, { 誤り: err, 修正: cor, コード: code, 説明: exp }]);
                  (document.getElementById("err") as HTMLInputElement).value = "";
                  (document.getElementById("cor") as HTMLInputElement).value = "";
                  (document.getElementById("code") as HTMLSelectElement).value = "";
                  (document.getElementById("exp") as HTMLInputElement).value = "";
                }
              }}
            >
              ➕ Add
            </button>
          </div>

          {wlEntries.length > 0 && (
            <table className="table-auto border-collapse border w-full text-sm mb-6">
              <thead>
                <tr>
                  <th className="border px-2">誤り</th>
                  <th className="border px-2">修正</th>
                  <th className="border px-2">コード</th>
                  <th className="border px-2">説明</th>
                </tr>
              </thead>
              <tbody>
                {wlEntries.map((e, i) => (
                  <tr key={i}>
                    <td className="border px-2">{e.誤り}</td>
                    <td className="border px-2">{e.修正}</td>
                    <td className="border px-2">{e.コード}</td>
                    <td className="border px-2">{e.説明}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button className="bg-blue-500 text-white px-4 py-2 rounded" onClick={async () => { await saveProgress(); setStep(6); setPosttestStart(Date.now()); }}>
            次へ (英作文タスク)
          </button>
        </div>
      )}

      {/* Step 6 */}
      {step === 6 && (
        <div>
          <h3 className="font-semibold mb-2">英作文タスク (30分)</h3>
          <p className="mb-4 font-semibold">
            指示: 自身の書いた英作文を必要に応じて修正し、書き直してください。
          </p>
          <p className="mb-4 text-gray-600">
            残り時間:{" "}
            {Math.max(0, 1800 - posttestElapsed) > 0
              ? `${Math.floor((1800 - posttestElapsed) / 60)}:${String((1800 - posttestElapsed) % 60).padStart(2, "0")}`
              : "00:00"}
          </p>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">元の文 (Pre-Test)</h3>
              <div className="border p-2 h-96 overflow-y-auto whitespace-pre-line bg-white">{pretestText}</div>
            </div>
            <div>
              <h3 className="font-semibold mb-2">英作文を書いてください</h3>
              <textarea
                className="border p-2 w-full h-96"
                value={posttestText}
                onChange={(e) => setPosttestText(e.target.value)}
              />
              <p className="text-right mt-1 text-sm text-gray-500">単語数: {wordCount(posttestText)}</p>
              <button className="mt-4 bg-blue-500 text-white px-4 py-2 rounded" onClick={async () => { await saveProgress(); setStep(7); }}>
                次へ (アンケート)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 7 */}
      {step === 7 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">アンケート</h2>
          <p>
            以下の各項目について、<strong>1（全くそう思わない）～5（非常にそう思う）</strong> で答えてください。
          </p>
          {Object.entries(surveyQuestions).map(([cat, qs]) => (
            <div key={cat} className="mt-6">
              <h3 className="text-lg font-semibold">{cat}</h3>
              {qs.map((q) => (
                <div key={q} className="my-2">
                  <p>{q}</p>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <label key={n} className="mr-4">
                      <input type="radio" name={q} value={n} checked={surveyAnswers[q] === n} onChange={() => setSurveyAnswers({ ...surveyAnswers, [q]: n })} /> {n}
                    </label>
                  ))}
                </div>
              ))}
            </div>
          ))}
          <button
            className="mt-6 bg-blue-600 text-white px-4 py-2 rounded"
            onClick={async () => {
              if (Object.keys(surveyAnswers).length < Object.values(surveyQuestions).flat().length) {
                alert("すべての項目に回答してください。");
              } else {
                await saveProgress();
                setStep(8);
              }
            }}
          >
            送信(次のページへ)
          </button>
        </div>
      )}

      {/* Step 8 */}
      {step === 8 && (
        <div>
          <h2 className="text-2xl font-semibold">完了</h2>
          <p className="mb-4">すべてのステップが完了しました。以下のボタンからデータをダウンロードし、担当者に提出してください。</p>
          <button className="bg-blue-600 text-white px-4 py-2 rounded" onClick={downloadExcel}>
            結果をExcelでダウンロード
          </button>
        </div>
      )}
    </div>
  );
}
