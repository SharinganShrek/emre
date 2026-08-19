# Senin yapman gerekenler (Emre OS)

Kod tarafı (Phase 2 sync, College Counseling persist, OpenAPI, PWA) hazır.
Aşağıdakiler **senin ortamında / dashboard’da** yapılmalı — agent bunları senin yerine tamamlayamaz.

---

## 1. Supabase şemasını uygula

1. [Supabase Dashboard](https://supabase.com/dashboard) → projen → **SQL Editor**.
2. Daha önce `mvp_schema.sql` çalıştırdıysan sadece Phase 2’yi çalıştır:

```text
supabase/phase2_schema.sql
```

3. Sıfırdan kuruyorsan sırayla:

```text
supabase/mvp_schema.sql
supabase/phase2_schema.sql
```

4. Eski `auth.users` FK’leri kaldırmadıysan:

```text
supabase/drop_auth_fks.sql
```

**Kontrol:** Table Editor’da şunlar görünmeli:

- `practice_tests`, `research_projects`, `research_papers`, `research_experiments`
- `goal_milestones`
- `college_counseling`
- `sat_vocab_progress` ← ayrıca çalıştır: `supabase/sat_vocab_schema.sql`

### SAT Vocab (yeni)

Supabase SQL Editor’da şunu çalıştır:

```text
supabase/sat_vocab_schema.sql
```

Sonra Vercel’e deploy et. Custom GPT talimatları **tek dosya**:
`custom-gpt/INSTRUCTIONS.md` (OpenAPI import + Instructions yapıştır).
SAT Vocab, College Counseling ve Study aynı blokta.

---

## 2. `.env.local` sırlarını güncelle

`.env.example` dosyasını kopyalayıp doldur (veya mevcut `.env.local`’i güncelle):

| Değişken | Ne yapmalısın |
| --- | --- |
| `APP_PASSWORD` | Güçlü bir unlock şifresi (production’da boş bırakma) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` `public` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (**asla client’a koyma**) |
| `AI_API_KEY` | Uzun rastgele secret üret (ör. `openssl rand -hex 32`) |

Sonra:

```bash
npm run dev
```

Uygulamayı aç → unlock → Notes / Study / Research / College Counseling’i dene → **Save**.

---

## 3. Production deploy

1. Vercel / başka host’a deploy et.
2. Aynı env değişkenlerini **hosting panelinde** tanımla (özellikle `SUPABASE_SERVICE_ROLE_KEY`, `APP_PASSWORD`, `AI_API_KEY`).
3. Production URL’ini not et (Custom GPT için lazım), örn. `https://emre-hub.vercel.app`.

---

## 4. Custom GPT / Action bağlama

1. OpenAI → **Create a GPT** (veya mevcut GPT’yi düzenle).
2. **Actions → Import from OpenAPI**:
   - Repo dosyası: `openapi/emre-hub-ai-actions.yaml`
   - `servers[0].url` değerini kendi production URL’in ile değiştir.
3. Authentication:
   - Type: **API Key**
   - Auth Type: **Bearer**
   - API Key: `.env` içindeki `AI_API_KEY` ile **aynı** değer
4. Test et:
   - `getTodaySummary`
   - `getCollegeCounselingContextPack`
5. GPT instructions: `custom-gpt/INSTRUCTIONS.md` içindeki **Instructions** bloğunun tamamını yapıştır (SAT Vocab + College Counseling + Study).

Yerel test (deploy yokken):

```bash
curl -s http://localhost:3000/api/ai/summary/today \
  -H "Authorization: Bearer YOUR_AI_API_KEY"
```

---

## 5. Telefona PWA olarak ekle

Production build gerekir (`npm run build && npm run start` veya deploy):

- **iOS Safari:** Share → **Add to Home Screen**
- **Android Chrome:** Menü → **Install app** / **Add to Home screen**

Not: Service worker yalnızca **production**’da register olur (`NODE_ENV=production`).

---

## 6. College Counseling veri doğrulama (senin bilgin)

- US need-blind / aid politikalarını **her başvuru döngüsünde** okul sitelerinden doğrula (sample data eski kalabilir).
- Gerçek mali dokümanları (banka, maaş, kimlik) uygulamaya yükleme — sadece checklist durumu tut.
- İlk açılışta seed/mock profil gelir; düzenleyip **Save changes** ile kalıcı yap.

---

## 7. Hızlı smoke test checklist

- [ ] Unlock çalışıyor
- [ ] Notes ekle/pin → refresh sonrası duruyor (Supabase)
- [ ] Study session / practice test ekle → sync
- [ ] Research project ekle → sync
- [ ] College Counseling → brag sheet / check-in → Save → refresh
- [ ] `GET /api/ai/college-counseling/context-pack` Bearer ile 200
- [ ] Telefonda install / home screen ikonu görünüyor

---

## Yardım / sık hatalar

| Belirti | Muhtemel neden |
| --- | --- |
| Hub 503 | `SUPABASE_SERVICE_ROLE_KEY` eksik |
| `relation "college_counseling" does not exist` | `phase2_schema.sql` çalıştırılmadı |
| AI 401 Locked | Middleware unlock gate AI route’ları engelliyor — `/api/ai` public olmalı (Bearer `AI_API_KEY`) |
| AI 500 “not configured” | Hosting’de `AI_API_KEY` yok |
| PWA install yok | Dev mode veya HTTPS yok (localhost hariç) |

Sorun olursa Settings sayfasındaki sync durumuna ve browser Network → `/api/hub` / `/api/college-counseling` yanıtlarına bak.
