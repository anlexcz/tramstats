# TramStats

Read-only frontend osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Aktuální rozsah

Živé části:

- **Přehled / Dashboard**
- **Směny**
- **Detail směny** (`/smeny/{yyyymmdd}/`)
- **Vozy** (`/vozy/`)
- **Detail vozu** (`/vozy/{evc}/`)

Statistiky a další entity se budou doplňovat nad současnou datovou a doménovou vrstvou.

## Spuštění

Bez buildu a aplikačních závislostí. V kořeni lze spustit například `python -m http.server 8000` a otevřít `http://localhost:8000`.

## Data

Jediným runtime zdrojem je Google sešit **TramStats – databáze** přes Google Apps Script read-only API.

Tok dat:

`Google Sheets → read-only API → assets/data.js → doménové vrstvy → UI`

Frontend aktuálně načítá:

- `shifts`
- `shift_parts`
- `shift_part_lines`
- `vehicles`
- `depots`
- `lines`
- `shift_types`

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

Fotografie jsou navázané na konkrétní `ShiftPart`.

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

Dynamické detailové URL na GitHub Pages obsluhuje `404.html` podle typu cesty.

## Kontrola

Základní regresní kontrola:

`node scripts/check.mjs`

Test hlídá relační normalizaci, doménovou logiku směn a vozů a přítomnost aktuálních runtime modulů.


## Navigace a úplnost souhrnů

Seznamy uchovávají filtry, hledání, počet načtených řádků a pozici v rámci relace prohlížeče. Zablokované sessionStorage nebrání používání webu.

Neznámé km a časy se zobrazují jako `—`; částečně známé součty jako `≥ hodnota`. Skutečná nula zůstává nulou. Dashboard u neúplných souhrnů neukazuje číselný trend a extrémy vybírá jen z úplných hodnot. Počet výskytů vozu znamená počet částí výkonu, nikoli počet směn.
