# SAT Module Builder 1.9 (Safari)

Opera 1.8.2 ile aynı soru bankası denemesini kurar: zamanlı **Reading and Writing** (27 + zor 27) veya zamanlı **Math** (22 + zor 22). Bu klasör arkadaşın için ayrı bir sürümdür.

Emre OS bağlantısı yoktur. Connect token, soru geçmişinin sunucuya yazılması ve Bluebook aktarımı bu sürümde yok. Kullanılmış soru listesi yalnızca bu eklentinin içinde durur.

Safari’nin indirme API’si olmadığı için HTML, eklenti penceresindeki bir düğmeyle iner. Safari açık bir dosyanın üzerine yazamaz. Deneme bitince sonuçlar **yeni bir HTML dosyasının içine** konur. O dosyayı tekrar açınca deneme başlamaz, sonuç ekranı açılır. İlk indirdiğin dosya boş deneme olarak kalır.

Safari 18 veya daha yenisi gerekir (Mac). iPhone bu klasörle kurulamaz.

## Kurulum
1. Mac’te Xcode yüklü olsun. App Store’daki ücretsiz Xcode yeter; ücretsiz bir Apple ID ile imzalayabilirsin.
2. Terminal’i açıp bu klasörün yolunu ver:

```bash
xcrun safari-web-extension-converter "$HOME/Desktop/SAT_Module_Builder_Safari_v1.9" \
  --project-location "$HOME/Desktop/SATModuleBuilder" \
  --app-name "SAT Module Builder" \
  --bundle-identifier "com.sat.modulebuilder.safari" \
  --swift --macos-only --no-prompt --no-open --force
```

3. `SATModuleBuilder` içindeki Xcode projesini aç. Üstten Mac hedefini seç, imza için Personal Team’i seç, **Run**.
4. Safari → Ayarlar → İleri Düzey → **Web geliştiricileri için özellikleri göster**.
5. Geliştir menüsü → **İmzasız eklentilere izin ver**.
6. Safari → Ayarlar → Eklentiler → **SAT Module Builder 1.9 Safari** aç. College Board sitelerine izin ver.
7. Eklenti kaybolursa Xcode’dan uygulamayı bir kez daha çalıştır.

## Deneme
1. College Board’da oturum aç ve Student Question Bank’i aç.
2. Eklentide **College Board’a yeniden bağlan**.
3. Bölümü seç. **Denemeyi HTML olarak indir**.
4. İnen dosyayı Safari’de aç ve iki modülü de bitir.
5. Modül 2 gönderilince aynı adlı yeni bir HTML iner. İndirme başlamazsa sonuç ekranındaki **Sonuçları HTML dosyasına kaydet** düğmesine bas.
6. Sonraki sefer **yeni inen dosyayı** aç. Sonuç ekranı gelir.

Eklenti sekmesinde çözersen, bitince açılan kayıt sayfasındaki **İndir** düğmesi aynı sonuç dosyasını verir.

## Notlar
- R&W ve Math ayrı denemelerdir; tek bir 1600 SAT değildir.
- Modül 2 her zaman zor yoldur.
- R&W beceri sayıları ve sıra Practice 4–6 düzenini izler. Yeni bütçe modül 1’de 5 / 18 / 4, modül 2’de 2 / 5 / 20’dir. Eski bütçe 7 / 12 / 8 ve 4 / 9 / 14’tür.
- Math’te çoktan seçmeli ve öğrenci yanıtı vardır.
- Soru süresi oynatıcıda tutulur; sonuç dosyasına da yazılır.
