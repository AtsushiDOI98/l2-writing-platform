import streamlit as st
import time
from datetime import datetime
from openai import OpenAI
import pandas as pd
from io import BytesIO
from streamlit_autorefresh import st_autorefresh
import os

# OpenAI APIキーを secrets から取得
client = OpenAI(api_key=st.secrets["OPENAI_API_KEY"])

# ページ幅を最大化
st.set_page_config(layout="wide")

# セッション初期化
for key in [
    "step", "name", "student_id", "brainstorm_text", "pretest_text", "wcf_text",
    "wl_text", "posttest_text", "finished", "brainstorm_timer_started",
    "pretest_timer_started", "posttest_timer_started", "wl_timer_started",
    "brainstorm_start_time", "pretest_start_time", "posttest_start_time", "wl_start_time"
]:
    if key not in st.session_state:
        st.session_state[key] = None if 'start_time' in key else (False if 'timer_started' in key else "")

st.title("L2 Writing Platform")

# Step 0: 学習者情報入力
if st.session_state.step is None:
    st.session_state.step = 0

if st.session_state.step == 0:
    st.subheader("学習者情報を入力してください")
    st.session_state.name = st.text_input("名前：", value=st.session_state.name)
    st.session_state.student_id = st.text_input("学籍番号：", value=st.session_state.student_id)

    if st.button("次へ (\u2460 ブレインストーミング)"):
        if st.session_state.name.strip() and st.session_state.student_id.strip():
            st.session_state.step = 1
        else:
            st.warning("\u26a0\ufe0f 名前と学籍番号の両方を入力してください。")

# Step 1: ブレインストーミング
elif st.session_state.step == 1:
    st.subheader("\u2460 ブレインストーミング (10分)")
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
        "ブレインストーミング中に自由にアイデアを書いてください：",
        value=st.session_state.brainstorm_text,
        height=300,
        disabled=not st.session_state.brainstorm_timer_started
    )

    if st.button("次へ (\u2461 Pre-Test)"):
        st.session_state.step = 2

# Step 2: Pre-Test
elif st.session_state.step == 2:
    st.subheader("\u2461 Writing Pre-Test (30分)")
    st_autorefresh(interval=1000, key="autorefresh2")

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
        st.session_state.pretest_text = st.text_area(
            "英作文を書いてください：",
            value=st.session_state.pretest_text,
            height=300,
            disabled=not st.session_state.pretest_timer_started
        )
        st.markdown(f"単語数: {len(st.session_state.pretest_text.split())}")

    if st.button("次へ (\u2462 WCF)"):
        st.session_state.step = 3

# Step 3: WCF
elif st.session_state.step == 3:
    st.subheader("\u2462 Written Corrective Feedback (WCF)")
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
    st.text_area("AIによるフィードバック", st.session_state.wcf_text, height=300, disabled=True)
    if st.button("次へ (\u2463 Written Language)"):
        st.session_state.step = 4

# Step 4: 振り返り
elif st.session_state.step == 4:
    st.subheader("\u2463 Written Language with WCF")
    st.markdown("### 振り返り")

    if st.button("タイマーを開始 (振り返り)") and not st.session_state.wl_timer_started:
        st.session_state.wl_timer_started = True
        st.session_state.wl_start_time = time.time()

    col1, col2 = st.columns(2)
    with col1:
        st.markdown("#### 元の文 (Pre-Test)")
        st.markdown(f"""
            <div style='padding:10px; background-color:#f8f8f8; border:1px solid #ccc; border-radius:5px; height:300px; overflow:auto;'>
                <pre style='white-space: pre-wrap;'>{st.session_state.pretest_text}</pre>
            </div>
        """, unsafe_allow_html=True)

    with col2:
        st.markdown("#### AIによる修正文 (WCF)")
        st.markdown(f"""
            <div style='padding:10px; background-color:#f8f8f8; border:1px solid #ccc; border-radius:5px; height:300px; overflow:auto;'>
                <pre style='white-space: pre-wrap;'>{st.session_state.wcf_text}</pre>
            </div>
        """, unsafe_allow_html=True)

    st.markdown("#### 考えたこと・気づいたこと")
    st.session_state.wl_text = st.text_area(
        "フィードバックと自身の文を比較し、考えたことや気づいたことを書いてください。",
        value=st.session_state.wl_text,
        height=200,
        disabled=not st.session_state.wl_timer_started
    )

    if st.button("次へ (\u2464 Post-Test)"):
        st.session_state.step = 5

# Step 5: Post-Test
elif st.session_state.step == 5 and not st.session_state.finished:
    st.subheader("\u2464 Writing Post-Test (30分)")
    st_autorefresh(interval=1000, key="autorefresh5")

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

    st.session_state.posttest_text = st.text_area(
        "英作文を書いてください：",
        value=st.session_state.posttest_text,
        height=300,
        disabled=not st.session_state.posttest_timer_started
    )
    st.markdown(f"単語数: {len(st.session_state.posttest_text.split())}")

    if st.button("完了"):
        st.session_state.finished = True

# 完了ページ
elif st.session_state.finished:
    st.success("お疲れ様でした！すべてのステップが完了しました。")
    st.markdown("以下のボタンから、全データを **Excel形式 (.xlsx)** でダウンロードできます。")

    def generate_excel_file():
        def elapsed(key):
            return int(time.time() - st.session_state[key]) if st.session_state[key] else ""

        data = {
            "名前": [st.session_state.name],
            "学籍番号": [st.session_state.student_id],
            "\u2460 Brainstorming": [st.session_state.brainstorm_text],
            "\u2461 Pre-Test Writing": [st.session_state.pretest_text],
            "\u2462 AI-WCF": [st.session_state.wcf_text],
            "\u2463 Written Language": [st.session_state.wl_text],
            "\u2464 Post-Test Writing": [st.session_state.posttest_text],
            "Brainstorming 時間 (秒)": [elapsed("brainstorm_start_time")],
            "Pre-Test 時間 (秒)": [elapsed("pretest_start_time")],
            "振り返り 時間 (秒)": [elapsed("wl_start_time")],
            "Post-Test 時間 (秒)": [elapsed("posttest_start_time")],
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
st.caption("\u00a9 2025 Writing Platform by Atsushi Doi")
