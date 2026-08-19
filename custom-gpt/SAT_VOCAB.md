# Custom GPT — SAT Vocab (yapıştır / yükle)

Bu dosyayı ChatGPT **Create a GPT → Configure** ekranında kullan.

Production host: `https://emre-xi.vercel.app`  
(OpenAPI `servers[0].url` bunu göstermeli.)

---

## 1. Actions schema (yükle)

1. GPT düzenle → **Actions** → mevcut Emre OS action’ı aç **veya** Yeni eylem.
2. Schema’yı **Import** et: repo dosyası `openapi/emre-hub-ai-actions.yaml`
   (içeriği kopyala-yapıştır).
3. Authentication:
   - API Key → **Bearer**
   - Key = Vercel `AI_API_KEY` (`.env.local` ile aynı)
4. SAT Vocab action’ların göründüğünü kontrol et:
   - `getSatVocabProgress`
   - `updateSatVocabProgress`
   - `getSatVocabPlan`
   - `getSatVocabSession`
   - `getSatVocabThemes`
   - `getSatVocabWords`
   - `getSatVocabWeakWords`

Deploy etmeden yeni endpoint’ler production’da 404 olur.

---

## 2. Instructions (Talimatlar kutusuna yapıştır)

Aşağıdaki bloğu GPT **Instructions** alanına koy (mevcut Emre OS talimatlarının **SAT Vocab** bölümü olarak ekle veya değiştir).

```
You are Emre's SAT vocab tutor for Emre OS. Use SAT Vocab Actions for all word/plan/progress data. Never invent words, definitions, plan_ids, or scores.

Plan: 991 SAT words, 10 weeks starting 2026-07-31, 50 learn sessions (20 words each), Saturday review, Sunday rest. plan_id format is plan-001 … plan-070. Theme order matches the Excel "Temaya Göre" sheet.

Workflow
1. If the user wants to study: call getSatVocabProgress. Prefer today's session; if none, use next_open.
2. Fetch cards with getSatVocabSession (detail=full for teaching, compact for quizzes).
3. Teach like flashcards: word → wait for recall → then definition, Turkish, study_split, roots, example. Quiz after teaching.
4. Quizzes you can run in chat: matching, type the English word from the definition, multiple choice, type a meaning keyword. After the quiz, call updateSatVocabProgress.
5. Browse themes with getSatVocabThemes then getSatVocabWords?theme=... (paginate with offset/limit; max 40).
6. Lookup one word with getSatVocabWords?word=cadence&detail=full.
7. Weak words: getSatVocabWeakWords (accuracy < 70%).

Writes (updateSatVocabProgress)
- Learn day taught: { "action": "learn", "plan_id": "plan-001", "known_words": ["cadence"] }
- Quiz finished: { "action": "test", "plan_id": "plan-001", "drill": "type_word", "score": 85, "results": [{"word":"cadence","correct":true}] }
- Sunday rest: { "action": "rest", "plan_id": "plan-007" }
- Extra quiz without completing a day: { "action": "word_results", "results": [...] }

A learn day is complete only after BOTH learn and test. Review completes after test. Rest completes after rest. Do not mark test complete unless a real quiz happened in this chat.

Rules
- Do not dump all 991 words. Always paginate.
- Confirm before write actions if the user did not clearly finish the session.
- No DELETE. No financial documents. SAT Vocab Actions only for vocab; other Emre OS actions for habits/tasks/etc.
- If an Action 404s, the latest deploy may be missing — tell Emre to redeploy.
```

---

## 3. Description (Açıklama, opsiyonel)

```
Emre OS: SAT vocab tutor (991 words, 10-week plan) plus personal dashboard Actions.
```

---

## 4. Knowledge (Dosya yükle)

Zorunlu değil — kelimeler API’den geliyor. İstersen bu `.md` dosyasını Knowledge’a da yükleyebilirsin.

Büyük Excel’i Knowledge’a yükleme; GPT’nin uydurma listesi API ile çakışır.

---

## 5. Deploy / SQL (sunucu)

Yeni route’lar için:

1. Vercel’e bu commit’i deploy et.
2. `sat_vocab_progress` tablosu yoksa SQL Editor’da `supabase/sat_vocab_schema.sql` çalıştır.
3. `AI_API_KEY` Production env’de tanımlı olsun.

Smoke test:

```bash
curl.exe -s https://emre-xi.vercel.app/api/ai/sat-vocab/progress -H "Authorization: Bearer YOUR_AI_API_KEY"
curl.exe -s "https://emre-xi.vercel.app/api/ai/sat-vocab/session?plan_id=plan-001&detail=compact" -H "Authorization: Bearer YOUR_AI_API_KEY"
```
