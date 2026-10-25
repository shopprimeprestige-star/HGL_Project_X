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
 *   OGNI_MINUTI = 1 oppure 5 (il giro di sicurezza; 1 se non sei sicuro: vedi la guida)
 *
 * Da lanciare a mano, in quest'ordine:
 *   1. segnaGiaPresenti  (solo se nel foglio ci sono già righe che NON vuoi mandare)
 *   2. installa
 * Per spegnere tutto: disinstalla.
 */
var COLONNA_INVIO = 'Inviato al CRM';
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
  var sh = scheda_(c.id), col = colonnaInvio_(sh);
  if (!prop_().getProperty('GIA_PRESENTI_FATTO') && contaSenzaSegno_(sh, col) > MAX_RIGHE_SENZA_SEGNO) {
    throw new Error('Ci sono più di ' + MAX_RIGHE_SENZA_SEGNO + ' righe senza segno: lancia prima segnaGiaPresenti ' +
      '(oppure, se vuoi davvero mandarle tutte, imposta la proprietà GIA_PRESENTI_FATTO = si).');
  }
  togliTrigger_();
  ScriptApp.newTrigger('quandoCambia').forSpreadsheet(c.id).onChange().create();
  ScriptApp.newTrigger('quandoCambia').forSpreadsheet(c.id).onFormSubmit().create();
  var ogni = Number(prop_().getProperty('OGNI_MINUTI')) === 1 ? 1 : 5;
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
  var sh = scheda_(c.id), col = colonnaInvio_(sh), ultima = sh.getLastRow();
  if (ultima >= 2) {
    var r = sh.getRange(2, col, ultima - 1, 1), v = r.getValues();
    for (var i = 0; i < v.length; i++) if (!v[i][0]) v[i][0] = 'già presente prima del collegamento';
    r.setValues(v);
  }
  prop_().setProperty('GIA_PRESENTI_FATTO', 'si');
}

function scheda_(id) {
  var ss = SpreadsheetApp.openById(id);
  var nome = prop_().getProperty('SCHEDA');
  return (nome && ss.getSheetByName(nome)) || ss.getSheets()[0];
}

/** La colonna del segno: se non c'è, la aggiunge in fondo all'intestazione. */
function colonnaInvio_(sh) {
  var larg = Math.max(sh.getLastColumn(), 1);
  var intest = sh.getRange(1, 1, 1, larg).getDisplayValues()[0];
  for (var i = 0; i < intest.length; i++) if (String(intest[i]).trim() === COLONNA_INVIO) return i + 1;
  sh.getRange(1, larg + 1).setValue(COLONNA_INVIO);
  return larg + 1;
}

function contaSenzaSegno_(sh, col) {
  var ultima = sh.getLastRow();
  if (ultima < 2) return 0;
  return sh.getRange(2, col, ultima - 1, 1).getDisplayValues().filter(function (r) { return !String(r[0]).trim(); }).length;
}

/** Una cella com'è davvero: la data in ISO (UTC), un numero intero con tutte le cifre. */
function cella_(grezzo, mostrato) {
  if (grezzo instanceof Date) return Utilities.formatDate(grezzo, 'Etc/UTC', "yyyy-MM-dd'T'HH:mm:ss'Z'");
  // un telefono salvato come numero: tutte le cifre, mai «3,93E+11»
  if (typeof grezzo === 'number' && Math.floor(grezzo) === grezzo && Math.abs(grezzo) < 1e21) return String(grezzo);
  return String(mostrato == null ? '' : mostrato).slice(0, MAX_CELLA);
}

/** Chi è questa riga: l'id Meta (l:…) se c'è, altrimenti tutte le celle unite. Serve a non
 *  scrivere il segno su un'altra riga se qualcuno ha ordinato il foglio nel frattempo,
 *  e a contare i tentativi. */
function impronta_(valori) {
  for (var i = 0; i < valori.length; i++) if (/^l:\d{6,}$/.test(valori[i])) return valori[i];
  var d = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, valori.join('\u241f'));
  return 'h:' + Utilities.base64EncodeWebSafe(d).slice(0, 22);
}

function rigaDi_(sh, larg, col, riga, intest) {
  var grezzi = sh.getRange(riga, 1, 1, larg).getValues()[0];
  var mostrati = sh.getRange(riga, 1, 1, larg).getDisplayValues()[0];
  var intestazioni = [], valori = [], piena = false;
  for (var j = 0; j < larg; j++) {
    if (j === col - 1) continue;                       // la colonna del segno non viaggia
    intestazioni.push(String(intest[j]).slice(0, MAX_CELLA));
    var v = cella_(grezzi[j], mostrati[j]);
    if (v.trim()) piena = true;
    valori.push(v);
  }
  return { intestazioni: intestazioni, valori: valori, piena: piena, segno: String(mostrati[col - 1]).trim() };
}

function segna_(sh, larg, col, riga, intest, impronta, testo) {
  // Prima di scrivere, la riga è ancora la stessa? Se no, niente segno: al prossimo giro
  // la riga giusta si rimanda e il CRM risponde «già ricevuto», senza doppioni.
  var adesso = rigaDi_(sh, larg, col, riga, intest);
  if (impronta_(adesso.valori) !== impronta) return false;
  sh.getRange(riga, col).setValue(ora_() + ' · ' + testo);
  prop_().deleteProperty('t|' + impronta);
  return true;
}

function invia_() {
  var lucchetto = LockService.getScriptLock();
  if (!lucchetto.tryLock(20000)) return;             // c'è già un invio in corso
  try {
    var c;
    try { c = controllaProprieta_(); } catch (x) { console.error(x.message); return; }
    var sh = scheda_(c.id), col = colonnaInvio_(sh);
    var ultima = sh.getLastRow(), larg = sh.getLastColumn();
    if (ultima < 2) return;
    // Si legge prima SOLO la colonna del segno: costa poco anche ogni minuto.
    var segni = sh.getRange(2, col, ultima - 1, 1).getDisplayValues();
    var intest = sh.getRange(1, 1, 1, larg).getDisplayValues()[0];
    var inizio = Date.now(), fatte = 0;
    for (var i = 0; i < segni.length && fatte < MAX_RIGHE_PER_GIRO; i++) {
      if (Date.now() - inizio > MAX_MS) break;
      if (String(segni[i][0]).trim()) continue;
      var riga = i + 2;
      var r = rigaDi_(sh, larg, col, riga, intest);
      if (!r.piena || r.segno) continue;
      var impronta = impronta_(r.valori);
      var corpo = JSON.stringify({
        versione: 1,
        foglio: { id: c.id, nome: sh.getParent().getName().slice(0, 100), scheda: sh.getName().slice(0, 100) },
        riga: riga, intestazioni: r.intestazioni, valori: r.valori
      });
      if (Utilities.newBlob(corpo).getBytes().length > MAX_CORPO) {
        segna_(sh, larg, col, riga, intest, impronta, 'non inviata: riga troppo lunga');
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
        segna_(sh, larg, col, riga, intest, impronta, frase_(esito));
      } else if (codice === 400 || codice === 413) {
        segna_(sh, larg, col, riga, intest, impronta, 'non inviata: ' + (codice === 413 ? 'riga troppo lunga' : 'riga non leggibile'));
      } else if (codice === 401) {
        console.error('Chiave rifiutata dal CRM: controlla CRM_TOKEN');            // non insiste
        break;
      } else if (codice === 503) {
        console.warn('CRM non pronto o tetto del giorno raggiunto: riprovo al prossimo giro');
        break;
      } else {
        // un altro errore (500…): si conta per QUESTA riga e si va avanti con le altre
        var k = 't|' + impronta, n = Number(prop_().getProperty(k) || 0) + 1;
        if (n >= MAX_TENTATIVI) segna_(sh, larg, col, riga, intest, impronta, 'errore: da guardare (' + codice + ')');
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
