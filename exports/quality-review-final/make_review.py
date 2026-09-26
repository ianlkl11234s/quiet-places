#!/usr/bin/env python3
"""Build exports/quality-review-final/index.html from captured grids and perf data."""
import html, json, shutil, sys
from pathlib import Path

SP = Path(sys.argv[1])            # scratchpad with final-main/ and final-branch/
OUT = Path(sys.argv[2])           # exports/quality-review-final
(OUT / 'grids').mkdir(parents=True, exist_ok=True)

SCENES = [
    ('waterlight', '水光之間', [
        ('抗鋸齒', '2x MSAA（4x 會掉到 16.7 fps）', '9abc92c、491391d'),
        ('光柱落點反彈光', '下牆微亮，月夜歸零', '0a2e26b'),
        ('地面光斑柔邊、月夜天窗降飽和', '', '8e6da01'),
        ('長鰭錦鯉不再打轉或垂直', '俯仰 ±20°、偏航 ≤40°/s、轉彎側傾', '214caec'),
        ('魚類材質', '背深腹淺、光澤、鰭膜', '0d35909')]),
    ('leaflight', '樹影午後', [
        ('月夜窗景變成夜景', '天空深藍、樹成剪影', '192cb1b'),
        ('錦鯉轉彎側傾約 6°（方向改為朝內，待決定）', '', '23b13a0'),
        ('bloom 門檻 2.4，錦鯉鰭邊光暈消失', '', '1ec4d05')]),
    ('oceanlight', '海光之室', [
        ('晨曦、暮色窗景暖色', '', 'ea37787'),
        ('弱窗向環境光', '月夜歸零', 'bf928e3'),
        ('魟魚盤緣巡航減幅', '', '1d902ae'),
        ('魟魚模型重做（與向海的隧道共用）', '', 'a6789e6')]),
    ('afterlight', '雨後天井', [
        ('右牆雜訊（lightmap 取樣）平滑', '', '4732ff1'),
        ('晨間暖色', '', '9943814'),
        ('青鱂懸停尾巴靜止、背深腹淺', '', '23b13a0、0d35909')]),
    ('seaward', '向海的隧道', [
        ('地面倒影黑斑消除', '', '7b0d16d'),
        ('天空隨時段變化', '', '26b50ec'),
        ('弱環境光、牆面反彈重分配', '', '49f1f34'),
        ('魟魚拍鰭跟游速', '', 'be17279'),
        ('魟魚側傾、抬頭、避鏡頭、腹面淺；整圈翻滾依 9/9 指定保留', '', 'f78136b'),
        ('魟魚模型重做', '', 'a6789e6')]),
    ('stairlight', '階光之間', [
        ('月光斑、正午降一檔、扶手粗糙度', '裂縫凹槽因效能預設關閉，待 Blender 重烘', 'e4e284d、491391d'),
        ('烏翅真鯊胸鰭攻角', '', '3fed6d3'),
        ('烏翅真鯊模型重做（黑鰭尖、淺色帶、短圓吻）', '', '74c9db2')]),
    ('snowwindow', '雪落海窗', [
        ('晨曦、暮色細微暖色', '正午、月夜不變', '316c03b'),
        ('積雪閃光與軟邊', '', '414f407'),
        ('水母外觀（無色傘體、淡藕紫器官）與傾斜、滑移轉向', '', '3067b0b'),
        ('流場與尾流渦環', '', '1612e1d'),
        ('光錐內細塵（marine snow）', '推開效果場景距離約 3 px，偏弱', '50780a9'),
        ('裸海蝶透明體、頭錐', '', '30be470')]),
    ('snowhall', '雪光長廊', [
        ('窗景隨時段色溫', '選配；走廊暗度與銀魚未動', '946faf6'),
        ('窗光地面光斑', '評估後不做（北窗漫射光）', '9943814')]),
    ('last-arcade', '潮風商店街', [
        ('月夜路燈、夜空壓暗', '', '39dc97a'),
        ('對側樓房立面', '', '39dc97a'),
        ('鐵捲門 1K 貼圖', '', '6d7bba7'),
        ('小魚群運動與材質', '', '23b13a0、0d35909')]),
]

DECISIONS = [
    ('向海的隧道魟魚整圈翻滾', '你在 9/9 指定的動作，預設保留；Q2 提議改成只做轉彎側傾。要保留還是移除？', '`A7_KEEP_ROLL`'),
    ('樹影午後錦鯉側傾方向', '原本（幾乎看不出來地）朝外，現在朝內、約 6°，和鯊魚一致。', '`23b13a0`'),
    ('水光之間錦鯉轉彎動畫', '播放比例 17% → 31%。太頻繁可把門檻從 .6 提到 .75。', '`FishSchool.ts actionFor`'),
    ('水母細塵（透明水流）', '符合風格準則，但收縮推開細塵在場景距離只有約 3 px。要加強推力、加密度，還是維持含蓄？', '`MarineSnow.ts`'),
    ('水母遠景辨識度', '拿掉白邊後遠景變淡。可接受，或要提高邊緣亮度？', '`AureliaShading.ts`'),
    ('裸海蝶辨識度', '場景距離只有 7–13 px，翼足看不到。', '`ClioneShading.ts`'),
    ('階光之間裂縫', '凹槽 shader 讓幀率減半，已預設關閉。要不要排 Blender 重烘平台貼圖？', '`STAIR_CRACK_GROOVE`'),
    ('階光之間 4K → 2K 貼圖', '畫質幾乎無差，GLB 約 26 → 9 MB，已評估未套用。', '`exports/quality-q2-20260927/A1-A3/texture-2k-candidate/`'),
    ('潮風商店街暮色天空', '舊 bug：暮色天空快取從未更新，目前維持你看過的樣子。要修嗎？', '`last-arcade/index.ts`'),
    ('魟魚尾長', '受骨架限制只到約 1.5 倍盤長，文獻約 2 倍。要不要改骨架（兩個場景都要回歸）？', '`stingray.py TAIL_MESH`'),
]

CLOSEUPS = [
    ('烏翅真鯊（Blender 中性光）', '../quality-b-20260927/B1/before/side.jpg', '../quality-b-20260927/B1/after/side.jpg'),
    ('南方魟（Blender 中性光）', '../quality-b-20260927/B2/before/top.jpg', '../quality-b-20260927/B2/after/top.jpg'),
    ('海月水母近看（逆光）', '../quality-j-20260927/J1-J2/before/near-back.jpg', '../quality-j-20260927/J1-J2/after/near-back.jpg'),
    ('裸海蝶近看', '../quality-b-20260927/B3/before/near-front.jpg', '../quality-b-20260927/B3/after/near-front.jpg'),
]

def perf_rows():
    def load(p):
        out = {}
        for line in open(p):
            d = json.loads(line); r = d['report']
            out[d['place']] = json.loads(r) if isinstance(r, str) else r
        return out
    m, b = load(OUT / 'perf-main.jsonl'), load(OUT / 'perf-branch.jsonl')
    rows = []
    for key, name, _ in SCENES:
        a, c = m[key], b[key]
        rows.append(f"<tr><td>{name}</td><td>{a['fps']:.1f}</td><td>{c['fps']:.1f}</td>"
                    f"<td>{a['frameMs']['p95']:.1f}</td><td>{c['frameMs']['p95']:.1f}</td>"
                    f"<td>{a['composerCpuMs']['p95']:.1f}</td><td>{c['composerCpuMs']['p95']:.1f}</td>"
                    f"<td>{a['triangles']:,}</td><td>{c['triangles']:,}</td>"
                    f"<td>{a['drawCalls']}</td><td>{c['drawCalls']}</td></tr>")
    return '\n'.join(rows)

def exists(rel):
    return (OUT / rel).resolve().exists()

sections = []
for key, name, items in SCENES:
    for side in ('main', 'branch'):
        src = SP / f'final-{side}' / f'{key}-grid.jpg'
        if src.exists():
            (OUT / 'grids' / side).mkdir(parents=True, exist_ok=True)
            shutil.copy(src, OUT / 'grids' / side / f'{key}.jpg')
    lis = ''.join(
        f"<li><span class=item>{html.escape(t)}</span>"
        + (f"<span class=note>{html.escape(n)}</span>" if n else '')
        + f"<code>{html.escape(c)}</code></li>" for t, n, c in items)
    sections.append(f"""
<section id="{key}">
  <h2>{name} <small>{key}</small></h2>
  <div class=pair>
    <figure><img loading=lazy src="grids/main/{key}.jpg" alt="{name} main 四時段"><figcaption>main（改動前）</figcaption></figure>
    <figure><img loading=lazy src="grids/branch/{key}.jpg" alt="{name} 分支四時段"><figcaption>分支（改動後）</figcaption></figure>
  </div>
  <ul class=changes>{lis}</ul>
</section>""")

closeups = ''.join(
    f"""<div class=pair><figure><img loading=lazy src="{a}" alt=""><figcaption>{t}：改動前</figcaption></figure>
<figure><img loading=lazy src="{b}" alt=""><figcaption>{t}：改動後</figcaption></figure></div>"""
    for t, a, b in CLOSEUPS if exists(a) and exists(b))

decisions = ''.join(
    f"<li><b>{html.escape(t)}</b><p>{html.escape(d)}</p><code>{html.escape(w)}</code></li>" for t, d, w in DECISIONS)

nav = ''.join(f'<a href="#{k}">{n}</a>' for k, n, _ in SCENES)

page = f"""<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>靜隅畫質總驗收</title>
<style>
:root{{--bg:#f4f2ee;--fg:#1d1f21;--muted:#6b6b66;--line:#d9d5cc;--card:#fff;--accent:#8a6d3b}}
@media (prefers-color-scheme:dark){{:root{{--bg:#121416;--fg:#e8e6e1;--muted:#9a9891;--line:#2c2f33;--card:#1a1d20;--accent:#d2b27a}}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--fg);font:15px/1.65 -apple-system,"PingFang TC","Noto Sans TC",sans-serif}}
main{{max-width:1320px;margin:0 auto;padding:32px 16px 80px}}
h1{{font-weight:500;letter-spacing:.04em;margin:0 0 4px}}h2{{font-weight:500;margin:48px 0 12px;border-bottom:1px solid var(--line);padding-bottom:6px}}
h2 small{{color:var(--muted);font-size:.6em;margin-left:8px}}.lede{{color:var(--muted);max-width:70ch}}
nav{{position:sticky;top:0;background:var(--bg);padding:10px 0;display:flex;flex-wrap:wrap;gap:12px;border-bottom:1px solid var(--line);z-index:2}}
nav a{{color:var(--fg);text-decoration:none;font-size:13px}}nav a:hover{{color:var(--accent)}}
.pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}@media (max-width:760px){{.pair{{grid-template-columns:1fr}}}}
figure{{margin:0}}img{{width:100%;display:block;border-radius:4px;background:#000}}figcaption{{font-size:12px;color:var(--muted);margin-top:4px}}
.changes{{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:6px}}
.changes li{{display:flex;flex-wrap:wrap;gap:8px;align-items:baseline;background:var(--card);border:1px solid var(--line);border-radius:4px;padding:6px 10px}}
.item{{flex:1 1 320px}}.note{{color:var(--muted);font-size:13px}}code{{font-size:12px;color:var(--accent)}}
table{{border-collapse:collapse;width:100%;font-size:13px;font-variant-numeric:tabular-nums}}th,td{{border-bottom:1px solid var(--line);padding:6px 8px;text-align:right}}th:first-child,td:first-child{{text-align:left}}
.scroll{{overflow-x:auto}}.decisions{{display:grid;gap:10px;padding:0;list-style:none}}.decisions li{{background:var(--card);border:1px solid var(--line);border-left:3px solid var(--accent);border-radius:4px;padding:10px 14px}}
.decisions p{{margin:4px 0}}.meta{{color:var(--muted);font-size:13px}}
</style></head><body><main>
<h1>靜隅畫質總驗收</h1>
<p class=lede>Q0–Q3 與水母專案的所有候選改動，main 與分支 <code>claude/visual-quality-split</code> 並排比較。四宮格順序：晨曦、正午（上）／暮色、月夜（下）；1600×900、本機 headed Chrome。所有畫面改動都是候選，等你決定。</p>
<p class=meta>測試 209/210（唯一失敗為 main 既有 manta 測試）；build、check:project 通過；未做實機、手機、部署驗證。</p>
<nav>{nav}<a href="#closeups">生物近看</a><a href="#perf">效能</a><a href="#decisions">待決定</a></nav>
{''.join(sections)}
<section id=closeups><h2>生物近看</h2>{closeups}</section>
<section id=perf><h2>效能（正午，1600×900，dpr 1，真實 composer，5 秒暖機 + 15 秒取樣）</h2>
<p class=lede>網站上限 30 fps。CPU 為 composer 提交時間，不是 GPU 時間。量測中發現水光之間與階光之間掉到 16.7／13.8 fps，已修正（<code>491391d</code>）；以下為修正後數字。p95 幀間隔約 35→40 ms 屬 30 fps 節拍下的抖動（main 各場景自身介於 35–43 ms）。<br>CPU 提交時間 p95 在部分場景上升 1–2 ms（例：水光之間 1.8→4.0、向海的隧道 1.2→2.6），這已超過計劃訂的 10% 門檻，但絕對值遠低於每幀 33 ms 的預算，幀率也沒有下降。把 MSAA 關掉後幾乎不變（4.0→3.7），所以原因不是 MSAA；確切來源這次沒有隔離出來，列為待追。雪落海窗則從 4.3 降到 2.0，因為移除了水母的放射管幾何。</p>
<div class=scroll><table><thead><tr><th>場景</th><th>fps main</th><th>fps 分支</th><th>p95 ms main</th><th>p95 ms 分支</th><th>CPU p95 main</th><th>CPU p95 分支</th><th>三角面 main</th><th>三角面 分支</th><th>draw calls main</th><th>draw calls 分支</th></tr></thead>
<tbody>{perf_rows()}</tbody></table></div></section>
<section id=decisions><h2>需要你決定的事</h2><ul class=decisions>{decisions}</ul></section>
</main></body></html>"""
(OUT / 'index.html').write_text(page, encoding='utf-8')
print('wrote', OUT / 'index.html')
