# Günlük rapor talimatı

Sen bu repoda çalışan günlük routine'sin. Aşağıdaki adımları sırayla uygula.

## 1. Veri

`DATE` bugünün tarihi (YYYY-MM-DD, UTC). `data/DATE/raw.json` dosyasını oku. Yoksa önce `npm run fetch -- --hours 30 --date DATE` çalıştır.

`items[]` içinde iki tür kayıt var:
- `platform: "youtube"`: `title`, `url`, `text` (transkript, `null` olabilir)
- `platform: "x"`: `url`, `text`, `is_reply`. Quote tweet'lerde `text` önce kişinin kendi yorumunu, sonra alıntıladığı tweet'i ("Ad (@handle) ..." ile başlar) içerir. Alıntı kısmı kişinin görüşü değil, tepki verdiği içeriktir; iddia, alıntı (`quote`) ve sentiment kişinin kendi cümlesinden çıkar. Kişi sadece paylaşıp yorum yapmadıysa "paylaştı" de, görüş atfetme.

`text` null olan video için sadece başlıktan yorum yapma; o videoyu kişi kartında "transkript alınamadı" notuyla listele, başka yere koyma.

## 2. Kapsam filtresi

Finans filtresi sadece `attention` ve `macro` bölümleri için geçerlidir: oraya yalnızca finans, piyasa, ekonomi, şirket ve yatırım içeriği girer (hisse, endeks, kripto, emtia, kur, faiz, enflasyon, merkez bankaları, bilanço, şirket haberleri, piyasa etkisi olan jeopolitik). Siyasi atışma, kişisel tartışma, espri, piyasa etkisi olmayan teknoloji/ürün haberi bu iki bölüme girmez.

`persons` ve `assets` bölümlerinde:
- YouTube videoları her zaman kapsam içidir; kanalı kullanıcı seçti. Konu ne olursa olsun (koleksiyon kartı piyasası, gayrimenkul, kariyer, yapay zeka) özeti yazılır, adı geçen varlıklar çıkarılır.
- X gönderilerinde finans filtresi aynen geçerlidir: sadece finans, piyasa, ekonomi, şirket ve yatırım içeriği kişi özetine girer; siyaset, kişisel tartışma, espri, piyasa etkisi olmayan haber atlanır. Emin değilsen atla.

## 3. Rapor

`data/DATE.json` dosyasını `schema/report.ts` şemasına tam uyacak şekilde yaz. Dil: Türkçe.

Bölümler:
- `attention`: bugün dikkat edilmesi gereken en fazla 5 nokta. Sıralama: somutluk ve yenilik. Her biri tek bir kişiye ve tek bir kaynağa bağlı.
- `macro`: faiz, enflasyon, kur, jeopolitik, küresel piyasa gibi konular. Her konu altında kim ne demiş, kişi başına en fazla 1 görüş. Aynı konuda ters düşenleri aynı `topic` altında topla.
- `assets`: açıkça adı geçen hisse, coin, emtia, endeks, döviz çifti. `symbol` BIST kodu / ticker / ISO kur kodu. Aynı varlık tek kayıt; birden fazla kişi bahsettiyse hepsi `mentions` altında. Her mention için sentiment: positive (alım/olumlu beklenti), negative (satış/olumsuz), neutral (sadece bahsetti). Kişi aynı varlık için birden fazla şey dediyse en net olanı al.
  - `priority`: high / medium / low. Senin yorumun; tek ölçüt bahsedilme sayısı değil. high: birden fazla kişi görüş bildirdi, ya da net pozisyon/seviye/tarih verildi, ya da görüş değişti. medium: tek kişi somut görüş. low: sadece adı geçti, görüş yok.
  - `why`: priority gerekçesi, 1 cümle (high ve medium için; low için boş bırakılabilir).
- `errors`: `raw.json` içindeki `errors` listesini kısa, okunur Türkçe satırlara çevir (ör. "ZeroHedge: X verisi alınamadı (Apify run failed)", "Bora Özkent: 1 video transkripti alınamadı"). Hata yoksa `[]`.
- `persons`: `sources.json` sırasıyla herkes. `sources.json`'da `group` alanı olan kişilerde aynı `group` değerini yaz (ör. "Others"). İçeriği olmayan kişi için `digest: []`, `items: []`.
  - `digest`: kişinin gününün özeti, düz metin (string), akıcı 1-2 paragraf, en fazla 10 cümle (`group` olan kişilerde en fazla 4 cümle, tek paragraf). Madde işareti, liste, başlık yok; bir arkadaşına anlatır gibi bağlantılı cümleler. Tweet tweet anlatma; görüşleri birleştir ve öne çıkanı başa koy. Paragrafları boş satırla ayır. X'te finans dışı içerik özete girmez; videolar her zaman girer. Metinde geçen varlık sembollerini ve şirket adlarını çift yıldızla işaretle: `**NVDA**`, `**Bitcoin**`, `**dolar/TL**`; başka markdown kullanma.
  - `items`: kapsama giren X gönderileri ve tüm videolar. `summary`: video için 5-10 cümle (ana tez, gerekçeler, seviyeler/tarihler, değişen görüş); tweet için 1 cümle (sayfada kaynak listesi olarak katlanır).
  - `assets`: o içerikte adı geçen her varlık için `{symbol, sentiment, note}`; `note` 1-2 cümle, kişinin o varlık için ne dediği (seviye, vade, gerekçe). Bahsedilen varlık yoksa `[]`.

Kurallar:
- `person` alanı her zaman `sources.json`'daki addır (içeriği paylaşan kişi). İçerikte alıntılanan üçüncü kişiler (ör. bir Fed üyesi, bir CEO) `person` olamaz; onları `title`, `why`, `view` veya `note` metninin içinde adıyla belirt.
- Her `quote` kaynaktaki cümlenin kendisi veya çok yakın hali. Uydurma yok.
- Her `source_url` `raw.json` içindeki bir `url` olmalı.
- Genel dolgu cümlesi yok ("dikkatli olunmalı", "yatırımcılar takip etmeli", "volatilite bekleniyor"). Somut şey yoksa o bölüm boş kalır.
- Yatırım tavsiyesi yazma; kişinin ne dediğini aktar.

## 4. Doğrulama ve yayın

1. `npm run validate DATE` çalıştır. Hata varsa JSON'u düzelt, tekrar çalıştır. Geçene kadar tekrarla.
2. `npm run index` çalıştır.
3. `git add data && git commit -m "report: DATE" && git push origin main`

Push `main`'e doğrudan. Branch açma, PR açma.
