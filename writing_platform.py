import streamlit as st
import time
from datetime import datetime
from openai import OpenAI
import pandas as pd
from io import BytesIO
from streamlit_autorefresh import st_autorefresh
import os
from openai import OpenAI

# ページ幅を最大化
st.set_page_config(layout="wide")

# OpenAI APIキーを secrets から取得
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=api_key)

# セッション初期化
if 'step' not in st.session_state:
    st.session_state.step = 0
if 'name' not in st.session_state:
    st.session_state.name = ""
if 'student_id' not in st.session_state:
    st.session_state.student_id = ""
if 'brainstorm_text' not in st.session_state:
    st.session_state.brainstorm_text = ""
if 'pretest_text' not in st.session_state:
    st.session_state.pretest_text = ""
if 'wcf_text' not in st.session_state:
    st.session_state.wcf_text = ""
if 'wl_text' not in st.session_state:
    st.session_state.wl_text = ""
if 'posttest_text' not in st.session_state:
    st.session_state.posttest_text = ""
if 'finished' not in st.session_state:
    st.session_state.finished = False
if 'brainstorm_timer_started' not in st.session_state:
    st.session_state.brainstorm_timer_started = False
    st.session_state.brainstorm_start_time = None

st.title("L2 Writing Platform")

# Step 0: 学習者情報入力
if st.session_state.step == 0:
    st.subheader("学習者情報を入力してください")
    st.session_state.name = st.text_input("名前：", value=st.session_state.name)
    st.session_state.student_id = st.text_input("学籍番号：", value=st.session_state.student_id)
    if st.button("次へ (① ブレインストーミング)"):
        st.session_state.step = 1

# Step ① ブレインストーミング
elif st.session_state.step == 1:
    st.subheader("① ブレインストーミング (10分)")
    st_autorefresh(interval=1000, key="autorefresh1")

    if st.button("タイマーを開始 (10分)") and not st.session_state.brainstorm_timer_started:
        st.session_state.brainstorm_timer_started = True
        st.session_state.brainstorm_start_time = time.time()

    if st.session_state.brainstorm_timer_started:
        elapsed = time.time() - st.session_state.brainstorm_start_time
        remaining = max(0, 600 - int(elapsed))
        mins, secs = divmod(remaining, 60)
        st.info(f"残り時間: {mins:02d}:{secs:02d}")
        if remaining == 0:
            st.session_state.brainstorm_timer_started = False
            st.success("10分経過しました！タイムアップです。")

    st.session_state.brainstorm_text = st.text_area(
        "ブレインストーミング中に自由にアイデアを書いてください（10分以内でも次に進めます）:",
        value=st.session_state.brainstorm_text,
        height=300
    )

    if st.button("次へ (② Pre-Test)"):
        st.session_state.step = 2

# Step ② Pre-Test（文字数表示あり）
elif st.session_state.step == 2:
    st.subheader("② Writing Pre-Test (30分)")
    st_autorefresh(interval=1000, key="autorefresh2")
    if 'pretest_timer_started' not in st.session_state:
        st.session_state.pretest_timer_started = False
        st.session_state.pretest_start_time = None

    if st.button("タイマーを開始 (30分)") and not st.session_state.pretest_timer_started:
        st.session_state.pretest_timer_started = True
        st.session_state.pretest_start_time = time.time()

    if st.session_state.pretest_timer_started:
        elapsed = time.time() - st.session_state.pretest_start_time
        remaining = max(0, 1800 - int(elapsed))
        mins, secs = divmod(remaining, 60)
        st.info(f"残り時間: {mins:02d}:{secs:02d}")
        if remaining == 0:
            st.session_state.pretest_timer_started = False
            st.success("30分経過しました！タイムアップです。")

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("### ブレインストーミングの内容")
        st.write(st.session_state.brainstorm_text)
    with col2:
        st.session_state.pretest_text = st.text_area("英作文を書いてください：", value=st.session_state.pretest_text, height=300)
        st.markdown(f"単語数: {len(st.session_state.pretest_text.split())}")

    if st.button("次へ (③ WCF)"):
        st.session_state.step = 3

# Step ③ WCF（GPT-3.5によるフィードバック）
elif st.session_state.step == 3:
    st.subheader("③ Written Corrective Feedback (WCF)")
    if st.session_state.wcf_text == "":
        with st.spinner("AIによるフィードバックを生成中..."):
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
            except Exception as e:
                st.error(f"エラーが発生しました: {e}")
                st.stop()
    st.text_area("AIによるフィードバック", st.session_state.wcf_text, height=300)
    if st.button("次へ (④ Written Language)"):
        st.session_state.step = 4

# Step ④ WCFとPre-Testを横並び + 下段に振り返り欄
elif st.session_state.step == 4:
    st.subheader("④ Written Language with WCF")
    st.markdown("### 振り返り")
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### 元の文 (Pre-Test)")
        st.text_area("Pre-Test 文", st.session_state.pretest_text, height=300, disabled=True)
    with col2:
        st.markdown("#### AIによる修正文 (WCF)")
        st.text_area("WCF 修正文", st.session_state.wcf_text, height=300, disabled=True)

    st.markdown("#### 考えたこと・気づいたこと")
    st.session_state.wl_text = st.text_area("フィードバックと自身の文を比較し、考えたことや気づいたことを書いてください。", height=200)

    if st.button("次へ (⑤ Post-Test)"):
        st.session_state.step = 5

# Step ⑤ Post-Test
elif st.session_state.step == 5 and not st.session_state.finished:
    st.subheader("⑤ Writing Post-Test (30分)")
    st_autorefresh(interval=1000, key="autorefresh5")
    if 'posttest_timer_started' not in st.session_state:
        st.session_state.posttest_timer_started = False
        st.session_state.posttest_start_time = None

    if st.button("タイマーを開始 (30分)") and not st.session_state.posttest_timer_started:
        st.session_state.posttest_timer_started = True
        st.session_state.posttest_start_time = time.time()

    if st.session_state.posttest_timer_started:
        elapsed = time.time() - st.session_state.posttest_start_time
        remaining = max(0, 1800 - int(elapsed))
        mins, secs = divmod(remaining, 60)
        st.info(f"残り時間: {mins:02d}:{secs:02d}")
        if remaining == 0:
            st.session_state.posttest_timer_started = False
            st.success("30分経過しました！タイムアップです。")

    st.session_state.posttest_text = st.text_area("英作文を書いてください：", value=st.session_state.posttest_text, height=300)
    st.markdown(f"単語数: {len(st.session_state.posttest_text.split())}")
    if st.button("完了"):
        st.session_state.finished = True

# 完了ページ + ダウンロード
elif st.session_state.finished:
    st.success("お疲れ様でした！すべてのステップが完了しました。")
    st.markdown("以下のボタンから、全データを **Excel形式 (.xlsx)** でダウンロードできます。")

    def generate_excel_file():
        data = {
            "名前": [st.session_state.name],
            "学籍番号": [st.session_state.student_id],
            "① Brainstorming": [st.session_state.brainstorm_text],
            "② Pre-Test Writing": [st.session_state.pretest_text],
            "③ AI-WCF": [st.session_state.wcf_text],
            "④ Written Language": [st.session_state.wl_text],
            "⑤ Post-Test Writing": [st.session_state.posttest_text]
        }
        df = pd.DataFrame(data)
        output = BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="Writing Session")
        return output.getvalue()

    st.download_button(
        label="Excelファイルをダウンロード (.xlsx)",
        data=generate_excel_file(),
        file_name=f"writing_session_{datetime.now().strftime('%Y%m%d_%H%M')}.xlsx",
        mime="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

st.markdown("---")
st.caption("© 2025 Writing Platform by Atsushi Doi")
