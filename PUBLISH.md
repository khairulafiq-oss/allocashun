# ALLOCASHUN — Cara publish untuk testing

App ni frontend sahaja (React + Vite). Selepas deploy, tester buka **URL** dalam browser.
Data (jadual, rules) tinggal dalam browser masing-masing — bukan shared server.

---

## Apa yang sudah disediakan dalam project

| Fail | Fungsi |
|------|--------|
| `vercel.json` | Settings build untuk **Vercel** |
| `netlify.toml` | Settings build untuk **Netlify** (alternatif) |
| `.gitignore` | Jangan push `node_modules` / `dist` |

Build command: `npm run build` · Output: `dist`

---

## Langkah 1 — Akaun (sekali sahaja)

1. Buat akaun **GitHub**: https://github.com/signup  
2. Buat akaun **Vercel** (login dengan GitHub): https://vercel.com/signup  

Cadangan: guna Vercel (paling senang untuk Vite).

---

## Langkah 2 — Buat repo GitHub kosong

1. Login GitHub → **New repository**  
2. Name contoh: `allocashun`  
3. **Public** (atau Private jika mahu)  
4. **Jangan** tick “Add README” / .gitignore / license (repo biar kosong)  
5. Create repository  
6. Copy URL, contoh: `https://github.com/USERNAME/allocashun.git`

---

## Langkah 3 — SourceTree: sambung & push

1. Buka **SourceTree**  
2. **Clone / New** → **Add Existing Local Repository**  
3. Pilih folder: `C:\Users\user\Documents\Shunedit\Frontend`  
4. Kalau belum nampak remote:  
   - **Repository** → **Repository Settings** → **Remotes** → **Add**  
   - Name: `origin`  
   - URL/Path: paste URL GitHub tadi  
5. Pastikan semua fail staged (kecuali yang diabaikan `.gitignore`)  
6. **Commit** message contoh: `Initial ALLOCASHUN release`  
7. **Push** ke `origin` / branch `main` (atau `master`)

Jika SourceTree minta login GitHub: guna Personal Access Token atau GitHub login dalam SourceTree.

---

## Langkah 4 — Connect Vercel

1. Buka https://vercel.com/new  
2. **Import** repo `allocashun` dari GitHub (Authorize jika diminta)  
3. Settings biasanya auto (Vite):  
   - Framework: Vite  
   - Build Command: `npm run build`  
   - Output Directory: `dist`  
4. **Deploy**  
5. Tunggu hijau / Ready → copy URL, contoh:  
   `https://allocashun-xxxx.vercel.app`

Hantar URL tu kepada tester.

---

## Langkah 5 — Update seterusnya (setiap kali ubah kod)

1. Edit local + uji: `npm run dev`  
2. SourceTree: **Commit** → **Push**  
3. Vercel auto-deploy (1–2 minit)  
4. Refresh URL tester = versi baharu

---

## Semak build local (optional)

Dalam folder project:

```bash
npm install
npm run build
npm run preview
```

Kalau build error, betulkan dulu sebelum push.

---

## Nota testing

- Sesiapa yang ada link boleh buka (tiada login sebenar).  
- Data setiap tester berasingan (localStorage).  
- Jangan guna untuk data production / data sensitif pelajar sebenar tanpa kawalan akses.

---

## Masalah biasa

| Masalah | Apa buat |
|---------|----------|
| SourceTree tak nampak `.git` | Pastikan folder `Frontend` dah ada repo Git (lihat Langkah 3). |
| Push ditolak | Login GitHub / token; pastikan remote URL betul. |
| Vercel build fail | Buka tab **Deployments** → log error; biasanya TypeScript error — fix local dengan `npm run build`. |
| Page blank selepas deploy | Hard refresh; semak Deployment log. |

---

## Alternatif: Netlify

Sama macam Vercel: https://app.netlify.com → Add new site → Import from Git → pilih repo.  
`netlify.toml` sudah set build & publish folder.
