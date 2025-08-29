import streamlit as st
import time
from datetime import datetime
import pandas as pd
from io import BytesIO
from openai import OpenAI
from streamlit_autorefresh import st_autorefresh

client = OpenAI(api_key=st.secrets["OPENAI_API_KEY"])

# セッション初期化
default_states = {
    "step": 0,
    "name": "",
    "student_id": "",
    "class_name": "",
    "brainstorm_text": "",
    "pretest_text": "",
    "wcf_text": "",
    "wl_entries": [],  # ← 英語キー
    "posttest_text": "",
    "finished": False,
    "brainstorm_timer_started": False,
    "pretest_timer_started": False,
    "posttest_timer_started": False,
    "brainstorm_start_time": None,
    "pretest_start_time": None,
    "posttest_start_time": None,
    "wl_start_time": None,
    "brainstorm_elapsed": 0,
    "pretest_elapsed": 0,
    "wl_elapsed": 0,
    "posttest_elapsed": 0,
    "survey_answers": {}
}
for key, value in default_states.items():
    if key not in st.session_state:
        st.session_state[key] = value

st.set_page_config(layout="wide")
st.title("L2 Writing Platform")

# Step 0: 学習者情報入力
if st.session_state.step == 0:
    st.subheader("氏名、学籍番号、授業名を入力してください")
    st.session_state.name = st.text_input("名前：", value=st.session_state.name)
    st.session_state.student_id = st.text_input("学籍番号：", value=st.session_state.student_id)

    st.session_state.class_name = st.selectbox(
        "授業名を選択してください：",
        ["", "月曜3限", "月曜4限", "木曜3限", "木曜4限"],
        index=0
    )

    if st.button("次へ (指示ページ)"):
        if st.session_state.name.strip() and st.session_state.student_id.strip() and st.session_state.class_name != "":
            st.session_state.step = 1
        else:
            st.warning("氏名、学籍番号、授業名をすべて入力してください。")

# Step 1: 全体の指示ページ
elif st.session_state.step == 1:
    st.subheader("全体の指示")
    st.markdown("""
    ### 英作文タスクの流れ
    これより、以下の5つのタスクに取り組んでいただきます。
                
    1. **ブレインストーミング (10分)**  
    2. **英作文タスク (30分)**   
    3. **振り返り**  
    4. **英作文タスク (30分)**  
    5. **アンケート**  

    ---
    ブレインストーミングと英作文タスクでは**自動的にタイマーが開始されます**。  
    準備ができたら「次へ」を押してブレインストーミングを開始してください。
    """)
    if st.button("ブレインストーミングを開始"):
        st.session_state.step = 2
        st.session_state.brainstorm_timer_started = True
        st.session_state.brainstorm_start_time = time.time()

# Step 2: ブレインストーミング
elif st.session_state.step == 2:
    st.subheader("ブレインストーミング (10分)")
    st_autorefresh(interval=1000, key="refresh1")

    elapsed = time.time() - st.session_state.brainstorm_start_time
    remaining = max(0, 600 - int(elapsed))
    mins, secs = divmod(remaining, 60)
    st.info(f"残り時間: {mins:02d}:{secs:02d}")
    st.session_state.brainstorm_elapsed = int(elapsed)

    st.session_state.brainstorm_text = st.text_area(
        "自由にアイデアを書いてください:",
        value=st.session_state.brainstorm_text,
        height=300,
        disabled=False
    )
    if st.button("次へ (英作文タスク)"):
        st.session_state.step = 3
        st.session_state.pretest_timer_started = True
        st.session_state.pretest_start_time = time.time()

# Step 3: Pre-Test
elif st.session_state.step == 3:
    st.subheader("英作文タスク (30分)")
    st_autorefresh(interval=1000, key="refresh2", limit=None)

    elapsed = time.time() - st.session_state.pretest_start_time
    remaining = max(0, 1800 - int(elapsed))
    mins, secs = divmod(remaining, 60)
    st.info(f"残り時間: {mins:02d}:{secs:02d}")
    st.session_state.pretest_elapsed = int(elapsed)

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### ブレインストーミングの内容")
        st.markdown(
            f"<div style='height: 350px; padding: 5px; border: 1px solid #ccc; border-radius: 5px; background-color: white; overflow-y: auto;'>{st.session_state.brainstorm_text.replace('<', '&lt;').replace('>', '&gt;').replace(chr(10), '<br>')}</div>",
            unsafe_allow_html=True
        )
    with col2:
        st.markdown("#### 英作文を書いてください")
        st.session_state.pretest_text = st.text_area(
            label=" ",
            value=st.session_state.pretest_text,
            height=350,
            disabled=False
        )
        st.markdown(
            f"<div style='margin-top: -4px;'>単語数: {len(st.session_state.pretest_text.split())} / 文字数: {len(st.session_state.pretest_text)}</div>",
            unsafe_allow_html=True
        )

    if st.button("次へ (フィードバック)"):
        st.session_state.step = 4

# Step 4: WCF（生成のみ → 自動でStep 5へ）
elif st.session_state.step == 4:
    st.subheader("フィードバック")
    if st.session_state.wcf_text == "":
        with st.spinner("フィードバックを生成中..."):
            try:
                response = client.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {"role": "system", "content": "Rewrite this writing as English native speakers wrote and keep the meaning of the writing as same as possible."},
                        {"role": "user", "content": st.session_state.pretest_text}
                    ],
                    temperature=0.3
                )
                st.session_state.wcf_text = response.choices[0].message.content.strip()
                st.session_state.step = 5  # 自動で次へ
                st.rerun()
            except Exception as e:
                st.error(f"エラーが発生しました: {e}")
                st.stop()
    else:
        st.session_state.step = 5
        st.rerun()

# Step 5: 振り返り
elif st.session_state.step == 5:
    st.subheader("振り返り")
    if st.session_state.wl_start_time is None:
        st.session_state.wl_start_time = time.time()

    # --- 指示 / 例+コード を横並びに配置 ---
    colA, colB = st.columns([2,2])

    with colA:
        st.markdown("### 指示")
        st.markdown("""
        フィードバックを参照しながら自身の英作文を読み返し、誤りを特定してください。  
        それぞれの言語形式がなぜ誤っているのか、説明してください。  
        また、フィードバックと自身の英作文を比較し、気づいたことも入力してください。  
        記入の際は、例にならって記入し、「➕ Add」を押すと記録され、新しく記入できます。  
        """)

    with colB:
        st.markdown("### 例")
        example_df = pd.DataFrame([
            {"誤り": "He go", "フィードバック": "He goes", "コード": "GR", "説明": "主語と動詞の一致の誤り"}
        ])
        st.table(example_df)

        st.markdown("### コード")
        st.markdown("""
        **L** = 語彙　|　**GR** = 文法　|　**SP** = スペル　|　**P** = 句読点　|　**O** = その他
        """)




    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### 元の文 (Pre-Test)")
        st.markdown(f"<div style='height:250px; overflow-y:auto; padding:10px; border:1px solid #ccc; border-radius:5px; background-color:white;'>{st.session_state.pretest_text.replace(chr(10), '<br>')}</div>", unsafe_allow_html=True)
    with col2:
        st.markdown("#### フィードバック")
        st.markdown(f"<div style='height:250px; overflow-y:auto; padding:10px; border:1px solid #ccc; border-radius:5px; background-color:white;'>{st.session_state.wcf_text.replace(chr(10), '<br>')}</div>", unsafe_allow_html=True)

    st.markdown("<br><br>", unsafe_allow_html=True)

    with st.form("reflection_form", clear_on_submit=True):
        col1, col2, col3, col4 = st.columns([2,2,1,3])
        with col1: error_input = st.text_input("誤り")
        with col2: correction_input = st.text_input("フィードバック")
        with col3: code_input = st.selectbox("コード", ["", "L", "GR", "SP", "P", "O"])
        with col4: explanation_input = st.text_area("説明", height=80)
        submitted = st.form_submit_button("➕ Add")

    if submitted and error_input.strip() and correction_input.strip() and code_input.strip():
        st.session_state["wl_entries"].append({
            "誤り": error_input,
            "フィードバック": correction_input,
            "コード": code_input,
            "説明": explanation_input
        })

    if st.session_state["wl_entries"]:
        st.markdown("### 振り返り記入欄")
        df_wl = pd.DataFrame(st.session_state["wl_entries"])
        st.dataframe(df_wl, use_container_width=True)

    st.session_state.wl_elapsed = int(time.time() - st.session_state.wl_start_time)
    if st.button("次へ (英作文タスク)"):
        st.session_state.step = 6
        st.session_state.posttest_timer_started = True
        st.session_state.posttest_start_time = time.time()

# Step 6: Post-Test
elif st.session_state.step == 6 and not st.session_state.finished:
    st.subheader("英作文タスク (30分)")
    st_autorefresh(interval=1000, key="refresh5")

    elapsed = time.time() - st.session_state.posttest_start_time
    remaining = max(0, 1800 - int(elapsed))
    mins, secs = divmod(remaining, 60)
    st.info(f"残り時間: {mins:02d}:{secs:02d}")
    st.session_state.posttest_elapsed = int(elapsed)

    st.session_state.posttest_text = st.text_area(
        "英作文を書いてください：",
        value=st.session_state.posttest_text,
        height=300,
        disabled=False
    )
    st.markdown(f"単語数: {len(st.session_state.posttest_text.split())} / 文字数: {len(st.session_state.posttest_text)}")
    if st.button("次へ (アンケート)"):
        st.session_state.step = 7

# Step 7: アンケート
elif st.session_state.step == 7:
    st.subheader("アンケート")
    st.markdown("以下の各項目について、**1（全くそう思わない）～5（非常にそう思う）** で答えてください。")

    survey_questions = {
        "行動的エンゲージメント": [
            "1.課題をうまくこなすために、必要以上のことをしようとした。",
            "2.集中を保ち、気が散らないように最善を尽くした。",
            "3.課題を終えるために必要なだけの時間をかけた。",
            "4.課題をやり遂げるためにできる限り努力した。",
            "5.課題に積極的に取り組もうとした。"
        ],
        "情緒的エンゲージメント": [
            "1.課題をするのは楽しかった。",
            "2.課題をしているとき、興味を感じた。",
            "3.課題をすることで好奇心がかき立てられた。",
            "4.課題をしているとき、楽しいと感じた。",
            "5.課題をしているとき、熱意を感じた。"
        ],
        "認知的エンゲージメント": [
            "1.課題中に、重要な概念を自分の言葉で説明しようとした。",
            "2.課題中に、自分の言葉で要約しようとした。",
            "3.課題の内容を、既に知っていることと結び付けようとした。",
            "4.課題を理解しやすくするために、自分で例を作ろうとした。",
            "5.課題中に内容を繰り返したり、自分に問いかけたりした。"
        ],
        "主体的エンゲージメント": [
            "1.課題中に、自分に必要なことや望むことを先生に伝えた。",
            "2.課題中に、自分の関心を先生に伝えた。",
            "3.課題中に、自分の好みや意見を表明した。",
            "4.学習の助けになるように、先生に質問をした。",
            "5.必要なときには、先生に頼んだ。"
        ],
        "社会的エンゲージメント": [
            "1.課題を行う際に、先生に助けを求めた。",
            "2.課題を行う際に、他の学生に助けを求めた。",
            "3.課題をする間、先生とやり取りすることが重要だと感じた。",
            "4.課題をする間、他の学生とやり取りすることが重要だと感じた。",
            "5.課題を正しくできているか確認するために、先生にフィードバックを求めた。"
        ]
    }

    for category, questions in survey_questions.items():
        st.markdown(f"### {category}")
        for q in questions:
            st.session_state["survey_answers"][q] = st.radio(
                q, [1, 2, 3, 4, 5],
                index=None, horizontal=True,
                key=q
            )

    if st.button("送信"):
        st.session_state.step = 8
        st.session_state.finished = True

# 完了ページ
elif st.session_state.finished:
    st.success("すべてのステップが完了しました。お疲れ様でした！")

    def generate_excel():
        df_main = pd.DataFrame({
            "名前": [st.session_state.name],
            "学籍番号": [st.session_state.student_id],
            "授業名": [st.session_state.class_name],
            "① Brainstorming": [st.session_state.brainstorm_text],
            "② Pre-Test": [st.session_state.pretest_text],
            "③ AI-WCF": [st.session_state.wcf_text],
            "⑤ Post-Test": [st.session_state.posttest_text],
            "Brainstorm(sec)": [st.session_state.brainstorm_elapsed],
            "Pre-Test(sec)": [st.session_state.pretest_elapsed],
            "Reflection(sec)": [st.session_state.wl_elapsed],
            "Post-Test(sec)": [st.session_state.posttest_elapsed],
            "Pre-Test(words)": [len(st.session_state.pretest_text.split())],
            "Post-Test(words)": [len(st.session_state.posttest_text.split())]
        })

        out = BytesIO()
        with pd.ExcelWriter(out, engine="openpyxl") as writer:
            df_main.to_excel(writer, index=False, sheet_name="Writing Session")
            if st.session_state["wl_entries"]:
                df_reflection = pd.DataFrame(st.session_state["wl_entries"])
                df_reflection.to_excel(writer, index=False, sheet_name="Reflection")
            if st.session_state["survey_answers"]:
                df_survey = pd.DataFrame(list(st.session_state["survey_answers"].items()), columns=["Question", "Answer"])
                df_survey.to_excel(writer, index=False, sheet_name="Survey")
        return out.getvalue()

    st.download_button(
        label="結果をExcelでダウンロード",
        data=generate_excel(),
        file_name=f"writing_result_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

st.caption("© 2025 Writing Platform by Atsushi Doi")
