# Apex (AstroCal) - Astronomical Planning & EXploration

![Status](https://img.shields.io/badge/status-alpha-orange) ![Version](https://img.shields.io/github/v/release/GFocacetti/apex-astrocal?include_prereleases&label=ultima%20release)

> ⚠️ **Versione alpha, ancora in fase di test.** Alcuni calcoli potrebbero contenere errori o essere soggetti a modifiche. Segnalazioni di bug e problemi sono benvenute tramite le [Issues](https://github.com/GFocacetti/apex-astrocal/issues).

Applicazione web per la pianificazione di osservazioni astronomiche: altezze planetarie annuali, effemeridi e opposizioni su 100 anni, inclinazione degli anelli di Saturno, eclissi solari e lunari visibili dalla propria posizione, librazioni lunari favorevoli e strumenti di calcolo per il setup visuale e fotografico. Tutti i calcoli sono basati sulle coordinate GPS dell'utente.

## Funzionalità

- **Altezza Annuale** — altezza massima di culminazione di Sole, Luna e pianeti per l'anno selezionato, con profilo mensile.
- **Effemeridi 100 Anni** — opposizioni planetarie, massime elongazioni e ciclo undecennale di attività solare dal 2026 al 2125.
- **Speciale Saturno** — simulatore interattivo dell'inclinazione degli anelli e classifica degli "anni d'oro" per l'osservazione.
- **Librazioni Lunari** — momenti favorevoli per osservare oltre il bordo visibile della Luna, con indicazione del lato del disco interessato, verifica dell'illuminazione solare e orari di alba/culmine/tramonto.
- **Eclissi GPS** — eclissi solari e lunari con visibilità, oscuramento e altezza calcolati per la propria posizione.
- **Calcolatori per il Telescopio** — ingrandimento, pupilla d'uscita, risoluzione angolare, campo reale oculare, magnitudine limite, campionamento deep-sky e planetario (con confronto sistema di guida), esposizione via regola NPF e guida ai filtri planetari.

## Stack tecnico

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) + [Vite](https://vitejs.dev/)
- [Tailwind CSS 4](https://tailwindcss.com/)
- [astronomy-engine](https://github.com/cosinekitty/astronomy) per i calcoli astronomici
- [Recharts](https://recharts.org/) per i grafici
- [Express](https://expressjs.com/) per servire l'app in produzione
- I calcoli più pesanti (effemeridi, eclissi, anelli di Saturno su 100 anni) girano in un Web Worker per non bloccare l'interfaccia

## Avvio in locale

**Prerequisiti:** Node.js 18+

```bash
npm install
npm run dev
```

L'app sarà disponibile su `http://localhost:3000`.

## Script disponibili

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | Avvia il server di sviluppo (Express + Vite) |
| `npm run build` | Build di produzione in `dist/` |
| `npm start` | Serve la build di produzione (richiede `npm run build`) |
| `npm run lint` | Type-check con TypeScript |
| `npm run clean` | Rimuove gli artefatti di build |

## Eseguibile Windows

### ⬇️ [Scarica Apex per Windows](https://github.com/GFocacetti/apex-astrocal/releases/latest/download/Apex.exe)

Un singolo file `.exe` **portable**: nessuna installazione, nessuna compilazione richiesta — si scarica e si avvia direttamente. Il link punta sempre all'ultima versione pubblicata. In alternativa è disponibile anche un installer tradizionale (`Apex-Setup.exe`) nella pagina [Releases](https://github.com/GFocacetti/apex-astrocal/releases).

### "Windows ha protetto il PC"

Al primo avvio, Windows SmartScreen mostra un avviso perché l'eseguibile non è firmato con un certificato a pagamento (normale per software indipendente/alpha, non un problema del codice). Per procedere: click su **"Ulteriori informazioni"**, poi **"Esegui comunque"**.

## Licenza

[GPL-3.0](LICENSE) © Giuseppe Focacetti
