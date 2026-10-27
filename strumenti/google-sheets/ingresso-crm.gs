/**
 * Hair Genius Labs · invio dei lead dal foglio Google al CRM.
 *
 * ⚠️ PROGETTO AUTONOMO: va creato su script.google.com (Nuovo progetto) con
 * l'account del titolare. NON dentro il foglio (Estensioni → Apps Script): le
 * Proprietà di uno script legato al foglio le legge chiunque possa modificare
 * il foglio, e il foglio lo usano le persone che lavorano ai lead. Questo
 * script apre il foglio per id (SpreadsheetApp.openById) e mette i suoi
 * trigger con forSpreadsheet(id). La chiave sta nelle SUE Proprietà: le vede
 * solo il titolare. Guida passo passo: docs/google-sheets-setup.md.
 *
 * Proprietà dello script (Impostazioni progetto → Proprietà dello script).
 * MAI nel foglio, MAI in questo testo:
 *   FOGLIO_ID   = l'id del foglio (la parte dell'indirizzo fra /d/ e /edit)
 *   CRM_URL     = https://<indirizzo del CRM>/api/public/sheets-ingresso
 *   CRM_TOKEN   = <la chiave segreta SHEETS_INGRESSO_TOKEN>
 *   SCHEDA      = nome della scheda con i lead (facoltativo: senza, la prima)
 *   OGNI_MINUTI = 5 per il giro di sicurezza ogni 5 minuti; assente o altro valore: 1 (vedi la guida)
 *
 * ⚠️ LA SCHEDA DI META NON SI TOCCA (27/10/2026). Una colonna in più nella riga dei
 * titoli confonde l'integrazione di Meta: ha scritto il lead nuovo SOPRA i titoli e
 * spostato «id» in fondo. Per questo i segni degli invii stanno in una scheda a
 * parte, «Invii al CRM» (chiave · ultimo invio · esito), e la riga dei titoli si
 * cerca (la prima delle prime 20 che contiene «created_time»), non si dà per
 * scontato che sia la riga 1.
 *
 * Da lanciare a mano, in quest'ordine:
 *   1. segnaGiaPresenti  (solo se nel foglio ci sono già righe che NON vuoi mandare)
 *   2. installa
 * Per spegnere tutto: disinstalla.
 */
var SCHEDA_SEGNI = 'Invii al CRM';
var COLONNA_VECCHIA = 'Inviato al CRM';   // la colonna di prima: se c'è ancora, non viaggia
var TITOLO_GUIDA = 'created_time';        // la riga dei titoli è quella che lo contiene
var MAX_RIGHE_TITOLI = 20;
var MAX_RIGHE_PER_GIRO = 20;
var MAX_MS = 4 * 60 * 1000;          // Apps Script si ferma a 6 minuti
var MAX_CELLA = 1000;                // il CRM rifiuta celle più lunghe
var MAX_CORPO = 8000;                // il CRM rifiuta oltre 8192 byte
var MAX_TENTATIVI = 5;               // poi la riga si segna «errore: da guardare»
var MAX_RIGHE_SENZA_SEGNO = 20;      // oltre, installa() chiede prima segnaGiaPresenti()

function prop_() { return PropertiesService.getScriptProperties(); }

function controllaProprieta_() {
  var p = prop_();
  var url = p.getProperty('CRM_URL') || '';
  var chiave = p.getProperty('CRM_TOKEN') || '';
  var id = p.getProperty('FOGLIO_ID') || '';
  if (!/^https:\/\//.test(url)) throw new Error('CRM_URL deve cominciare con https://');
  if (!chiave) throw new Error('Manca CRM_TOKEN nelle proprietà dello script');
  if (!id) throw new Error('Manca FOGLIO_ID nelle proprietà dello script');
  return { url: url, chiave: chiave, id: id };
}

/** Mette i trigger e fa il primo giro. Si può rilanciare: non raddoppia niente. */
function installa() {
  var c = controllaProprieta_();
  var sh = scheda_(c.id), letto = leggi_(sh), segni = segni_(sh.getParent());
  if (!letto) throw new Error('Nella scheda non trovo la riga dei titoli (quella con «' + TITOLO_GUIDA + '»).');
  travasaVecchi_(letto, segni);
  if (!prop_().getProperty('GIA_PRESENTI_FATTO') && senzaSegno_(letto, segni).length > MAX_RIGHE_SENZA_SEGNO) {
    throw new Error('Ci sono più di ' + MAX_RIGHE_SENZA_SEGNO + ' righe senza segno: lancia prima segnaGiaPresenti ' +
      '(oppure, se vuoi davvero mandarle tutte, imposta la proprietà GIA_PRESENTI_FATTO = si).');
  }
  togliTrigger_();
  ScriptApp.newTrigger('quandoCambia').forSpreadsheet(c.id).onChange().create();
  ScriptApp.newTrigger('quandoCambia').forSpreadsheet(c.id).onFormSubmit().create();
  var ogni = Number(prop_().getProperty('OGNI_MINUTI')) === 5 ? 5 : 1;
  ScriptApp.newTrigger('giroDiSicurezza').timeBased().everyMinutes(ogni).create();
  giroDiSicurezza();
}

/** Spegne l'invio: toglie i trigger di questo script. Il foglio non si tocca. */
function disinstalla() { togliTrigger_(); }

function togliTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    var f = t.getHandlerFunction();
    if (f === 'quandoCambia' || f === 'giroDiSicurezza') ScriptApp.deleteTrigger(t);
  });
}

function quandoCambia(e) { invia_(); }
function giroDiSicurezza() { invia_(); }

/** Segna come già presenti le righe che ci sono adesso, senza inviarle. */
function segnaGiaPresenti() {
  var c = controllaProprieta_();
  var sh = scheda_(c.id), letto = leggi_(sh), segni = segni_(sh.getParent());
  if (letto) travasaVecchi_(letto, segni);
  if (letto) senzaSegno_(letto, segni).forEach(function (r) {
    scriviSegno_(segni, impronta_(r.valori), 'già presente prima del collegamento');
  });
  prop_().setProperty('GIA_PRESENTI_FATTO', 'si');
}

function scheda_(id) {
  var ss = SpreadsheetApp.openById(id);
  var nome = prop_().getProperty('SCHEDA');
  return (nome && ss.getSheetByName(nome)) || ss.getSheets()[0];
}

/** La scheda dei segni, a parte da quella di Meta. Se non c'è la crea in fondo. */
function segni_(ss) {
  var sh = ss.getSheetByName(SCHEDA_SEGNI);
  if (!sh) {
    sh = ss.insertSheet(SCHEDA_SEGNI, ss.getSheets().length);
    sh.getRange(1, 1, 1, 3).setValues([['Chiave', 'Ultimo invio', 'Esito']]);
  }
  var mappa = {}, ultima = sh.getLastRow();
  if (ultima >= 2) {
    sh.getRange(2, 1, ultima - 1, 1).getDisplayValues().forEach(function (r, i) {
      var k = String(r[0]).trim();
      if (k) mappa[k] = i + 2;
    });
  }
  return { sh: sh, mappa: mappa };
}

function scriviSegno_(segni, chiave, testo) {
  var riga = segni.mappa[chiave];
  if (riga) segni.sh.getRange(riga, 2, 1, 2).setValues([[ora_(), testo]]);
  else {
    segni.sh.appendRow([chiave, ora_(), testo]);
    segni.mappa[chiave] = segni.sh.getLastRow();
  }
  prop_().deleteProperty('t|' + chiave);
}

/** Tutta la scheda in una lettura: la riga dei titoli (cercata) e le righe dei lead,
 *  sopra o sotto i titoli. Una seconda riga di titoli non è un lead. */
function leggi_(sh) {
  var ultima = sh.getLastRow(), larg = sh.getLastColumn();
  if (ultima < 1 || larg < 1) return null;
  var grezzi = sh.getRange(1, 1, ultima, larg).getValues();
  var mostrati = sh.getRange(1, 1, ultima, larg).getDisplayValues();
  var titoli = -1;
  for (var t = 0; t < Math.min(ultima, MAX_RIGHE_TITOLI); t++) {
    if (eRigaTitoli_(mostrati[t])) { titoli = t; break; }
  }
  if (titoli < 0) return null;
  var intest = mostrati[titoli], usate = [], intestazioni = [], vecchia = -1;
  for (var j = 0; j < larg; j++) {
    var nome = String(intest[j]).trim();
    if (nome === COLONNA_VECCHIA) { vecchia = j; continue; }   // la colonna dei segni di prima non viaggia
    usate.push(j);
    intestazioni.push(nome.slice(0, MAX_CELLA));
  }
  //  Il titolo «id» spostato da Meta (27/10: A vuota, «id» in fondo su una colonna vuota):
  //  la colonna senza titolo che contiene codici l:… è «id», e un «id» senza valori non viaggia.
  var colId = -1, idVuoti = [];
  usate.forEach(function (j, k) {
    var codici = 0, piene = 0;
    for (var i = 0; i < ultima; i++) {
      if (i === titoli || eRigaTitoli_(mostrati[i])) continue;
      var v = String(mostrati[i][j]).trim();
      if (!v) continue;
      piene++;
      if (/^l:\d{6,}$/.test(v)) codici++;
    }
    if (!intestazioni[k] && codici > 0 && codici * 2 >= piene) colId = k;
    if (intestazioni[k].toLowerCase() === 'id' && piene === 0) idVuoti.push(k);
  });
  if (colId >= 0) {
    intestazioni[colId] = 'id';
    usate = usate.filter(function (_, k) { return idVuoti.indexOf(k) < 0; });
    intestazioni = intestazioni.filter(function (_, k) { return idVuoti.indexOf(k) < 0; });
  }
  var righe = [];
  for (var i = 0; i < ultima; i++) {
    if (i === titoli || eRigaTitoli_(mostrati[i])) continue;
    var valori = [], piena = false;
    usate.forEach(function (j) {
      var v = cella_(grezzi[i][j], mostrati[i][j]);
      if (v.trim()) piena = true;
      valori.push(v);
    });
    //  il segno della colonna di prima, se c'è: vale come «già inviato» (vedi travasaVecchi_)
    if (piena) righe.push({ riga: i + 1, valori: valori, vecchio: vecchia >= 0 ? String(mostrati[i][vecchia]).trim() : '' });
  }
  return { intestazioni: intestazioni, righe: righe };
}

function eRigaTitoli_(riga) {
  for (var j = 0; j < riga.length; j++) if (String(riga[j]).trim().toLowerCase() === TITOLO_GUIDA) return true;
  return false;
}

/** I segni della colonna «Inviato al CRM» di prima passano nella scheda dei segni, senza
 *  inviare niente: chi aveva già lo script non rimanda tutto lo storico. */
function travasaVecchi_(letto, segni) {
  letto.righe.forEach(function (r) {
    var k = impronta_(r.valori);
    if (r.vecchio && !segni.mappa[k]) scriviSegno_(segni, k, r.vecchio.replace(/^[\d\/: ]+· /, ''));
  });
}

function senzaSegno_(letto, segni) {
  return letto.righe.filter(function (r) { return !segni.mappa[impronta_(r.valori)]; });
}

/** Una cella com'è davvero: la data in ISO (UTC), un numero intero con tutte le cifre. */
function cella_(grezzo, mostrato) {
  if (grezzo instanceof Date) return Utilities.formatDate(grezzo, 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  // un telefono salvato come numero: tutte le cifre, mai «3,93E+11»
  if (typeof grezzo === 'number' && Math.floor(grezzo) === grezzo && Math.abs(grezzo) < 1e21) return String(grezzo);
  return String(mostrato == null ? '' : mostrato).slice(0, MAX_CELLA);
}

/** Chi è questa riga: l'id Meta (l:…) se c'è, altrimenti tutte le celle unite. È la
 *  chiave della scheda dei segni: non dipende da dove sta la riga. */
function impronta_(valori) {
  for (var i = 0; i < valori.length; i++) if (/^l:\d{6,}$/.test(valori[i])) return valori[i];
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, valori.join('\u241f'));
  return 'h:' + Utilities.base64EncodeWebSafe(d).slice(0, 22);
}

function invia_() {
  var lucchetto = LockService.getScriptLock();
  if (!lucchetto.tryLock(1000)) return;              // c'è già un invio in corso: il giro dopo arriva entro un minuto
  try {
    var c;
    try { c = controllaProprieta_(); } catch (x) { console.error(x.message); return; }
    var sh = scheda_(c.id), letto = leggi_(sh);
    if (!letto) { console.warn('Non trovo la riga dei titoli (' + TITOLO_GUIDA + '): non mando niente'); return; }
    var segni = segni_(sh.getParent());
    travasaVecchi_(letto, segni);
    var daMandare = senzaSegno_(letto, segni);
    var inizio = Date.now(), fatte = 0;
    for (var i = 0; i < daMandare.length && fatte < MAX_RIGHE_PER_GIRO; i++) {
      if (Date.now() - inizio > MAX_MS) break;
      var r = daMandare[i], impronta = impronta_(r.valori);
      var corpo = JSON.stringify({
        versione: 1,
        foglio: { id: c.id, nome: sh.getParent().getName().slice(0, 100), scheda: sh.getName().slice(0, 100) },
        //  il CRM vuole riga ≥ 2 (la 1 sono i titoli): un lead scritto da Meta SOPRA i
        //  titoli è in riga 1, e con 1 il CRM lo rifiuterebbe (400) e andrebbe perso
        riga: Math.max(2, r.riga), intestazioni: letto.intestazioni, valori: r.valori
      });
      if (Utilities.newBlob(corpo).getBytes().length > MAX_CORPO) {
        scriviSegno_(segni, impronta, 'non inviata: riga troppo lunga');
        continue;
      }
      var risposta;
      try {
        risposta = UrlFetchApp.fetch(c.url, {
          method: 'post', contentType: 'application/json', payload: corpo,
          headers: { 'X-HGL-Token': c.chiave }, muteHttpExceptions: true, followRedirects: false
        });
      } catch (err) { console.warn('Rete: riprovo al prossimo giro'); break; }   // la rete ferma il giro
      fatte++;
      var codice = risposta.getResponseCode();
      if (codice === 200) {
        var esito = {};
        try { esito = JSON.parse(risposta.getContentText()); } catch (x) {}
        scriviSegno_(segni, impronta, frase_(esito));
      } else if (codice === 400 || codice === 413) {
        scriviSegno_(segni, impronta, 'non inviata: ' + (codice === 413 ? 'riga troppo lunga' : 'riga non leggibile'));
      } else if (codice === 401) {
        console.error('Chiave rifiutata dal CRM: controlla CRM_TOKEN');            // non insiste
        break;
      } else if (codice !== 500) {
        // 503 (non pronto, tetto del giorno) ma anche 404 (indirizzo sbagliato, CRM non ancora
        // pubblicato), 3xx, 429, 502/504/52x (Cloudflare): non c'entra la riga, si ferma il giro
        console.warn('CRM non raggiungibile o non pronto (codice ' + codice + '): riprovo al prossimo giro');
        break;
      } else {
        // 500: è l'unico codice che il CRM usa per un errore di QUESTA riga. Si conta su di lei
        // e si va avanti con le altre
        var k = 't|' + impronta, n = Number(prop_().getProperty(k) || 0) + 1;
        if (n >= MAX_TENTATIVI) scriviSegno_(segni, impronta, 'errore: da guardare (' + codice + ')');
        else prop_().setProperty(k, String(n));
      }
    }
  } finally { lucchetto.releaseLock(); }
}

function frase_(e) {
  switch (e && e.esito) {
    case 'nuovo': return 'nuova scheda';
    case 'ritorno': return 'contatto di ritorno';
    case 'gia_ricevuto': return 'già ricevuto';
    case 'gia_presente': return 'già nel CRM';
    case 'scartata': return 'scartata: ' + (e.motivo || 'senza nome né telefono');
    default: return 'inviata';
  }
}

function ora_() { return Utilities.formatDate(new Date(), 'Europe/Rome', 'dd/MM/yyyy HH:mm'); }
