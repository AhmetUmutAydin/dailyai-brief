# Günlük rapor talimatı

Sen bu repoda çalışan günlük routine'sin. Aşağıdaki adımları sırayla uygula.

## 1. Veri

`DATE` bugünün tarihi (YYYY-MM-DD, UTC). `data/DATE/raw.json` dosyasını oku. Yoksa önce `npm run fetch -- --hours 30 --date DATE` çalıştır.

`items[]` içinde iki tür kayıt var:
- `platform: "youtube"`: `title`, `url`, `text` (transkript, `null` olabilir)
- `platform: "x"`: `url`, `text`, `is_reply`

`text` null olan video için sadece başlıktan yorum yapma; o videoyu kişi kartında "transkript alınamadı" notuyla listele, başka yere koyma.

## 2. Rapor

`data/DATE.json` dosyasını `schema/report.ts` şemasına tam uyacak şekilde yaz. Dil: Türkçe.

Bölümler:
- `attention`: bugün dikkat edilmesi gereken en fazla 5 nokta. Sıralama: somutluk ve yenilik. Her biri tek bir kişiye ve tek bir kaynağa bağlı.
- `macro`: faiz, enflasyon, kur, jeopolitik, küresel piyasa gibi konular. Her konu altında kim ne demiş, kişi başına en fazla 1 görüş. Aynı konuda ters düşenleri aynı `topic` altında topla.
- `assets`: açıkça adı geçen hisse, coin, emtia, endeks, döviz çifti. `symbol` BIST kodu / ticker / ISO kur kodu. Her mention için sentiment: positive (alım/olumlu beklenti), negative (satış/olumsuz), neutral (sadece bahsetti). Kişi aynı varlık için birden fazla şey dediyse en net olanı al.
- `persons`: `sources.json` sırasıyla herkes. İçeriği olmayan kişi için `items: []`. Her içerik için:
  - `summary`: video için 5-10 cümle (ana tez, gerekçeler, verdiği seviyeler/tarihler, değişen görüşü); tweet için 1-3 cümle.
  - `assets`: o içerikte adı geçen her varlık için `{symbol, sentiment, note}`; `note` 1-2 cümle, kişinin o varlık için ne dediği (seviye, vade, gerekçe). Bahsedilen varlık yoksa `[]`.

Kurallar:
- Her `quote` kaynaktaki cümlenin kendisi veya çok yakın hali. Uydurma yok.
- Her `source_url` `raw.json` içindeki bir `url` olmalı.
- Genel dolgu cümlesi yok ("dikkatli olunmalı", "yatırımcılar takip etmeli", "volatilite bekleniyor"). Somut şey yoksa o bölüm boş kalır.
- Yatırım tavsiyesi yazma; kişinin ne dediğini aktar.

## 3. Doğrulama ve yayın

1. `npm run validate DATE` çalıştır. Hata varsa JSON'u düzelt, tekrar çalıştır. Geçene kadar tekrarla.
2. `npm run index` çalıştır.
3. `git add data && git commit -m "report: DATE" && git push origin main`

Push `main`'e doğrudan. Branch açma, PR açma.
