import React from 'react';
import { Eye, Sparkles, BookOpen, Info } from 'lucide-react';
import { DismissibleInfoPanel } from './DismissibleInfoPanel';

interface TabFilterGuidesProps {
  section: 'visual' | 'imaging';
}

export const TabFilterGuides: React.FC<TabFilterGuidesProps> = ({ section }) => {
  return (
    <div className="space-y-10">
      {/* Banner */}
      <div className="page-header">
        <div className="max-w-3xl">
          <div className="eyebrow">Guide ai filtri</div>
          <h2 className="page-title">{section === 'visual' ? 'Filtri per la visuale' : 'Filtri per deep e planetario'}</h2>
          <p className="lead">
            Guide di riferimento per scegliere il filtro giusto in base al target e alla tecnica (osservazione visuale o ripresa fotografica).
          </p>
        </div>
      </div>

      {section === 'visual' && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="section-title">
              Filtri per l'Osservazione Visuale
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Planet Filter Quick Guide */}
            <div className="lg:col-span-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <h3 className="text-base font-semibold text-neutral-100">
                  Filtri per i pianeti
                </h3>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Filtro Giallo Wratten #12 / #15 (Saturno)</span>
                  Migliora il contrasto delle fasce atmosferiche di Saturno e fa risaltare la Divisione di Cassini nell'anello A e B.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Filtro Azzurro Wratten #80A (Giove)</span>
                  Aumenta il contrasto della Grande Macchia Rossa (GMR) e dei festoni nelle cinture equatoriali gioviane.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-warn block mb-0.5">Filtro Rosso / Arancio Wratten #21 / #23A (Marte)</span>
                  Evidenzia i mari scuri di Marte (Syrtis Major) e la calotta polare di anidride carbonica.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-100 block mb-0.5">Filtro Astrosolar / H-Alfa (Sole)</span>
                  Per la fotosfera usa Astrosolar ND 5.0 (visibile) o filtri H-Alfa Etalon per protuberanze e filamenti solari.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Filtro Viola Wratten #47 (Venere)</span>
                  Rivela le bande nuvolose nell'atmosfera di Venere, quasi invisibili in luce bianca; richiede telescopi con buona trasmissione nel blu/violetto.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Filtro Verde Wratten #56 / #58 (Giove)</span>
                  Alternativa al filtro azzurro: aumenta il contrasto della Grande Macchia Rossa e delle cinture rispetto alle zone chiare.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-300 block mb-0.5">Filtro a Densità Neutra / Polarizzatore (Luna)</span>
                  Riduce l'abbagliamento della Luna, specialmente vicino al plenilunio, per un'osservazione più comoda e un miglior contrasto percepito dei crateri.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-100 block mb-0.5">Filtro Anti-Frangia / Minus Violet (Multiuso)</span>
                  Su rifrattori acromatici riduce la frangia viola dovuta all'aberrazione cromatica, utile su Luna e pianeti molto luminosi.
                </div>
              </div>
            </div>

            {/* Deep Sky Filter Quick Guide */}
            <div className="lg:col-span-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <h3 className="text-base font-semibold text-neutral-100">
                  Filtri per il deep-sky
                </h3>
              </div>

              <DismissibleInfoPanel
                id="guide-deep-sky-filters-note"
                icon={<Info className="w-4 h-4 text-neutral-200 shrink-0 mt-0.5" />}
                className="bg-neutral-950/60 border border-neutral-800 rounded-md p-3 flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed"
              >
                A differenza dei filtri planetari (che modificano il colore per aumentare il contrasto), questi filtri per
                l'osservazione visuale del cielo profondo tagliano fisicamente le lunghezze d'onda dell'inquinamento
                luminoso o isolano le righe di emissione di gas e nebulose: più stretta è la banda passante, più il
                filtro è efficace su nebulose a emissione, ma più attenua anche le stelle di campo.
              </DismissibleInfoPanel>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">UHC (Ultra High Contrast, banda larga)</span>
                  Buon compromesso generalista per nebulose a emissione e planetarie (Laguna, Trifida, Nord America, Anello M57, Manubrio M27); funziona bene anche da cieli suburbani.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">OIII (banda strettissima, ~496/501 nm)</span>
                  Il più efficace su nebulose planetarie e resti di supernova (Anello M57, Manubrio M27, Velo del Cigno, Elica NGC 7293); attenua molto le stelle, rende meglio su aperture medio-grandi.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">H-Beta (banda strettissima, ~486 nm)</span>
                  Filtro di nicchia per poche nebulose deboli specifiche (California NGC 1499, Testa di Cavallo IC 434, Nord America NGC 7000); serve un cielo molto buio per dare risultati apprezzabili.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">LPS / CLS (banda larga anti-inquinamento luminoso)</span>
                  Blocca le righe tipiche dell'illuminazione stradale (sodio, mercurio, LED) senza isolare una singola riga di emissione; utile in città anche su ammassi e galassie, ma con meno contrasto delle narrowband sulle nebulose a emissione.
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {section === 'imaging' && (
        <>
          <div className="flex items-center gap-2">
            <h3 className="section-title">
              Filtri per la Fotografia Deep e Planetaria
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Deep Sky Imaging Filter Quick Guide */}
            <div className="lg:col-span-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <h3 className="text-base font-semibold text-neutral-100">
                  Filtri per la fotografia deep-sky
                </h3>
              </div>

              <DismissibleInfoPanel
                id="guide-deep-sky-imaging-filters-note"
                icon={<Info className="w-4 h-4 text-neutral-200 shrink-0 mt-0.5" />}
                className="bg-neutral-950/60 border border-neutral-800 rounded-md p-3 flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed"
              >
                A differenza dei filtri visuali, in posa lunga puoi isolare singole righe di emissione anche con camere
                a colori (OSC), perché il sensore integra la luce nel tempo invece di affidarsi alla sensibilità
                istantanea dell'occhio: per questo qui compaiono filtri narrowband da usare anche in città o con la Luna
                alta in cielo.
              </DismissibleInfoPanel>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-warn block mb-0.5">Ha - Hydrogen-Alpha (~656 nm, narrowband)</span>
                  Il filtro cardine per le nebulose a emissione (Cuore, Anima, Nord America, America); funziona anche con Luna piena o forte inquinamento luminoso, dato che isola una riga molto lontana dalle emissioni artificiali.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">OIII (~501 nm, narrowband)</span>
                  Cattura l'ossigeno ionizzato di nebulose planetarie e resti di supernova (Velo del Cigno, M57, M27); combinato con Ha e SII forma la palette Hubble (SHO) per camere monocromatiche.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">SII - Sulfur-II (~672 nm, narrowband)</span>
                  Isola lo zolfo ionizzato, tipicamente il canale più debole nella palette SHO; utile soprattutto su grandi resti di supernova e regioni HII strutturate.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Dual/Tri-Band per OSC (es. L-eXtreme, L-eNhance, NBZ)</span>
                  Lascia passare contemporaneamente Ha+OIII (dual) o Ha+OIII+SII (tri) in un unico scatto a colori: la scelta più pratica per riprendere nebulose a emissione con camere One-Shot-Color o DSLR modificate da cieli cittadini.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Anti-Inquinamento a Banda Larga (es. L-Pro, LPS-D3)</span>
                  Per soggetti a spettro continuo come galassie e ammassi stellari, dove il narrowband non aiuta perché non emettono su righe specifiche; riduce comunque il fondo cielo dovuto all'illuminazione artificiale.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-300 block mb-0.5">UV/IR Cut</span>
                  Filtro di base quasi indispensabile su camere OSC/DSLR: blocca l'infrarosso (che il sensore vede benissimo ma il tuo telescopio spesso non mette a fuoco insieme al visibile, causando aloni e stelle gonfie) e l'ultravioletto, per colori corretti e stelle più nitide.
                </div>
              </div>
            </div>

            {/* Planetary Imaging Filter Quick Guide */}
            <div className="lg:col-span-6 bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 space-y-3">
              <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                <h3 className="text-base font-semibold text-neutral-100">
                  Filtri per l'imaging planetario
                </h3>
              </div>

              <DismissibleInfoPanel
                id="guide-planetary-imaging-filters-note"
                icon={<Info className="w-4 h-4 text-neutral-200 shrink-0 mt-0.5" />}
                className="bg-neutral-950/60 border border-neutral-800 rounded-md p-3 flex items-start gap-2 text-[11px] text-neutral-400 leading-relaxed"
              >
                Nell'imaging planetario si riprendono migliaia di singoli fotogrammi (video) da impilare col lucky
                imaging: qui i filtri servono soprattutto a combattere il seeing e a costruire il colore canale per
                canale, non solo ad aumentare il contrasto come nell'osservazione visuale.
              </DismissibleInfoPanel>

              <div className="space-y-2.5 text-xs">
                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-warn block mb-0.5">Set RGB per Camere Mono (es. Baader, Astronomik RGB)</span>
                  Con una camera monocromatica e ruota portafiltri, riprendi tre video separati (rosso, verde, blu) e li combini in post-produzione: risoluzione e nitidezza superiori rispetto a una camera a colori a parità di sensore.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">IR-Pass / "ProPlanet" (685 / 742 / 807 nm)</span>
                  L'infrarosso attraversa la turbolenza atmosferica con meno disturbo del visibile: con cattivo seeing, riprendere solo in IR (camera mono) spesso restituisce più dettaglio netto di un'immagine a colori, anche se in scala di grigi.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-300 block mb-0.5">UV/IR Cut</span>
                  Su camere planetarie a colori (OSC) evita che l'infrarosso, a fuoco leggermente diverso dal visibile, ammorbidisca l'immagine; da montare sempre a meno di voler lavorare deliberatamente in IR-pass.
                </div>

                <div className="p-3 bg-neutral-950 rounded-md border border-neutral-800/80">
                  <span className="font-semibold text-neutral-200 block mb-0.5">Banda del Metano (~889 nm)</span>
                  Filtro avanzato di nicchia: il metano nelle atmosfere di Giove, Saturno, Urano e Nettuno assorbe fortemente a questa lunghezza d'onda, rivelando strutture nuvolose e la Macchia Rossa con un aspetto completamente diverso dal visibile.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
