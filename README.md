# TramStats

Funkční read-only sandbox osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Spuštění

Bez buildu a závislostí. Spusťte v kořeni `python -m http.server 8000` a otevřete localhost:8000. Přes file:// nemusí prohlížeč dovolit načtení JSON.

## Data

Statický snímek nového Tramvajování z 29. 10. 2026. Zdroj: https://docs.google.com/spreadsheets/d/1G-WI9H1T7sSH5g6IBZXzbCx-3lbVZ7Df8mrpM6jxR6E/edit

- `data/shifts-YYYY.json`: evidované dny včetně volna; pracovní části v `parts`. PS, SS a poznámky zachovány. Poznámky bez výkonu jsou na úrovni dne.
- `data/breaks-YYYY.json`: všech sedm zdrojových polí BP.
- `data/manifest.json`: rozsahy, počty a kontrolní součty.
- `scripts/import_xlsx.py`: opakovatelný import XLSX exportu; vyžaduje openpyxl. Použití: `python scripts/import_xlsx.py /path/to/export.xlsx`.

Zdrojový sešit se neupravuje. JSON se automaticky neaktualizuje. Rok 2026 obsahuje leden–září; 2024 má 335 evidovaných dnů. Chybějící dny se nedoplňují. `null` není nula. Zdrojové podtypy vozů se nedomýšlejí.

## Statistická pravidla

Pracovní směna je evidovaný den s pracovními částmi, mimo V, VVS, KS, D, PN, P16, MD. Volno a nepřítomnosti zůstávají v přehledu dnů. Více částí netvoří více směn. Rozsah je interval první–poslední části včetně BP a mezery šejdru; není prezentován jako odpracovaný čas.

Rozpad složené linky se použije pouze při jednoduchém součtu konstant v kmFormula se správným počtem složek a shodným součtem. Jinak km zůstávají nerozdělené. MJ není běžná tramvajová linka. Každá linka i fyzický vůz se v počtu směn započtou nejvýše jednou za den. Každý vůz soupravy dostává celé km své části; osobní součet i km podle typu započtou část jen jednou. U T3 je dostupný rozpad přední / zadní / sólo.

## Rozhraní a provoz

Přehled, hledání a filtry směn, rozbalení částí a BP, statistiky, hledání a řazení vozů, detaily vozů. Mobil má spodní navigaci a přeskupené řádky. Prostřední + vysvětluje read-only fázi. Ikony jsou lokální SVG podle tvarů Lucide; nejsou závislé na CDN. Web funguje i bez externích fontů.

GitHub Pages publikuje kořen větve main. Všechny aplikační cesty jsou relativní. Selhání jednotlivého JSON zachová ostatní data a zobrazí upozornění na neúplnost.

Manuální mobilní QA: `scripts/responsive-preview.html` zobrazí skutečný web v rámečku 360/390/768 px. Kontrola výpočtů: `node scripts/check.mjs`.
