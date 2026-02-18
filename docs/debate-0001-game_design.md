# Debate DEBATE-0001 - Game Design Position (TASK-0012)

## Task Meta
- task_id: TASK-0012
- owner: game_design
- debate_id: DEBATE-0001
- topic: ECS mi OOP mi, neden?

## Position
MVP icin **OOP-first (composition odakli)** mimariyi savunuyorum.

## Game-Design Gerekcesi
- MVP sistemleri sinirli: oyuncu, drone devriyesi, lazer grid, pickup, extraction.
- Beklenen aktif varlik sayisi dusuk: tipik 15-40 aktif oyun objesi; zirve anlarda ~60 altinda.
- Tasarim ihtiyaci hizli tuning: hiz, cooldown, hazard dongusu, skor carpani gibi parametreler kisa iterasyon ister.
- Bu olcekte OOP ile davranis okuma, hata ayiklama ve sistemler arasi degisiklik hizi daha yuksek olur.

## Concrete Tradeoffs
| Baslik | OOP-first kazanci | OOP-first maliyeti | ECS neyi daha iyi yapar |
|---|---|---|---|
| MVP teslim hizi | Daha az altyapi, daha hizli prototip/tuning | Sonradan yeniden yapilandirma gerekebilir | Baslangicta daha yavas ama daha sistematik |
| Dusuk-spec istikrar | Az abstraction, profiling noktasi net | Kotu tasarimda update zinciri dagilabilir | Yuksek varlik sayisinda daha iyi cache/scheduling |
| Tasarim iterasyonu | Oyun kurallari class-level hizli degisir | Coupling artarsa degisim maliyeti buyur | Data-driven degisiklikler daha temiz olabilir |
| Uzun vadeli olcekleme | Kucuk-orta kapsamda yeterli | Buyuk kapsamda teknik borc riski | Buyuk olcekte bakim/perf avantaji |

## Challenged Assumptions
1. Varsayim: "ECS her zaman daha performansli."  
   Karsi gorus: Bu MVP'de varlik sayisi dusuk; ana darbohaz cogu zaman render ve collision duzeni olur, mimari etiketi degil.
2. Varsayim: "OOP secilirse gelecekte kilitleniriz."  
   Karsi gorus: Net veri sinirlari ve composition kurali ile gecis yolu korunur.
3. Varsayim: "ECS olmadan hazard eskalasyonu duzensiz olur."  
   Karsi gorus: Director + deterministic phase kurali OOP icinde de ayni sekilde uygulanabilir.

## Risks
- Sinifsal bagimlilik kontrol edilmezse hazard/score/ui arasinda coupling artar.
- Objeye gore update dagitimi artis gosterdiginde frame time dalgalanabilir.
- ECS gecisini gec dusunmek, veri modeli standardize edilmezse maliyetli olur.

## Actionable Recommendation for Moderator
1. DEBATE-0001 icin karar: **"MVP: OOP-first"** olarak kilitle.
2. Mimari guardrail ekle:
   - Derin inheritance yasak; composition zorunlu.
   - Sistemler arasi iletisim event/flat-state uzerinden olsun.
3. ECS'e gecis tetiklerini bugunden sabitle:
   - Hedef cihazda 3 ardisik testte ortalama frame time > 16.7ms.
   - Aktif varlik > 150 ve update maliyeti frame'in %35'ini geciyor.
   - Iki sprint ust uste "cross-object coupling" sebebiyle feature gecikmesi.
4. Role bazli takip gorevleri:
   - `coder`: frame time + entity count telemetry ekle.
   - `player_experience`: FPS dususu aninda feedback/fallback UX tanimla.
   - `reviewer`: PR checklist'ine composition ve state-boundary maddesi ekle.

## Handoff
- Moderator'den beklenen cikti: Mimari kararin resmi notu (OOP-first / ECS-now) + tetik metrik onayi.
- OOP-first onayi gelirse bir sonraki adim: kodlama asamasinda telemetry ve guardrail checklist'i zorunlu.
