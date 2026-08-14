# Apex (AstroCal) - Astronomical Planning & EXploration

![Status](https://img.shields.io/badge/status-alpha-orange) ![Version](https://img.shields.io/github/v/release/GFocacetti/apex-astrocal?include_prereleases&label=ultima%20release)

> ⚠️ **Versione alpha, ancora in fase di test.** Alcuni calcoli potrebbero contenere errori o essere soggetti a modifiche. Segnalazioni di bug e problemi sono benvenute tramite le [Issues](https://github.com/GFocacetti/apex-astrocal/issues).

Applicazione web per la pianificazione di osservazioni astronomiche: altezze planetarie annuali, effemeridi e opposizioni su 100 anni, inclinazione degli anelli di Saturno, eclissi solari e lunari visibili dalla propria posizione, librazioni lunari favorevoli e strumenti di calcolo per il setup visuale e fotografico. Tutti i calcoli sono basati sulle coordinate GPS dell'utente.

## Funzionalità

- **Quando osservare** — altezza massima di culminazione di Sole, Luna e pianeti per l'anno selezionato, con profilo mensile e diametro apparente confrontato con il massimo raggiungibile.
- **Cicli di lungo periodo** — opposizioni planetarie, massime elongazioni e ciclo undecennale di attività solare dal 2026 al 2125.
- **Speciale Saturno** — simulatore interattivo dell'inclinazione degli anelli e classifica degli "anni d'oro" per l'osservazione.
- **Librazioni Lunari** — momenti favorevoli per osservare oltre il bordo visibile della Luna, con indicazione del lato del disco interessato, verifica dell'illuminazione solare e orari di alba/culmine/tramonto.
- **Eclissi GPS** — eclissi solari e lunari con visibilità, oscuramento e altezza calcolati per la propria posizione.
- **Calcolatori per il Telescopio** — ingrandimento, pupilla d'uscita, risoluzione angolare, campo reale oculare, magnitudine limite, campionamento deep-sky e planetario (con confronto sistema di guida), esposizione via regola NPF e guida ai filtri planetari.

### Simulatori interattivi

Dieci simulatori didattici che mostrano l'effetto in tempo reale invece di spiegarlo a parole. I calcoli sono quelli reali, non animazioni preconfezionate.

- **Campo Apparente Oculare** — perché il campo apparente e l'ingrandimento sono due cose diverse.
- **Seeing & Dispersione (ADC)** — la dispersione atmosferica alle basse altezze e come la corregge un ADC.
- **Rotazione di Campo** — Alt-Azimutale contro Equatoriale, con la posa cumulativa che trasforma le stelle in archi.
- **SNR & Stacking** — la resa non lineare dello stacking e il peso dell'inquinamento luminoso, con la scala di Bortle e una guida per stimarla a occhio.
- **Maschera di Bahtinov** — come si legge il pattern di diffrazione per mettere a fuoco.
- **LRGB vs OSC** — matrice di Bayer e demosaicizzazione a confronto con il mono a piena risoluzione.
- **Collimazione** — star test defocalizzato su Newton o SCT, con le tre viti che si comportano come sul telescopio vero.
- **Backfocus** — perché una spaziatura sbagliata sfilaccia gli angoli lasciando il centro puntiforme.
- **Allineamento Polare** — la Polare nel cannocchiale polare, posizionata dal tempo siderale reale della propria località.
- **Autoguida** — errore periodico, deriva e aggressività, con la curva RMS che mostra perché correggere troppo peggiora.

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

### ⬇️ [Scarica Apex per Windows](https://github.com/GFocacetti/apex-astrocal/releases/download/v0.7.2-alpha/Apex-0.7.2-alpha-win-x64.zip)

Un archivio **portable**: nessuna installazione e nessuna compilazione richiesta. Scompatta lo ZIP dove preferisci e avvia `Apex.exe`. In alternativa, nella pagina [Releases](https://github.com/GFocacetti/apex-astrocal/releases) trovi anche l'installer tradizionale `Apex-Setup-<versione>.exe`.

### "Windows ha protetto il PC"

Al primo avvio Windows SmartScreen mostra un avviso perché l'eseguibile non è firmato con un certificato a pagamento: è normale per software indipendente e non indica un problema del codice. Per procedere: **"Ulteriori informazioni"** → **"Esegui comunque"**.

### Se l'antivirus segnala il download

Può capitare che Windows Defender segnali un file appena pubblicato con un avviso generico del tipo `Wacatac.B!ml`. Il suffisso `!ml` indica un verdetto **euristico** del modello di machine learning, non il riconoscimento di codice malevolo noto: si attiva tipicamente su eseguibili non firmati e senza ancora una reputazione, cioè scaricati da pochissime persone.

Per ridurre il problema la distribuzione portable è un archivio ZIP invece di un eseguibile auto-estraente, che era la causa principale delle segnalazioni. Se ne ricevi comunque una puoi verificare tu stesso il file caricandolo su [VirusTotal](https://www.virustotal.com/), che lo analizza con decine di motori diversi.

## Licenza

[GPL-3.0](LICENSE) © Giuseppe Focacetti
