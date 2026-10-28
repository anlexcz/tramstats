# TramStats — design sandbox

První read-only prototyp webového rozhraní TramStats určený výhradně pro ladění designu a informační architektury.

## Co je uvnitř

- dark UI podle pracovní designové specifikace;
- desktopová horní navigace a samostatná mobilní spodní navigace;
- dashboard, přehled směn, jednoduché statistiky a přehled vozů;
- data načítaná z JSON fixture místo databáze;
- žádné přidávání, úpravy ani mazání dat.

## Data

`data/shifts-2026.json` je reprezentativní výřez skutečných záznamů z Tramvajování pro účely designového prototypu. Struktura už míří směrem k navrženému relačnímu modelu: směna obsahuje jednotlivé části výkonu.

Zdrojová tabulka zůstává zdrojem pravdy. JSON je pouze sandboxová kopie pro frontend.

## Lokální spuštění

Kvůli načítání JSON přes `fetch()` je vhodné spustit adresář přes jednoduchý HTTP server, například:

```bash
python -m http.server 8080
```

Potom otevřít `http://localhost:8080`.

## Stav

V1 je záměrně read-only. Následující iterace mají řešit především vzhled konkrétních obrazovek, hustotu dat, seskupování vícedílných směn, mobilní variantu a podobu grafů.