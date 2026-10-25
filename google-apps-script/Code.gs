/**
 * Stockage des résultats de matchs dans une feuille Google Sheets.
 * À coller dans Extensions > Apps Script de la feuille, puis déployer en
 * « Application Web » (Exécuter en tant que : moi, Accès : tout le monde).
 *
 * Appels (JSONP, compatibles iPad 2 / Safari 9) :
 *   ?action=list&callback=f                       -> liste des matchs
 *   ?action=add&cle=...&id=...&...&callback=f     -> ajoute un match
 */

// Code secret demandé pour enregistrer un match (à changer !).
// Il n'est jamais publié sur GitHub : on le saisit une seule fois sur l'iPad.
var CLE = 'changez-moi';

var COLONNES = ['id', 'date', 'joueur1', 'joueur2', 'manches1', 'manches2',
                'vainqueur', 'detail', 'format', 'duree_min',
                // Rencontre par équipes (vide pour un match simple)
                'rencontre_id', 'journee', 'club1', 'club2', 'partie', 'ordre'];

function feuille_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName('Matchs');
  if (!sh) {
    sh = ss.insertSheet('Matchs');
    sh.appendRow(COLONNES);
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < COLONNES.length) {
    // Feuille créée par une version précédente : on complète l'en-tête
    sh.getRange(1, 1, 1, COLONNES.length).setValues([COLONNES]);
  }
  return sh;
}

function reponse_(e, obj) {
  var json = JSON.stringify(obj);
  var cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[A-Za-z0-9_.$]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.action === 'add') return reponse_(e, ajouter_(p));
    return reponse_(e, { ok: true, matchs: lister_() });
  } catch (err) {
    return reponse_(e, { ok: false, erreur: String(err) });
  }
}

function ajouter_(p) {
  if (p.cle !== CLE) return { ok: false, erreur: 'Code d\'enregistrement incorrect' };
  if (!p.id) return { ok: false, erreur: 'id manquant' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sh = feuille_();
    // Pas de doublon si l'iPad renvoie un match déjà reçu
    var n = sh.getLastRow();
    if (n > 1) {
      var ids = sh.getRange(2, 1, n - 1, 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (String(ids[i][0]) === String(p.id)) return { ok: true, doublon: true };
      }
    }
    // L'apostrophe force le texte : sinon Sheets transforme « 3-1 » ou la date.
    var ligne = COLONNES.map(function (c) { return "'" + String(p[c] || '').slice(0, 200); });
    sh.appendRow(ligne);
    return { ok: true };
  } finally {
    lock.releaseLock();
  }
}

function lister_() {
  var sh = feuille_();
  var n = sh.getLastRow();
  if (n < 2) return [];
  var vals = sh.getRange(2, 1, n - 1, COLONNES.length).getDisplayValues();
  return vals.map(function (r) {
    var o = {};
    for (var i = 0; i < COLONNES.length; i++) o[COLONNES[i]] = r[i];
    return o;
  });
}
