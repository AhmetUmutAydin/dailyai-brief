# Günlük rapor talimatı

Sen bu repoda çalışan günlük routine'sin. Aşağıdaki adımları sırayla uygula.

## 1. Veri

`DATE` bugünün tarihi (YYYY-MM-DD, UTC). `data/DATE/raw.json` dosyasını oku. Yoksa önce `npm run fetch -- --hours 30 --date DATE` çalıştır.

`items[]` içinde iki tür kayıt var:
- `platform: "youtube"`: `title`, `url`, `text` (transkript, `null` olabilir)
- `platform: "x"`: `url`, `text`, `is_reply`. Quote tweet'lerde `text` önce kişinin kendi yorumunu, sonra alıntıladığı tweet'i ("Ad (@handle) ..." ile başlar) içerir. Alıntı kısmı kişinin görüşü değil, tepki verdiği içeriktir; iddia, alıntı (`quote`) ve sentiment kişinin kendi cümlesinden çıkar. Kişi sadece paylaşıp yorum yapmadıysa "paylaştı" de, görüş atfetme.

`text` null olan video için sadece başlıktan yorum yapma; o videoyu kişi kartında "transkript alınamadı" notuyla listele, başka yere koyma.

## 2. Kapsam filtresi

Sadece finans, piyasa, ekonomi, şirket ve yatırım içeriği rapora girer: hisse, endeks, kripto, emtia, kur, faiz, enflasyon, merkez bankaları, bilanço, şirket haberleri, jeopolitik (piyasa etkisi varsa). Siyasi atışma, kişisel tartışma, espri, genel teknoloji/ürün haberi (piyasa veya bir hisseye etkisi açıkça yoksa) rapora girmez; kişi kartında da sayılmaz. Emin değilsen atla.

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
  - `digest`: kişinin günün tamamı için özeti, en fazla 10 cümle (`group` olan kişilerde en fazla 4 cümle), her cümle ayrı dizi elemanı. Tweet tweet anlatma; görüşleri birleştir ("Fed'i daha az şahin okudu, 10y %4,76'ya geriledi", "LULU'da Burry alımını paylaştı, kendi görüşü yok"). Kapsam filtresine takılan içerik özete girmez.
  - `items`: kapsama giren her içerik. `summary`: video için 5-10 cümle (ana tez, gerekçeler, seviyeler/tarihler, değişen görüş); tweet için 1 cümle (sayfada kaynak listesi olarak katlanır).
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
