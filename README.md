# TramStats

Funkční read-only sandbox osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Spuštění

Bez buildu a aplikačních závislostí. Spusťte v kořeni `python -m http.server 8000` a otevřete `http://localhost:8000`.

## Data

Jediným runtime zdrojem dat je Google sešit **TramStats – databáze**. GitHub repozitář neobsahuje ani neemuluje statické JSON snapshoty směn nebo BP.

Tok dat:

`Google Sheets (TramStats – databáze) → Google Apps Script read-only API → assets/data.js → UI`

Datová vrstva načítá relační tabulky potřebné frontendem:

- `shifts`
- `shift_parts`
- `shift_part_lines`
- `breaks`
- `vehicles`
- `depots`
- `lines`
- `shift_types`
- `shift_courses`
- `tags`
- `shift_part_tags`

`assets/data.js` drží relační tabulky a indexy a vytváří pouze lehký view model pro současné UI. Linkové statistiky používají přímo řádky `shift_part_lines`; neexistuje `kmFormula` ani compatibility manifest. Svačinář se bere pouze z `shift_courses.is_snack`, typ/family fyzického vozu z masteru `vehicles` a provozní metadata z `tags` + `shift_part_tags`.

Po dobu jedné browser session se odpovědi veřejných tabulek cachují krátce v `sessionStorage`, aby přechody mezi stránkami zbytečně neopakovaly celý download. Při nedostupnosti API aplikace nezobrazí žádný starý snapshot.

## Statistická pravidla

Pracovní směna je evidovaný den s pracovními částmi, mimo V, VVS, KS, D, PN, P16 a MD. Volno a nepřítomnosti zůstávají v přehledu dnů. Více částí netvoří více směn.

Osobní km části se započítají jednou. U soupravy dostane každý fyzický vůz do své vozové statistiky km dané části, ale osobní součet se tím nenásobí. Rozpad složené linky vychází z `shift_part_lines`; neznámé linkové km se nedopočítávají.

BP se načítají z `breaks` a respektují `shift_date`, `break_no` a `start_day_offset`, takže přestávka po půlnoci zůstává u data nástupu směny.

## Rozhraní a provoz

Přehled, hledání a filtry směn, detail částí a BP, statistiky a přehled vozů. Mobil má spodní navigaci a přeskupené řádky.

GitHub Pages publikuje kořen větve `main`. Kontrola základní relační logiky: `node scripts/check.mjs`.
