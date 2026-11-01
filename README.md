# TramStats

Funkční read-only sandbox osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Spuštění

Bez buildu a aplikačních závislostí. Spusťte v kořeni `python -m http.server 8000` a otevřete `http://localhost:8000`.

## Data

Jediným zdrojem dat je Google sešit **TramStats – databáze**. GitHub repozitář už neobsahuje statické JSON snapshoty směn ani BP.

Tok dat:

`Google Sheets (TramStats – databáze) → Google Apps Script read-only API → assets/live-source.js → frontend`

Web načítá tabulky:

- `shifts`
- `shift_parts`
- `shift_part_lines`
- `breaks`
- `vehicles`

`assets/live-source.js` převádí relační data do formátu očekávaného současným frontendem. Apps Script endpoint je pouze pro čtení; frontend nemá zapisovací operace do Google Sheets.

Změna v databázi je po novém načtení stránky dostupná webu bez exportu, commitu nebo generování datových souborů.

## Statistická pravidla

Pracovní směna je evidovaný den s pracovními částmi, mimo V, VVS, KS, D, PN, P16 a MD. Volno a nepřítomnosti zůstávají v přehledu dnů. Více částí netvoří více směn. Rozsah je interval první–poslední části včetně BP a mezery šejdru; není prezentován jako čistá doba řízení ani odpracovaný čas.

Rozpad složené linky vychází z `shift_part_lines`. Pokud přesný rozpad km není uložený, frontend jej nevymýšlí. MJ není běžná tramvajová linka. Každá linka i fyzický vůz se v počtu směn započtou nejvýše jednou za den. Každý vůz soupravy dostává celé km své části; osobní součet i km podle typu započtou část jen jednou.

Typ konkrétního vozu se bere z master tabulky `vehicles`, pokud odpovídá evidovanému vozu/soupravě.

## Rozhraní a provoz

Přehled, hledání a filtry směn, rozbalení částí a BP, statistiky, hledání a řazení vozů a detaily vozů. Mobil má spodní navigaci a přeskupené řádky.

GitHub Pages publikuje kořen větve `main`. Při nedostupnosti Google Apps Script API se nezobrazí starý snapshot; aplikace hlásí neúplné/nedostupné načtení.

Manuální mobilní QA: `scripts/responsive-preview.html`. Kontrola základní frontendové logiky a živého adaptéru: `node scripts/check.mjs`.
