# Intro immersiva e nuova lobby — Design

**Data:** 2026-07-12 · **Stato:** approvato a voce sezione per sezione, in attesa di revisione finale sul documento.

## Obiettivo

Sostituire l'attuale lobby (pannello centrato su carta statica) con un'esperienza d'ingresso "wow" in stile giapponese sumi-e:

- **Cinematica d'ingresso** orchestrata (~4,5 s), skippabile con un tap.
- **Panorama animato** dietro a tutto: montagne, sole, albero d'acero a sinistra da cui **si staccano foglie rosse** che derivano col vento, foschia lenta. Senso di attesa.
- **Menu fisso a destra** in stile "pennellate flottanti": nessun pannello, bottoni = pennellate d'inchiostro vere (PNG) sospese sul panorama, colonna calligrafica in filigrana, sigillo hanko rosso.
- Vale per **tutte le schermate della lobby** (menu → multiplayer → attesa → avversario uscito): il panorama non si interrompe mai, cambia solo il contenuto della colonna.
- **Transizione verso il duello**: sequenza di pennellate nere che coprono la vista, poi si "asciugano" e svaniscono rivelando il campo che si costruisce **in volo all'indietro** (bird-view → inquadratura di gioco).
- Palette: pergamena, nero, rosso vermiglio. Su mobile portrait il menu è centrato, la scena resta sullo sfondo.

## Architettura (approccio scelto: ibrido)

La logica di sessione **non cambia**: `AppRoot` resta il gate (`status !== "playing"` → lobby; altrimenti `GameProvider` + `Scene`, con remount per sessione). In ogni istante è attivo **un solo canvas**; lo swap lobby→gioco avviene sotto il velo d'inchiostro.

### Nuovi componenti 3D (canvas R3F dedicato alla lobby)

- `sections/LobbyScene/` — Canvas leggero che riusa `Stage`, `Floor`, `FitCamera` e `ParallaxLayer` (stessa arte e stessa parallasse del gioco) più gli atomi nuovi sotto. Sostituisce l'immagine statica del `Backdrop`. DPR cappato su mobile.
- `atoms/FallingLeaves/` — foglie d'acero come **sprite istanziate GPU** (~30–40, un draw call). Ogni foglia nasce da un **emettitore allineato alla chioma dell'albero** (in alto a sinistra): piccolo distacco (rotazione + spinta), caduta lenta (8–14 s a schermata), oscillazione sinusoidale, raffiche di vento globali, deriva verso destra. Le foglie uscite dallo schermo rientrano dalla chioma, mai da punti a caso. Due profondità: poche dietro la foschia (piccole, pallide), la maggior parte davanti alle montagne. La matematica tempo→posizione è in **funzioni pure esportate** (testabili).
- `atoms/Mist/` — 2–3 piani larghi con gradiente alpha **procedurale** (come `floorTexture`, zero asset) in deriva quasi impercettibile.

Nella scena lobby il layer `4-tree.png` è ancorato al bordo sinistro, più grande e più in primo piano che nel duello: albero a sinistra ↔ menu a destra, montagne e sole al centro.

Tutti i materiali di scena restano **unlit** (`meshBasicMaterial`, `toneMapped:false`), da convenzione.

### Nuovi componenti DOM (il menu resta HTML + Framer Motion)

- `atoms/InkStrokeButton/` — bottone-pennellata: texture PNG di pennellata reale, testo pergamena sopra, hover = la pennellata si allunga leggermente e "sanguina" ai bordi; il primario porta un piccolo sigillo hanko rosso all'estremità. Tre texture di forma diversa, ruotate/specchiate per le varianti. Sostituisce `InkButton` in tutta la lobby.
- I flussi in `net/components/` (Menu, MultiplayerLobby, Waiting, PeerLeft) **restano invariati come logica**; cambia la presentazione: colonna destra (~1/3 dello schermo, senza pannello) in landscape/desktop, pila centrata su portrait. Cambi schermata = cross-fade + lieve scivolamento verticale, il panorama non si tocca.
- `sections/InkTransition/` — velo d'inchiostro DOM full-screen (vedi Transizione).

### Layout & Leva

Costanti nuove in `layout.ts` in oggetti ben definiti (convenzione): `LOBBY` (colonna menu, emettitore foglie, parametri vento/foschia, posa albero) e `INTRO` (tempi della cinematica e del volo). Cartelle Leva dedicate e collassate: "Lobby", "Intro".

## Design visivo

### La scena (senso di attesa)

Tutto lento: foglie 8–14 s a schermata, foschia in deriva minima, parallasse al puntatore + drift da fermo (già in `ParallaxLayer`). Il quadro respira anche senza input.

### Il menu (stile "pennellate flottanti")

Dall'alto della colonna destra: logo Kiri-ai ridotto (drop-shadow morbida) → colonna calligrafica verticale in filigrana (PNG a inchiostro pieno, opacità ~15% data dal codice) → bottoni-pennellata. Schermata attesa: la parola-chiave è un **timbro hanko rosso** ben grande; la diagnostica di rete resta, piccola, sotto (serve sul mobile). "Annulla/indietro" = pennellata sottile fantasma. Campo keyword su striscia di pergamena.

### Cinematica d'ingresso (~4,5 s, skippabile)

1. **0,0–1,2 s — L'inchiostro si stende.** Solo carta washi; le montagne emergono una per volta (lontana → vicina), da sfocate e pallide a nitide.
2. **0,8–2,0 s — Il sole, l'albero e la foschia.** Il sole vermiglio sboccia; l'albero si dipinge a sinistra (tronco poi chioma); la foschia scivola dentro.
3. **1,5–3,0 s — Le foglie si staccano.** Le prime foglie nascono dalla chioma e prendono il ritmo di regime.
4. **2,5–4,5 s — Il menu si dipinge.** La calligrafia si rivela dall'alto in basso (wipe a pennello), i bottoni si "dipingono" da sinistra a destra uno dopo l'altro, il logo appare.

Un tap in qualsiasi momento porta la timeline allo stato finale (gsap `progress(1)` + Motion senza delay). I bottoni sono cliccabili appena visibili; un tap su un bottone durante la cinematica esegue entrambe le cose (skip + azione del bottone), un tap su area vuota fa solo skip.

### Transizione verso il duello

1. **Copertura (~0,8 s).** Alla pressione di "Passa e gioca" (o quando l'avversario si unisce), **3–5 pennellate giganti** con angoli e forme diversi spazzano lo schermo una dopo l'altra, sovrapponendosi fino a coprire tutto di nero.
2. **Swap.** Sotto il velo: il canvas lobby smonta, il gioco monta. Il velo non inizia a dissolversi finché la scena di gioco non segnala di essere pronta (texture già precaricate → in pratica immediato).
3. **Asciugatura (~0,7 s).** Le pennellate si "asciugano" in ordine: i bordi si schiariscono e granulano per primi, come sumi che asciuga sulla carta, poi ogni pennellata va in fade-out rivelando la scena già in movimento.
4. **Rivelazione in volo (~2,5 s).** La camera parte alta e vicina in bird-view e arretra/si livella fino all'inquadratura di `FitCamera`, mentre: la linea si traccia, i rombi si stampano, le pedine calano, la scenografia scivola al suo posto. Chiude la cascata delle carte in mano (già esistente). `FitCamera` acquisisce una modalità "cinematica": durante il volo non forza la posizione, poi riprende il controllo **senza salto percepibile**.

## Asset

Pipeline collaudata: generazione su **campo verde pieno** + `scripts/cutout_layers.py` (mai scacchiera, mai JPEG per gli alpha).

| Asset | Uso | Note |
|---|---|---|
| 3 pennellate orizzontali PNG | bottoni menu | forme diverse; ruotate/specchiate per varianti |
| 1–2 foglie d'acero PNG | sprite particelle | ~128 px, rosso vermiglio |
| 1 colonna calligrafica PNG | filigrana dietro il menu | kanji verticali, inchiostro pieno |
| 2–3 pennellate giganti PNG | velo della transizione | riusate ruotate/specchiate nella sequenza |

Foschia e sigillo hanko: procedurali (canvas/SVG). Albero, montagne, sole, carta: già in `public/images/backgroud/`.

## Casi limite ed errori

- **WebGL non disponibile / canvas in errore** → fallback al `Backdrop` statico attuale: menu sempre funzionante, mai schermo vuoto.
- **`prefers-reduced-motion`** → niente cinematica né volo (stato finale diretto), foglie quasi a zero.
- **Mobile modesto** → DPR cappato, ~20 foglie, foschia semplificata.
- **Input mai ostaggio della regia**: tap = skip; se durante la cinematica arriva un cambio di stato online (es. avversario entra), la cinematica si completa all'istante e appare la schermata giusta.
- **Swap canvas coperto dal velo**, che attende il "pronto" della scena di gioco.

## Verifica e criteri d'accettazione

- Il motore (`src/common/game/`) non viene toccato; `yarn lint`, `yarn build`, `yarn test` restano verdi.
- La matematica delle foglie (tempo → posizione/rotazione) è in funzioni pure con unit test vitest.
- Il volo termina **esattamente** sull'inquadratura di `FitCamera` (handoff senza salto): criterio esplicito.
- Verifica manuale: desktop, portrait (devtools), reduced-motion emulato, flusso online completo (crea → attesa → ingresso avversario), e fallback WebGL.

## Fuori perimetro

- Nessuna modifica a regole, motore, protocollo di rete o HUD di gioco.
- Audio/musica dell'intro: non incluso (eventuale iterazione futura).
- La grafica in-game del duello (Stage/Floor esistenti) resta com'è, salvo la nuova animazione di mount.
