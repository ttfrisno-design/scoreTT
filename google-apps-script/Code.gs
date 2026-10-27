/**
 * Stockage des résultats de matchs dans une feuille Google Sheets + score en direct.
 * À coller dans Extensions > Apps Script de la feuille, puis déployer en
 * « Application Web » (Exécuter en tant que : moi, Accès : tout le monde).
 *
 * Appels (JSONP, compatibles iPad 2 / Safari 9) :
 *   ?action=add&id=...&...&callback=f      -> enregistre un match terminé (sans code)
 *   ?action=live&id=...&etat={...}         -> score en direct d'un match en cours (sans code)
 *   ?action=stop&id=...                    -> match abandonné : retiré du direct
 *   ?action=list&code=...&callback=f       -> résultats + matchs en direct (code de consultation)
 */

// Code demandé pour consulter les résultats et le direct (à changer !).
// Il n'est jamais publié sur GitHub : on le donne aux personnes autorisées.
var CODE_CONSULTATION = 'changez-moi';

var COLONNES = ['id', 'date', 'joueur1', 'joueur2', 'manches1', 'manches2',
                'vainqueur', 'detail', 'format', 'duree_min',
                // Rencontre par équipes (vide pour un match simple)
                'rencontre_id', 'journee', 'club1', 'club2', 'partie', 'ordre', 'arbitre'];

var DUREE_DIRECT_MS = 3 * 3600 * 1000;   // un direct sans nouvelle depuis 3 h est retiré
var DUREE_FINI_MS = 24 * 3600 * 1000;    // mémoire des matchs terminés (évite un direct fantôme)

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
    if (p.action === 'live') return reponse_(e, majDirect_(p));
    if (p.action === 'stop') return reponse_(e, arreterDirect_(p));
    if (p.action === 'rc_new') return reponse_(e, rcNouveau_());
    if (p.action === 'rc_join') return reponse_(e, rcRejoindre_(p));
    if (p.action === 'rc_state') return reponse_(e, rcEtat_(p));
    if (p.action === 'rc_cmd') return reponse_(e, rcCommande_(p));
    if (p.action === 'rc_wait') return reponse_(e, rcAttendre_(p));
    if (p.action === 'rc_end') return reponse_(e, rcFin_(p));
    if (String(p.code || '') !== CODE_CONSULTATION) {
      return reponse_(e, { ok: false, code: true, erreur: 'Code de consultation incorrect' });
    }
    return reponse_(e, { ok: true, matchs: lister_(), direct: direct_(), maintenant: Date.now() });
  } catch (err) {
    return reponse_(e, { ok: false, erreur: String(err) });
  }
}

function ajouter_(p) {
  if (!p.id) return { ok: false, erreur: 'id manquant' };

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty('done_' + p.id, String(Date.now()));
    props.deleteProperty('live_' + p.id);

    var sh = feuille_();
    // Pas de doublon si l'appareil renvoie un match déjà reçu
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

// ---------- Score en direct (stocké dans les propriétés du script) ----------
function majDirect_(p) {
  if (!p.id || !p.etat || p.etat.length > 8000) return { ok: false, erreur: 'état invalide' };
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('done_' + p.id)) return { ok: true, ignore: true }; // déjà enregistré
  var etat = JSON.parse(p.etat);
  etat.id = p.id;
  etat.maj = Date.now();
  props.setProperty('live_' + p.id, JSON.stringify(etat));
  return { ok: true };
}

function arreterDirect_(p) {
  if (p.id) PropertiesService.getScriptProperties().deleteProperty('live_' + p.id);
  return { ok: true };
}

// ---------- Télécommande : une tablette (affichage) et un téléphone appairés par un code ----------
// Le téléphone envoie des commandes, la tablette les applique et renvoie l'état du match.
// Chaque côté attend les nouveautés en « long polling » (réponse dès qu'il y a du neuf, sinon après 8 s).
var RC_DUREE_S = 6 * 3600;   // un appairage inutilisé disparaît au bout de 6 h
var RC_ATTENTE_MS = 8000;

function rcCache_() { return CacheService.getScriptCache(); }

function rcNouveau_() {
  var cache = rcCache_();
  for (var i = 0; i < 40; i++) {
    var code = String(Math.floor(1000 + Math.random() * 9000));
    if (!cache.get('rc_o_' + code)) {
      cache.put('rc_o_' + code, JSON.stringify({ t: Date.now(), tel: 0 }), RC_DUREE_S);
      return { ok: true, code: code };
    }
  }
  return { ok: false, erreur: 'Aucun code libre, réessayez' };
}

function rcInfo_(code) {
  var v = code && rcCache_().get('rc_o_' + code);
  return v ? JSON.parse(v) : null;
}

function rcRejoindre_(p) {
  var info = rcInfo_(p.code);
  if (!info) return { ok: false, perdu: true, erreur: 'Code inconnu ou expiré' };
  info.tel = Date.now();
  rcCache_().put('rc_o_' + p.code, JSON.stringify(info), RC_DUREE_S);
  return { ok: true };
}

function rcEtat_(p) {
  var info = rcInfo_(p.code);
  if (!info) return { ok: false, perdu: true };
  if (!p.etat || p.etat.length > 20000) return { ok: false, erreur: 'état invalide' };
  var cache = rcCache_();
  cache.put('rc_s_' + p.code, JSON.stringify({ v: Number(p.v) || 0, etat: p.etat }), RC_DUREE_S);
  cache.put('rc_o_' + p.code, JSON.stringify(info), RC_DUREE_S); // prolonge l'appairage
  return { ok: true };
}

function rcCommande_(p) {
  if (!rcInfo_(p.code)) return { ok: false, perdu: true };
  if (!/^[a-z]+(:[01])?$/.test(p.cmd || '')) return { ok: false, erreur: 'commande invalide' };
  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var cache = rcCache_(), k = 'rc_c_' + p.code;
    var data = JSON.parse(cache.get(k) || '{"n":0,"l":[]}');
    data.n++;
    data.l.push({ seq: data.n, cmd: p.cmd });
    if (data.l.length > 30) data.l = data.l.slice(-30);
    cache.put(k, JSON.stringify(data), RC_DUREE_S);
    return { ok: true, seq: data.n };
  } finally {
    lock.releaseLock();
  }
}

// type=c (tablette) : commandes de numéro > since ; since=-1 : renvoie juste le dernier numéro.
// type=s (téléphone) : état de version > since.
function rcAttendre_(p) {
  var cache = rcCache_(), since = Number(p.since) || 0, fin = Date.now() + RC_ATTENTE_MS;
  while (true) {
    var info = rcInfo_(p.code);
    if (!info) return { ok: false, perdu: true };
    if (p.type === 'c') {
      var data = JSON.parse(cache.get('rc_c_' + p.code) || '{"n":0,"l":[]}');
      if (since < 0) return { ok: true, cmds: [], last: data.n, tel: info.tel };
      var neuves = data.l.filter(function (c) { return c.seq > since; });
      if (neuves.length || Date.now() > fin) return { ok: true, cmds: neuves, last: data.n, tel: info.tel };
    } else {
      var s = cache.get('rc_s_' + p.code);
      if (s) { s = JSON.parse(s); if (s.v > since) return { ok: true, v: s.v, etat: s.etat }; }
      if (Date.now() > fin) return { ok: true, rien: true };
    }
    Utilities.sleep(250);
  }
}

function rcFin_(p) {
  var cache = rcCache_();
  if (p.code) cache.removeAll(['rc_o_' + p.code, 'rc_s_' + p.code, 'rc_c_' + p.code]);
  return { ok: true };
}

function direct_() {
  var props = PropertiesService.getScriptProperties();
  var tout = props.getProperties(), out = [], now = Date.now();
  for (var k in tout) {
    if (k.indexOf('live_') === 0) {
      var etat;
      try { etat = JSON.parse(tout[k]); } catch (err) { props.deleteProperty(k); continue; }
      if (now - etat.maj > DUREE_DIRECT_MS) props.deleteProperty(k);
      else out.push(etat);
    } else if (k.indexOf('done_') === 0 && now - Number(tout[k]) > DUREE_FINI_MS) {
      props.deleteProperty(k);
    }
  }
  return out;
}
