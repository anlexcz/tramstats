# TramStats

Read-only frontend osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Aktuální rozsah

Živé části:

- **Přehled / Dashboard**
- **Směny**
- **Detail směny** (`/smeny/{yyyymmdd}/`)
- **Vozy** (`/vozy/`)
- **Detail vozu** (`/vozy/{evc}/`)
- **Statistiky** (`/statistiky/`) – sedm tematických sekcí a úvodní přehled; období rok, měsíc, celá historie a vlastní rozsah; srovnávání období, měsíční přiblížení, přehledy linek a vozů

Další entity a detailnější analytika se budou rozšiřovat nad současnou datovou a doménovou vrstvou. Statistiky vycházejí ze stejných read-only dat jako ostatní stránky; chybějící rozpad kilometrů po linkách se neodhaduje.

## Spuštění

Bez buildu a aplikačních závislostí. V kořeni lze spustit například `python -m http.server 8000` a otevřít `http://localhost:8000`.

## Data

Jediným runtime zdrojem je Google sešit **TramStats – databáze** přes Google Apps Script read-only API.

Tok dat:

`Google Sheets → read-only API → assets/data.js → doménové vrstvy → UI`

Frontend načítá základní tabulky `shifts`, `shift_parts`, `shift_part_lines`, `vehicles`, `depots`, `lines`, `shift_types` a navíc fotografické tabulky `photos`, `photo_variants`, `shift_photos`, `shift_part_photos`, `vehicle_photos` přes stejné read-only API. Případná nedostupnost fotografických endpointů neblokuje zobrazení směn.

`assets/data.js` normalizuje relační data do lehkého view modelu. Odpovědi se krátce cachují v `sessionStorage`; při nedostupnosti API se nepoužívá starý statický snapshot.

## Doménová logika směn

Společná pravidla jsou v `assets/shift-domain.js`. Dashboard, Směny a detail směny používají stejnou implementaci pro:

- bloky směny,
- `split_seq` u šejdru,
- rozsah a délku směny,
- přechod přes půlnoc,
- agregaci výkonů,
- Zálohu (`Z`),
- Cvičnou jízdu (`73`),
- skrytí `MJ` a `JP` v kompaktním přehledu,
- slučování linek stejného kurzu.

## Doménová logika vozů

`assets/vehicle-domain.js` je společný zdroj pro seznam i detail vozů.

- výskyt vozu je nyní jeden doložený výskyt v `ShiftPart`,
- u soupravy se stejná osobní kilometráž části vztahuje k oběma skutečně přítomným vozům,
- počet jízd, km a čas se agregují celkem i po letech,
- roky bez výskytu se nezobrazují,
- historie detailu vozu je řazena od nejnovějšího záznamu a dělena tyrkysovým předělem podle roku,
- family (`T3`, `14T`, `15T`, `KT`, `52T`…) je primární zobrazovaný typ; konkrétní subtype zůstává v databázi.

### Fotografie

Fotografie lze navázat nezávisle na směnu (`shift_photos`), její část (`shift_part_photos`) i viditelný vůz (`vehicle_photos`). `assets/data.js` relace normalizuje, `assets/photo-gallery.js/.css` vykreslují společnou galerii.

- pokud pro směnu/vůz není fotografie, galerie ani placeholder se nezobrazuje,
- pokud fotografie existují, detail může zobrazit galerii,
- ikona fotografie u konkrétního výskytu vozu má v galerii aktivovat fotografii navázanou na danou `ShiftPart`, nikoli otevřít jinou stránku,
- kliknutí mimo foto ikonu na řádek historie vozu vede na detail příslušné směny.

## Struktura UI

- `index.html` + `assets/dashboard-v2.js/.css` — Dashboard
- `shifts/index.html` + `assets/shifts-page.js/.css` — Směny
- `assets/shift-detail.js/.css` — dynamický detail směny
- `vozy/index.html` + `assets/vehicles-page.js/.css` — seznam vozů
- `assets/vehicle-detail.js/.css` — dynamický detail vozu
- `assets/shift-domain.js` — společná logika směn
- `assets/vehicle-domain.js` — společná agregace vozů
- `assets/shifts-date-range.js/.css` — datumový filtr Směn
- `assets/app.js/.css` — společný shell a runtime
- `assets/components.css` — sdílené komponenty, aktuálně hlavně footer
- `assets/shared.js` — společná navigace, patička a značení neúplných souhrnů
- `statistiky/index.html` + `assets/statistics.js/.css` — statistický dashboard a sedm tematických pohledů

Dynamické detailové URL na GitHub Pages obsluhuje `404.html` podle typu cesty.

## Kontrola

Základní regresní kontrola:

`node scripts/check.mjs`

Test hlídá relační normalizaci, doménovou logiku směn a vozů a přítomnost aktuálních runtime modulů.


## Navigace a úplnost souhrnů

Seznamy uchovávají filtry, hledání, počet načtených řádků a pozici v rámci relace prohlížeče. Zablokované sessionStorage nebrání používání webu.

Neznámé km a časy se zobrazují jako `—`; částečně známé součty jako `≥ hodnota`. Skutečná nula zůstává nulou. Dashboard u neúplných souhrnů neukazuje číselný trend a extrémy vybírá jen z úplných hodnot. Počet výskytů vozu znamená počet částí výkonu, nikoli počet směn.

## Mapa aplikace (2026-11-14)

Hlavní menu (desktop i mobil):

1. **Přehled** – posledních 30 uzavřených dnů, agregace a poslední směny.
2. **Směny** – filtry, seznam a detail jednotlivé směny (`/smeny/YYYYMMDD/`).
3. **Vozy** – katalog evidovaných tramvají a detail každého vozu (`/vozy/EVČ/`).
4. **Statistiky** – výchozí aktuální rok, souhrn a tematické podsekce.

Statistiky (`/statistiky/`) mají přehled, směny, linky, vozy, kilometry, čas, vozovny a rekordy. Časové filtry: rok, měsíc, celá historie nebo vlastní interval. Detail linky je zatím součástí statistik, například `/statistiky/?tab=lines&period=all&line=3`; nejde o oddělenou entitní stránku. Samostatné stránky pro katalog linek a katalog vozoven zatím neexistují. Statistiky nepředpokládají chybějící km, nesčítají soupravy dvakrát do osobních kilometrů a nezahrnují aktuální neuzavřený den ani budoucí směny.

### Propojení

- Přehled → související statistiky linek, vozů, vozoven, rekordů; poslední směny → detail směny.
- Směny → statistiky směn; detail směny → statistiky příslušného roku a linky; evidenční číslo → detail vozu.
- Vozy → statistiky vozů; detail vozu → jeho historie směn, statistiky vozů a rekordy.
- Statistiky → seznam směn, katalog vozů; linky → detail linky a jeho doložené směny; žebříček vozů → detail vozu.
- Všechny stránky používají jednu sdílenou hlavičku, menu a patičku.

### Známá omezení

- Web je záměrně **read-only**. Není zde tvorba, úprava ani mazání záznamů.
- Doložené BP nejsou v současných sedmi tabulkách načítaných frontendem; část detailu BP zůstává nedostupná.
- Fotografické galerie mají datové napojení, ale ověřené originály jsou zatím uloženy na soukromém Google Disku. Bez veřejně dostupné webové varianty (`photo_variants`) nelze garantovat zobrazení obrázku pro nepřihlášené návštěvníky; karta vždy odkazuje na originál s jeho přístupovými právy. Nutné také ověřit, že nasazené Apps Script API poskytuje všech pět foto tabulek.
- Rozsáhlejší analytika (např. porovnání více linek vedle sebe či samostatné nehodové statistiky) není implementována.
- Před vydáním je nutné ověřit produkční vykreslení na skutečných datech a spustit `node scripts/check.mjs` v běžném Node prostředí.
