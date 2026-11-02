# TramStats

Read-only frontend osobní tramvajové evidence. Živý web: https://anlexcz.github.io/tramstats/

## Aktuální rozsah

Repozitář je záměrně zúžený na dvě živé části:

- **Přehled / Dashboard**
- **Směny**

Statistiky, samostatný přehled vozů a detail směny byly odstraněny. Až se budou znovu stavět, vzniknou od nuly nad současnou datovou a doménovou vrstvou.

## Spuštění

Bez buildu a aplikačních závislostí. V kořeni lze spustit například `python -m http.server 8000` a otevřít `http://localhost:8000`.

## Data

Jediným runtime zdrojem je Google sešit **TramStats – databáze** přes Google Apps Script read-only API.

Tok dat:

`Google Sheets → read-only API → assets/data.js → UI`

Frontend aktuálně načítá jen tabulky potřebné Dashboardem a Směnami:

- `shifts`
- `shift_parts`
- `shift_part_lines`
- `vehicles`
- `depots`
- `lines`
- `shift_types`

`assets/data.js` normalizuje relační data do lehkého view modelu. Odpovědi se krátce cachují v `sessionStorage`; při nedostupnosti API se nepoužívá starý statický snapshot.

## Doménová logika směn

Společná pravidla jsou v `assets/shift-domain.js`. Dashboard i stránka Směny používají stejnou implementaci pro:

- bloky směny,
- `split_seq` u šejdru,
- rozsah a délku směny,
- přechod přes půlnoc,
- agregaci výkonů,
- Zálohu (`Z`),
- Cvičnou jízdu (`73`),
- skrytí `MJ` a `JP` v kompaktním přehledu,
- slučování linek stejného kurzu.

## Struktura UI

- `index.html` + `assets/dashboard-v2.js/.css` — Dashboard
- `shifts/index.html` + `assets/shifts-page.js/.css` — Směny
- `assets/shifts-date-range.js/.css` — datumový filtr Směn
- `assets/app.js/.css` — minimální společný shell a runtime
- `assets/components.css` — sdílené komponenty, aktuálně hlavně footer
- `assets/footer-v2.js` — footer

## Kontrola

Základní regresní kontrola:

`node scripts/check.mjs`

Test hlídá relační normalizaci, společnou doménovou logiku a také to, že se odstraněné legacy stránky, routy a komponenty do projektu nevrátí.
