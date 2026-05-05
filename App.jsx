import { useState, useCallback, useEffect } from "react";

const COLORS = {
  green: "#39d353", red: "#f85149", yellow: "#e3b341",
  bg: "#0d1117", bgCard: "#161b22", bgInput: "#21262d",
  border: "#30363d", text: "#e6edf3", muted: "#8b949e",
};

const QUICK_TICKERS = ["BBCA", "TLKM", "BBRI", "ASII", "ISAT", "ANTM", "UNTR", "BMRI"];

const verdictColor = (v) => {
  if (!v) return COLORS.muted;
  if (v === "BUY") return COLORS.green;
  if (v === "SELL") return COLORS.red;
  return COLORS.yellow;
};

const signalBadge = (s) => {
  const color = s === "BUY" ? COLORS.green : s === "SELL" ? COLORS.red : COLORS.yellow;
  return (
    <span style={{ color, border: `1px solid ${color}`, borderRadius: 4, padding: "1px 7px", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, fontWeight: 700 }}>{s || "—"}</span>
  );
};

const fmt = (n, d = 2) => n != null ? Number(n).toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—";

// Use proxy endpoint instead of Anthropic directly
const callAI = async (body) => {
  const res = await fetch("/api/anthropic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error);
  return data;
};

function Divider() {
  return <div style={{ borderTop: `1px solid ${COLORS.border}`, margin: "12px 0" }} />;
}

function Row({ label, value, signal, mono = true }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
      <span style={{ color: COLORS.muted, fontSize: 13 }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: mono ? "monospace" : "inherit", fontSize: 13, color: COLORS.text }}>{value}</span>
        {signal && signalBadge(signal)}
      </div>
    </div>
  );
}

function Card({ title, children }) {
  return (
    <div style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.muted, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>{title}</div>}
      {children}
    </div>
  );
}

// ─── SCREENER TAB ──────────────────────────────────────────────────────────────
function ScreenerTab({ onAnalyzeTicker }) {
  const [loading, setLoading] = useState(false);
  const [watchlist, setWatchlist] = useState(null);
  const [error, setError] = useState(null);

  const runScreener = useCallback(async () => {
    setLoading(true); setWatchlist(null); setError(null);
    const today = new Date();
    const todayStr = today.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const todayISO = today.toISOString().split("T")[0];

    const prompt = `Kamu adalah analis teknikal saham Indonesia yang ahli dalam memilih saham untuk swing trading.
Hari ini adalah ${todayStr} (${todayISO}). Kondisi market IDX saat ini cenderung sideways/volatile/bearish.

Gunakan web search untuk mengecek kondisi market IDX terkini dan identifikasi 7-10 saham dari Kompas 100 yang paling menarik untuk masuk watchlist swing trader minggu ini.

Kriteria seleksi (prioritaskan):
1. Setup teknikal yang jelas: BB squeeze akan breakout, oversold bounce, atau reversal signal
2. Volume anomali positif (akumulasi institusi)
3. Harga mendekati support kuat / BB lower
4. RSI oversold (< 35) dengan divergence positif
5. Sektor yang relatif kuat vs IHSG
6. Risk/reward yang favorable di kondisi sideways

Sertakan ringkasan kondisi IHSG/market hari ini, dan tema/sektor yang sedang menarik.

Balas HANYA dengan JSON valid:
{
  "scan_date": "${todayISO}",
  "market_summary": "2-3 kalimat kondisi IHSG dan market hari ini",
  "hot_sectors": ["sektor1", "sektor2"],
  "watchlist": [
    {
      "ticker": "XXXX",
      "nama": "nama perusahaan",
      "sektor": "sektor",
      "harga": 0,
      "change_pct": 0,
      "rsi14": 0,
      "bb_condition": "SQUEEZE|EXPANDING|UPPER_TOUCH|LOWER_TOUCH|NORMAL",
      "verdict": "BUY|HOLD|SELL",
      "setup": "nama setup teknikal",
      "alasan": "1-2 kalimat alasan masuk watchlist",
      "risk_level": "LOW|MEDIUM|HIGH",
      "entry_zone": "range harga entry ideal",
      "target": "target harga",
      "stop_loss": "level SL"
    }
  ]
}`;

    try {
      const data = await callAI({
        model: "claude-sonnet-4-20250514",
        max_tokens: 3000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      });
      const texts = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const m = texts.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Format respons tidak valid.");
      setWatchlist(JSON.parse(m[0]));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  const riskColor = (r) => r === "LOW" ? COLORS.green : r === "HIGH" ? COLORS.red : COLORS.yellow;

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <button onClick={runScreener} disabled={loading} style={{
          width: "100%", background: loading ? COLORS.bgInput : "linear-gradient(135deg, #1a3a2a, #0d2a18)",
          border: `1px solid ${loading ? COLORS.border : COLORS.green}`, color: loading ? COLORS.muted : COLORS.green,
          borderRadius: 10, padding: "14px", fontWeight: 700, fontSize: 13,
          cursor: loading ? "not-allowed" : "pointer", fontFamily: "monospace", letterSpacing: 1,
        }}>
          {loading ? "🔍 SCANNING KOMPAS 100..." : "🔍 SCAN WATCHLIST SEKARANG"}
        </button>
        {loading && <div style={{ textAlign: "center", marginTop: 8, fontSize: 11, color: COLORS.muted }}>AI sedang cek kondisi market & filter kandidat terbaik...</div>}
      </div>

      {error && <div style={{ background: "#2d1b1e", border: `1px solid ${COLORS.red}`, borderRadius: 8, padding: "12px 14px", color: COLORS.red, fontSize: 13 }}>⚠ {error}</div>}

      {watchlist && (
        <>
          <Card title={`📊 Kondisi Market · ${watchlist.scan_date}`}>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.text, margin: 0, fontFamily: "system-ui" }}>{watchlist.market_summary}</p>
            {watchlist.hot_sectors?.length > 0 && (
              <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 6 }}>
                <span style={{ fontSize: 11, color: COLORS.muted, marginRight: 4 }}>Sektor hot:</span>
                {watchlist.hot_sectors.map((s, i) => (
                  <span key={i} style={{ fontSize: 11, color: COLORS.yellow, border: `1px solid ${COLORS.yellow}44`, borderRadius: 4, padding: "1px 7px", fontFamily: "monospace" }}>{s}</span>
                ))}
              </div>
            )}
          </Card>

          <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2, marginBottom: 10 }}>{watchlist.watchlist?.length || 0} KANDIDAT DITEMUKAN</div>

          {(watchlist.watchlist || []).map((item, i) => (
            <div key={i} style={{ background: COLORS.bgCard, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${verdictColor(item.verdict)}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "monospace", color: COLORS.text }}>{item.ticker}</span>
                    {signalBadge(item.verdict)}
                    <span style={{ fontSize: 10, color: riskColor(item.risk_level), border: `1px solid ${riskColor(item.risk_level)}44`, borderRadius: 3, padding: "1px 5px", fontFamily: "monospace" }}>{item.risk_level}</span>
                  </div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{item.nama} · {item.sektor}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, fontFamily: "monospace", color: COLORS.text }}>Rp {fmt(item.harga, 0)}</div>
                  <div style={{ fontSize: 11, color: item.change_pct >= 0 ? COLORS.green : COLORS.red }}>{item.change_pct >= 0 ? "▲" : "▼"} {fmt(Math.abs(item.change_pct), 2)}%</div>
                </div>
              </div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 11, background: COLORS.bgInput, color: COLORS.yellow, borderRadius: 4, padding: "2px 8px", fontFamily: "monospace", letterSpacing: 1 }}>📐 {item.setup}</span>
              </div>
              <p style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5, margin: "0 0 10px", fontFamily: "system-ui" }}>{item.alasan}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                {[["ENTRY", COLORS.green, item.entry_zone], ["TARGET", COLORS.yellow, item.target], ["STOP", COLORS.red, item.stop_loss]].map(([lbl, col, val]) => (
                  <div key={lbl} style={{ background: COLORS.bgInput, borderRadius: 6, padding: "6px 8px" }}>
                    <div style={{ fontSize: 9, color: col, letterSpacing: 1, marginBottom: 2 }}>{lbl}</div>
                    <div style={{ fontSize: 10, fontFamily: "monospace", color: COLORS.text }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>RSI {item.rsi14}</span>
                <span style={{ fontSize: 10, color: COLORS.muted }}>·</span>
                <span style={{ fontSize: 10, color: COLORS.muted, fontFamily: "monospace" }}>BB: {item.bb_condition}</span>
              </div>
              <button onClick={() => onAnalyzeTicker(item.ticker)} style={{
                width: "100%", background: COLORS.bgInput, border: `1px solid ${COLORS.border}`,
                color: COLORS.text, borderRadius: 6, padding: "8px", fontSize: 12, fontWeight: 700,
                cursor: "pointer", fontFamily: "monospace", letterSpacing: 1,
              }}>
                ANALISIS LENGKAP {item.ticker} →
              </button>
            </div>
          ))}
          <div style={{ textAlign: "center", fontSize: 10, color: COLORS.border, marginTop: 8, fontFamily: "system-ui" }}>Data estimasi via AI · Bukan rekomendasi investasi</div>
        </>
      )}
    </div>
  );
}

// ─── ANALYZER TAB ──────────────────────────────────────────────────────────────
function AnalyzerTab({ initialTicker }) {
  const [ticker, setTicker] = useState(initialTicker || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState(null);

  const analyze = useCallback(async (sym) => {
    const t = (sym || ticker).toUpperCase().trim();
    if (!t) return;
    setLoading(true); setResult(null); setError(null); setSaveMsg(null);

    const today = new Date();
    const todayStr = today.toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const todayISO = today.toISOString().split("T")[0];

    const prompt = `Kamu adalah analis teknikal saham Indonesia.
Hari ini adalah ${todayStr} (${todayISO}). Pasar IDX sudah tutup hari ini.

PENTING: Gunakan web search untuk fetch data CLOSING HARI INI (${todayISO}) saham ${t}.JK.
Search langsung ke: https://finance.yahoo.com/quote/${t}.JK/
- Field "data_date" di JSON HARUS berisi tanggal data aktual yang kamu temukan
- Jika data hari ini belum ada, gunakan data terbaru yang tersedia dan catat tanggalnya
- JANGAN gunakan data lebih lama dari 3 hari bursa

Cari dan hitung/estimasi data berikut untuk saham ${t} (IDX):
1. Harga closing terbaru, perubahan % vs hari sebelumnya
2. Open, High, Low terbaru
3. Volume terbaru dan rata-rata 20 hari
4. 52 Week High dan Low
5. MA20, MA50, MA200
6. RSI(14)
7. MACD line, Signal line, Histogram
8. Volume ratio vs avg 20 hari
9. Bollinger Bands (20,2): upper, middle, lower, width=(upper-lower)/middle*100, pctB=(price-lower)/(upper-lower)*100
   bb_condition: SQUEEZE(width<5%), EXPANDING, UPPER_TOUCH, LOWER_TOUCH, NORMAL

Sinyal BUY/NEUTRAL/SELL: ma_cross, rsi, macd, volume, bb
Verdict: BUY/HOLD/SELL (BB sebagai faktor utama, kondisi sideways/crash)
Support1, support2, resistance1, resistance2
Analisis 3-4 kalimat Indonesia untuk swing trader
Pantau Besok: level_kunci, trigger, warning
Trading Plan: trade_bias(LONG_ONLY/SHORT_ONLY/WAIT/SCALP_RANGE), entry_zone_low, entry_zone_high,
entry_confirmation(array 2-3 syarat), stop_loss, stop_loss_pct, take_profit_1, take_profit_2,
tp1_pct, tp2_pct, risk_reward_1(1:X), risk_reward_2(1:X), max_position_risk, validity

Balas HANYA dengan JSON valid:
{"ticker":"${t}","price":0,"change_pct":0,"open":0,"high":0,"low":0,"volume":0,"avg_volume_20d":0,"week52_high":0,"week52_low":0,"ma20":0,"ma50":0,"ma200":0,"rsi14":0,"macd_line":0,"macd_signal":0,"macd_histogram":0,"volume_ratio":0,"bb_upper":0,"bb_middle":0,"bb_lower":0,"bb_width":0,"bb_pct_b":0,"bb_condition":"NORMAL","signals":{"ma_cross":"NEUTRAL","rsi":"NEUTRAL","macd":"NEUTRAL","volume":"NEUTRAL","bb":"NEUTRAL"},"verdict":"HOLD","support1":0,"support2":0,"resistance1":0,"resistance2":0,"analisis":"teks","pantau_besok":{"level_kunci":"teks","trigger":"teks","warning":"teks"},"trading_plan":{"trade_bias":"WAIT","entry_zone_low":0,"entry_zone_high":0,"entry_confirmation":["s1","s2"],"stop_loss":0,"stop_loss_pct":0,"take_profit_1":0,"take_profit_2":0,"tp1_pct":0,"tp2_pct":0,"risk_reward_1":"1:2","risk_reward_2":"1:3","max_position_risk":"2%","validity":"3 hari"},"data_date":"${todayISO}"}`;

    try {
      const data = await callAI({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        messages: [{ role: "user", content: prompt }],
      });
      const texts = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const m = texts.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("Format respons tidak valid.");
      setResult(JSON.parse(m[0]));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [ticker]);

  useEffect(() => {
    if (initialTicker) { setTicker(initialTicker); analyze(initialTicker); }
  }, [initialTicker]);

  const saveToSheet = useCallback(async () => {
    if (!result) return;
    setSaving(true); setSaveMsg(null);
    const row = [result.data_date, result.ticker, result.price, result.change_pct, result.verdict, result.rsi14, result.signals?.ma_cross, result.macd_histogram, result.volume_ratio, result.support1, result.resistance1, result.analisis];
    const prompt = `Append satu baris data ke Google Sheet bernama "IDX_Analyzer_Log".
Jika sheet belum ada, buat dulu dengan header: Tanggal, Ticker, Harga, Change%, Verdict, RSI, MA Signal, MACD Histogram, Volume Ratio, Support1, Resistance1, Analisis.
Kemudian append baris data: ${JSON.stringify(row)}
Konfirmasi dengan JSON: {"success": true, "message": "..."} atau {"success": false, "message": "..."}`;

    try {
      const data = await callAI({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        mcp_servers: [{ type: "url", url: "https://drivemcp.googleapis.com/mcp/v1", name: "google-drive-mcp" }],
        messages: [{ role: "user", content: prompt }],
      });
      const texts = data.content.filter(b => b.type === "text").map(b => b.text).join("");
      const m = texts.match(/\{[\s\S]*\}/);
      if (m) { const r = JSON.parse(m[0]); setSaveMsg({ ok: r.success, msg: r.message }); }
      else setSaveMsg({ ok: true, msg: "Disimpan ke IDX_Analyzer_Log." });
    } catch (e) { setSaveMsg({ ok: false, msg: e.message }); }
    finally { setSaving(false); }
  }, [result]);

  const tp = result?.trading_plan;
  const biasColor = { LONG_ONLY: COLORS.green, SHORT_ONLY: COLORS.red, WAIT: COLORS.muted, SCALP_RANGE: COLORS.yellow }[tp?.trade_bias] || COLORS.muted;
  const biasLabel = { LONG_ONLY: "LONG ONLY", SHORT_ONLY: "SHORT ONLY", WAIT: "TUNGGU DULU", SCALP_RANGE: "SCALP RANGE" }[tp?.trade_bias] || tp?.trade_bias;

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && analyze()}
          placeholder="Kode saham, e.g. BBCA"
          style={{ flex: 1, background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.text, padding: "10px 12px", fontFamily: "monospace", fontSize: 14, outline: "none" }} />
        <button onClick={() => analyze()} disabled={loading || !ticker}
          style={{ background: loading ? COLORS.bgInput : COLORS.green, color: loading ? COLORS.muted : "#0d1117", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 700, fontSize: 13, cursor: loading || !ticker ? "not-allowed" : "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
          {loading ? "..." : "ANALISIS"}
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
        {QUICK_TICKERS.map(t => (
          <button key={t} onClick={() => { setTicker(t); analyze(t); }}
            style={{ background: COLORS.bgInput, border: `1px solid ${COLORS.border}`, color: COLORS.muted, borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "monospace", letterSpacing: 1 }}>
            {t}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.muted }}>
          <div style={{ fontSize: 13, letterSpacing: 2 }}>MENGAMBIL DATA...</div>
          <div style={{ fontSize: 11, marginTop: 6, color: COLORS.border }}>Searching Yahoo Finance via web</div>
        </div>
      )}

      {error && <div style={{ background: "#2d1b1e", border: `1px solid ${COLORS.red}`, borderRadius: 8, padding: "12px 14px", color: COLORS.red, fontSize: 13 }}>⚠ {error}</div>}

      {result && (
        <>
          {/* Verdict Banner */}
          <div style={{ background: verdictColor(result.verdict) + "1a", border: `2px solid ${verdictColor(result.verdict)}`, borderRadius: 10, padding: "14px 16px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2 }}>{result.ticker}</span>
                {(() => {
                  const dd = result.data_date;
                  const ti = new Date().toISOString().split("T")[0];
                  const fresh = dd && (dd === ti || (String(dd).includes(new Date().getDate()) && String(dd).includes(new Date().getFullYear())));
                  return <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1, padding: "1px 5px", borderRadius: 3, fontFamily: "monospace", background: (fresh ? COLORS.green : COLORS.yellow) + "22", color: fresh ? COLORS.green : COLORS.yellow, border: `1px solid ${fresh ? COLORS.green : COLORS.yellow}` }}>{dd || "?"} {fresh ? "✓ FRESH" : "⚠ CEK TGL"}</span>;
                })()}
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "monospace", color: COLORS.text, marginTop: 2 }}>Rp {fmt(result.price, 0)}</div>
              <div style={{ fontSize: 13, color: result.change_pct >= 0 ? COLORS.green : COLORS.red, marginTop: 1 }}>{result.change_pct >= 0 ? "▲" : "▼"} {fmt(Math.abs(result.change_pct), 2)}%</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: COLORS.muted, letterSpacing: 2, marginBottom: 4 }}>VERDICT</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: verdictColor(result.verdict), letterSpacing: 2 }}>{result.verdict}</div>
            </div>
          </div>

          <Card title="Harga & Volume">
            <Row label="Open" value={`Rp ${fmt(result.open, 0)}`} />
            <Row label="High" value={`Rp ${fmt(result.high, 0)}`} />
            <Row label="Low" value={`Rp ${fmt(result.low, 0)}`} />
            <Divider />
            <Row label="Volume" value={fmt(result.volume, 0)} />
            <Row label="Avg Vol 20d" value={fmt(result.avg_volume_20d, 0)} />
            <Row label="Vol Ratio" value={`${fmt(result.volume_ratio, 2)}x`} signal={result.signals?.volume} />
            <Divider />
            <Row label="52W High" value={`Rp ${fmt(result.week52_high, 0)}`} />
            <Row label="52W Low" value={`Rp ${fmt(result.week52_low, 0)}`} />
          </Card>

          <Card title="Moving Average">
            <Row label="MA20" value={`Rp ${fmt(result.ma20, 0)}`} />
            <Row label="MA50" value={`Rp ${fmt(result.ma50, 0)}`} />
            <Row label="MA200" value={`Rp ${fmt(result.ma200, 0)}`} />
            <Row label="MA Cross Signal" value="" signal={result.signals?.ma_cross} />
          </Card>

          <Card title="Indikator Teknikal">
            <Row label="RSI (14)" value={fmt(result.rsi14, 1)} signal={result.signals?.rsi} />
            <Divider />
            <Row label="MACD Line" value={fmt(result.macd_line, 4)} />
            <Row label="MACD Signal" value={fmt(result.macd_signal, 4)} />
            <Row label="Histogram" value={fmt(result.macd_histogram, 4)} signal={result.signals?.macd} />
          </Card>

          {result.bb_upper && (
            <Card title="Bollinger Bands (20, 2)">
              <div style={{ marginBottom: 12 }}>
                {(() => {
                  const { bb_upper: upper, bb_lower: lower, bb_middle: mid, price } = result;
                  const range = upper - lower;
                  const pct = range > 0 ? Math.max(0, Math.min(100, ((price - lower) / range) * 100)) : 50;
                  const condColor = { SQUEEZE: COLORS.yellow, EXPANDING: COLORS.green, UPPER_TOUCH: COLORS.red, LOWER_TOUCH: COLORS.green, NORMAL: COLORS.muted }[result.bb_condition] || COLORS.muted;
                  return (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 10, color: COLORS.red, fontFamily: "monospace" }}>↑ {fmt(upper, 0)}</span>
                        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: condColor, border: `1px solid ${condColor}`, borderRadius: 4, padding: "1px 6px" }}>{result.bb_condition}</span>
                        <span style={{ fontSize: 10, color: COLORS.green, fontFamily: "monospace" }}>↓ {fmt(lower, 0)}</span>
                      </div>
                      <div style={{ position: "relative", height: 24, background: COLORS.bgInput, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to right, ${COLORS.green}22, ${COLORS.yellow}22, ${COLORS.red}22)` }} />
                        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: COLORS.border }} />
                        <div style={{ position: "absolute", left: `${pct}%`, top: "50%", transform: "translate(-50%,-50%)", width: 10, height: 10, background: COLORS.text, borderRadius: "50%", border: `2px solid ${COLORS.bg}` }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 10, color: COLORS.muted }}>Mid {fmt(mid, 0)}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <Divider />
              <Row label="BB Upper" value={`Rp ${fmt(result.bb_upper, 0)}`} />
              <Row label="BB Middle" value={`Rp ${fmt(result.bb_middle, 0)}`} />
              <Row label="BB Lower" value={`Rp ${fmt(result.bb_lower, 0)}`} />
              <Divider />
              <Row label="BB Width" value={`${fmt(result.bb_width, 2)}%`} />
              <Row label="%B" value={`${fmt(result.bb_pct_b, 1)}%`} signal={result.signals?.bb} />
            </Card>
          )}

          <Card title="Support & Resistance">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[["RESISTANCE 2", result.resistance2, COLORS.red], ["RESISTANCE 1", result.resistance1, COLORS.red], ["SUPPORT 1", result.support1, COLORS.green], ["SUPPORT 2", result.support2, COLORS.green]].map(([lbl, val, col]) => (
                <div key={lbl} style={{ background: COLORS.bgInput, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${col}` }}>
                  <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 1, marginBottom: 4 }}>{lbl}</div>
                  <div style={{ fontSize: 14, fontFamily: "monospace", color: col }}>Rp {fmt(val, 0)}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Analisis Swing Trader">
            <p style={{ fontSize: 13, lineHeight: 1.7, color: COLORS.text, margin: 0, fontFamily: "system-ui" }}>{result.analisis}</p>
          </Card>

          {result.pantau_besok && (
            <Card title="📋 Pantau Besok">
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[["level_kunci", "LEVEL KUNCI", COLORS.yellow], ["trigger", "TRIGGER BUY/SELL", COLORS.green], ["warning", "⚠ WARNING", COLORS.red]].map(([key, lbl, col]) => (
                  <div key={key} style={{ background: COLORS.bgInput, borderRadius: 8, padding: "10px 12px", borderLeft: `3px solid ${col}` }}>
                    <div style={{ fontSize: 10, color: col, letterSpacing: 1, marginBottom: 4 }}>{lbl}</div>
                    <div style={{ fontSize: 12, fontFamily: "system-ui", color: COLORS.text, lineHeight: 1.5 }}>{result.pantau_besok[key]}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tp && (
            <Card title="🎯 Trading Plan">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 11, color: COLORS.muted }}>Bias</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: biasColor, border: `1px solid ${biasColor}`, borderRadius: 4, padding: "2px 10px", letterSpacing: 1, fontFamily: "monospace" }}>{biasLabel}</span>
              </div>
              <div style={{ background: COLORS.bgInput, borderRadius: 8, padding: "12px", marginBottom: 10, borderLeft: `3px solid ${COLORS.green}` }}>
                <div style={{ fontSize: 10, color: COLORS.green, letterSpacing: 1, marginBottom: 8, fontWeight: 700 }}>ENTRY ZONE</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>Low</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: COLORS.text }}>Rp {fmt(tp.entry_zone_low, 0)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>High</span>
                  <span style={{ fontSize: 13, fontFamily: "monospace", color: COLORS.text }}>Rp {fmt(tp.entry_zone_high, 0)}</span>
                </div>
                <div style={{ fontSize: 10, color: COLORS.muted, letterSpacing: 1, marginBottom: 6, fontWeight: 700 }}>KONFIRMASI SEBELUM ENTRY</div>
                {(tp.entry_confirmation || []).map((c, i) => (
                  <div key={i} style={{ fontSize: 12, color: COLORS.text, fontFamily: "system-ui", lineHeight: 1.5, padding: "2px 0", display: "flex", gap: 6 }}>
                    <span style={{ color: COLORS.green }}>✓</span> {c}
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[["STOP LOSS", tp.stop_loss, `-${fmt(tp.stop_loss_pct, 1)}%`, COLORS.red], ["TP 1", tp.take_profit_1, `+${fmt(tp.tp1_pct, 1)}%`, COLORS.yellow], ["TP 2", tp.take_profit_2, `+${fmt(tp.tp2_pct, 1)}%`, COLORS.green]].map(([lbl, val, pct, col]) => (
                  <div key={lbl} style={{ background: COLORS.bgInput, borderRadius: 8, padding: "10px 8px", borderTop: `2px solid ${col}` }}>
                    <div style={{ fontSize: 9, color: col, letterSpacing: 1, marginBottom: 4, fontWeight: 700 }}>{lbl}</div>
                    <div style={{ fontSize: 12, fontFamily: "monospace", color: col }}>Rp {fmt(val, 0)}</div>
                    <div style={{ fontSize: 10, color: COLORS.muted, marginTop: 2 }}>{pct}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                {[["RISK/REWARD TP1", tp.risk_reward_1, COLORS.yellow], ["RISK/REWARD TP2", tp.risk_reward_2, COLORS.green]].map(([lbl, val, col]) => (
                  <div key={lbl} style={{ background: COLORS.bgInput, borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 9, color: COLORS.muted, letterSpacing: 1, marginBottom: 4 }}>{lbl}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, fontFamily: "monospace", color: col }}>{val}</div>
                  </div>
                ))}
              </div>
              <Divider />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>Max Risk / Trade</span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: COLORS.text }}>{tp.max_position_risk}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>Validitas Plan</span>
                <span style={{ fontSize: 12, fontFamily: "monospace", color: COLORS.text }}>{tp.validity}</span>
              </div>
            </Card>
          )}

          <div style={{ marginTop: 4 }}>
            <button onClick={saveToSheet} disabled={saving} style={{
              width: "100%", background: saving ? COLORS.bgInput : COLORS.bgCard,
              border: `1px solid ${saving ? COLORS.border : COLORS.yellow}`,
              color: saving ? COLORS.muted : COLORS.yellow, borderRadius: 8, padding: "12px",
              fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer", fontFamily: "monospace", letterSpacing: 1,
            }}>
              {saving ? "MENYIMPAN..." : "💾 SIMPAN KE GOOGLE DRIVE"}
            </button>
            {saveMsg && (
              <div style={{ marginTop: 8, padding: "10px 12px", borderRadius: 8, background: saveMsg.ok ? "#0d2a18" : "#2d1b1e", border: `1px solid ${saveMsg.ok ? COLORS.green : COLORS.red}`, color: saveMsg.ok ? COLORS.green : COLORS.red, fontSize: 12, fontFamily: "system-ui" }}>
                {saveMsg.ok ? "✓" : "✗"} {saveMsg.msg}
              </div>
            )}
          </div>

          <div style={{ textAlign: "center", fontSize: 10, color: COLORS.border, marginTop: 16, fontFamily: "system-ui" }}>
            Data estimasi via AI web search · Bukan rekomendasi investasi
          </div>
        </>
      )}
    </div>
  );
}

// ─── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("analyzer");
  const [jumpTicker, setJumpTicker] = useState(null);

  const handleAnalyzeTicker = useCallback((ticker) => {
    setJumpTicker(ticker);
    setActiveTab("analyzer");
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.text, fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace", padding: "16px", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, letterSpacing: 3, color: COLORS.muted, marginBottom: 4 }}>IDX TECHNICAL</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.text, letterSpacing: 1 }}>Analyzer</div>
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: COLORS.bgCard, borderRadius: 10, padding: 4, border: `1px solid ${COLORS.border}` }}>
        {[["screener", "🔍 Screener"], ["analyzer", "📈 Analyzer"]].map(([id, lbl]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={{
            flex: 1, padding: "9px 8px", borderRadius: 8, border: "none",
            background: activeTab === id ? COLORS.bgInput : "transparent",
            color: activeTab === id ? COLORS.text : COLORS.muted,
            fontWeight: activeTab === id ? 700 : 400, fontSize: 13, cursor: "pointer",
            fontFamily: "monospace", letterSpacing: 0.5, transition: "all 0.15s",
            boxShadow: activeTab === id ? `0 0 0 1px ${COLORS.border}` : "none",
          }}>{lbl}</button>
        ))}
      </div>
      {activeTab === "screener" && <ScreenerTab onAnalyzeTicker={handleAnalyzeTicker} />}
      {activeTab === "analyzer" && <AnalyzerTab key={jumpTicker || "default"} initialTicker={jumpTicker} />}
    </div>
  );
}
