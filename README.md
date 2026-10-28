# Avaluatró

Aplicació web inicial per avaluar les competències de secundària a partir d'evidències de proves, projectes i activitats.

## Inici

Com que l'aplicació està dividida en mòduls JavaScript natius, serveix la carpeta des d'un servidor HTTP local (els navegadors no permeten carregar aquests mòduls de manera fiable amb `file://`). No cal instal·lar dependències:

1. Obre un terminal a la carpeta del projecte.
2. Executa `python3 -m http.server 8000`.
3. Visita `http://localhost:8000`.

Atura el servidor amb `Ctrl+C`.

El codi d'arrencada i les accions de l'aplicació es troben a `app.js`. La carpeta `js/` separa la validació i les dades, els càlculs de notes, l'estat, les vistes i els formats compartits.

## Funcionalitats

- Crea grups classe amb desdoblaments opcionals, assigna-hi els alumnes i filtra la llista per classe o desdoblament.
- Crea assignatures i afegeix-hi targetes de nivell (de 1r a 4t d'ESO o 1r/2n de batxillerat). Cada nivell té els seus grups classe, una seqüència ordenada d'activitats i exàmens agrupats per situacions d'aprenentatge, hores previstes i contribucions per competència, i el seu propi progrés competencial. En obrir una rúbrica des d'un nivell, només hi apareixen els alumnes dels seus grups.
- Obre l'assignatura i després la targeta del nivell per consultar-ne el seguiment competencial. El botó «Obre seqüència» porta a una pàgina pròpia on pots afegir situacions d'aprenentatge i incorporar-hi activitats existents. També pots editar les dades de l'assignatura i del nivell.
- A la taula de seguiment del nivell, marca un alumne com a exempt de tota l'assignatura. A la taula d'avaluació d'una activitat, marca l'exempció només per a aquella activitat; les exempcions s'exclouen de les qualificacions i dels resums, i es poden retirar en qualsevol moment.
- A «Seguiment diari», tria assignatura, grup classe i data per registrar per alumne la participació, la preparació, l'autonomia i la col·laboració, amb una observació opcional. Els canvis es desen automàticament i es conserven a les còpies JSON i de Google Drive.
- Crea perfils d'alumnes amb els noms i cognoms en camps separats, i crea competències.
- Crea activitats amb evidències avaluables. Afegeix les competències vinculades a cada evidència des d'un desplegable i configura un pes independent per a cadascuna. El pes de l'evidència en la nota de l'activitat és la suma dels pesos de contribució a les competències que avalua.
- En obrir una activitat, consulta primer la rúbrica d'evidències, les competències a què contribueix cadascuna, el progrés d'avaluació i la nota mitjana de cada evidència; a sota, registra el nivell assolit per cada alumne i evidència.
- El resum de l'activitat mostra la mitjana, mediana, percentatge d'aprovats i alumnat avaluat, així com la distribució real de notes en comparació amb una campana de Gauss de referència. Cada punt correspon a un alumne i en mostra el nom i la nota en passar-hi el cursor.
- La rúbrica mostra un avís si la suma dels pesos de les evidències no és del 100%, perquè puguis revisar les contribucions assignades.
- A la taula d'avaluació d'una activitat, cerca alumnes o grups, filtra per grup i estat (avaluats, pendents, aprovats o no assolits) i ordena per nom, grup o nota. La barra de cerca i la barra horitzontal es mantenen fixes a la part superior mentre et desplaces per la llista.
- La llista d'activitats mostra per a cada targeta la nota mitjana, el percentatge d'aprovats (nota igual o superior a 5 entre l'alumnat avaluat) i el percentatge d'alumnes avaluats. Es pot obrir l'activitat fent clic a qualsevol punt de la targeta.
- Edita les competències i els detalls de les activitats i les seves rúbriques. Les avaluacions existents es mantenen per a les evidències que conservis; si elimines una evidència, també s'eliminen les seves notes.
- Registra el nivell assolit per alumne i evidència. La nota de l'activitat pondera les evidències per la suma dels seus pesos de contribució a les competències; la nota de cada competència pondera les evidències pel pes configurat per a aquella competència.
- Les qualificacions fan servir un codi de color coherent als indicadors i desplegables: inferior a 5 (warning/no assolit), 5–6,9 (en procés), 7–8,9 (assolit) i 9–10 (avançat). L'alumnat amb una nota d'activitat inferior a 5 queda marcat com a warning.
- Sempre que es mostra una qualificació, s'hi inclou la nota sobre 10 i la sigla textual corresponent: NA (<5), AS (5–<7), AN (7–<9) o AE (9–10). A la taula d'avaluació de cada activitat, el nom de l'alumne i la seva nota d'activitat queden fixos en desplaçar-se horitzontalment.
- Les dades s'emmagatzemen en format JSON a `localStorage` del navegador. Fes servir **Exporta JSON** per desar una còpia i **Importa** per restaurar-la o traslladar-la.
- Pots fer una còpia manual privada a Google Drive amb **Desa a Drive** i recuperar-la amb **Restaura Drive**. La restauració demana confirmació perquè substitueix les dades locals.
- La configuració de Google Drive és accessible des del perfil docent, a la part inferior de la barra lateral; també es pot obrir des del perfil en pantalles petites.
- La interfície utilitza les icones d'Iconoir CSS 7.12.1, carregades des de jsDelivr; cal connexió a internet perquè es mostrin.

## Dades i privacitat

Per defecte, aquest prototip no té servidor ni sincronització automàtica entre dispositius. Les dades es desen al navegador; esborrar-ne les dades pot eliminar-les. La còpia de Google Drive és opcional i manual, i usa l'àrea privada de dades de l'aplicació (`appDataFolder`): no apareix a la interfície de Drive i només aquesta aplicació hi pot accedir. Google demana autorització amb OAuth i l'aplicació no demana ni desa la contrasenya del compte. Evita introduir dades personals sensibles de l'alumnat i comprova les polítiques de protecció de dades del centre.

### Configurar Google Drive

1. A [Google Cloud Console](https://console.cloud.google.com/), crea o selecciona un projecte i activa **Google Drive API**.
2. Configura la pantalla de consentiment OAuth i crea un **Client ID d'aplicació web**. Afegeix com a orígens JavaScript autoritzats l'origen on serviràs l'aplicació, per exemple `http://localhost:8000` en desenvolupament i el domini HTTPS de producció. Si l'aplicació OAuth és en mode de proves, afegeix-hi els comptes que l'han de provar.
3. Serveix l'aplicació per HTTP/HTTPS (no obris `index.html` directament amb `file://`) i prem **Configura Drive**. Introdueix el Client ID públic de l'aplicació web i prem **Desa i connecta**.
4. Google obrirà el flux oficial de selecció de compte i consentiment OAuth; en autoritzar-lo, l'aplicació desarà la còpia actual. El Client ID es desa només a l'emmagatzematge local del navegador. El permís demanat és només `drive.appdata`; no introdueixis mai la contrasenya de Gmail ni cap secret de client a l'aplicació.

**Desa a Drive** crea o actualitza el fitxer únic `avaluatro-backup.json` a l'àrea privada de l'aplicació. **Restaura Drive** valida la còpia abans de demanar confirmació i substituir les dades d'aquest navegador. No és una sincronització automàtica ni permet compartir aquesta còpia amb altres aplicacions o usuaris. Conserva també còpies JSON independents.

## Format de dades

Els JSON exportats també poden incloure les col·leccions `dailyAssessments`, `subjectExemptions` i `activityExemptions`, amb els seguiments diaris i les exempcions per alumne. Els fitxers antics sense aquestes col·leccions es migren automàticament amb llistes buides.

Els fitxers exportats són JSON amb `schemaVersion: 1` i les col·leccions `classGroups`, `students`, `competencies`, `activities`, `subjects`, `assessments`, `dailyAssessments`, `subjectExemptions` i `activityExemptions`. Les exempcions d'assignatura vinculen un alumne i una assignatura; les d'activitat vinculen un alumne i una activitat. Les activitats contenen `evidences`; cada evidència inclou un mapa `contributions` amb el pes específic per competència, i el seu pes en l'activitat es calcula com la suma d'aquestes contribucions. Les dades antigues amb `criteria` es migren automàticament a evidències i conserven els identificadors de les notes. Cada assignatura conté nivells amb grups classe, competències avaluades i seqüències independents; cada nivell desa les situacions d'aprenentatge a `situations` i cada element de seqüència hi apunta amb el nom `situation`. Els nivells antics migren automàticament els noms de situació dels elements de seqüència; els elements sense aquest camp s'assignen a «Situació d'aprenentatge 1». Les contribucions de les activitats d'un nivell només es configuren per a les competències assignades a aquell nivell. Els nivells exportats anteriorment sense `competencyIds` migren automàticament amb totes les competències existents seleccionades. Els alumnes tenen els camps `firstName` i `lastName`; els registres anteriors amb un únic camp `name` s'adapten automàticament, prenent la primera paraula com a nom i la resta com a cognoms. Les assignatures exportades amb el nivell, els grups i la seqüència en el format anterior es migren automàticament a un únic nivell. Els JSON anteriors sense `classGroups`, `subjects`, `dailyAssessments` ni les col·leccions d'exempcions també s'adapten automàticament. L'esquema versionat facilita afegir més endavant una API i persistència al núvol.
