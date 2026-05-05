# IDX Technical Analyzer

Analisis teknikal saham IDX berbasis AI dengan web search real-time.

## Fitur
- **Screener** — AI scan Kompas 100, cari kandidat watchlist terbaik
- **Analyzer** — Analisis lengkap: MA, RSI, MACD, Bollinger Bands, Trading Plan
- **Google Drive** — Simpan hasil analisis ke Google Sheet otomatis

## Deploy ke Vercel

### 1. Push ke GitHub
```bash
git init
git add .
git commit -m "first commit"
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```

### 2. Import di Vercel
- Buka [vercel.com](https://vercel.com)
- Klik **Add New Project**
- Import repo GitHub kamu

### 3. Set Environment Variable
Di Vercel dashboard → Settings → Environment Variables:
```
ANTHROPIC_API_KEY = sk-ant-xxxxx
```
Ambil API key dari [console.anthropic.com](https://console.anthropic.com)

### 4. Deploy
Klik Deploy — selesai. App akan live di `https://nama-project.vercel.app`

## Development Lokal
```bash
npm install
cp .env.example .env
# isi ANTHROPIC_API_KEY di .env
npm run dev
```

## Catatan
- Data harga adalah estimasi via AI web search, bukan real-time API
- Akses sebaiknya setelah market tutup (>16:15 WIB) untuk data closing yang akurat
- Fitur Google Drive hanya jalan di Claude.ai (butuh MCP connector)
- Bukan rekomendasi investasi
