# scoreTT – Tableau de score de tennis de table (iPad 2)

- `index.html` : tableau de score (compatible Safari 9 / iOS 9.3.5).
- `resultats.html` : consultation des matchs enregistrés.
- `config.js` : adresse du serveur de résultats.
- `google-apps-script/Code.gs` : serveur de résultats (Google Sheets).

Site : https://ttfrisno-design.github.io/scoreTT/

## Activer l'enregistrement des résultats

1. Créer une feuille Google Sheets vide (par ex. « Résultats ping-pong »).
2. Menu **Extensions > Apps Script**, remplacer le contenu par celui de `google-apps-script/Code.gs`.
3. Changer la ligne `var CLE = 'changez-moi';` par un code secret à vous. Enregistrer.
4. **Déployer > Nouveau déploiement** > type **Application Web** :
   - Exécuter en tant que : **Moi**
   - Qui a accès : **Tout le monde**
   - Autoriser l'accès demandé par Google.
5. Copier l'URL de l'application Web (se termine par `/exec`) dans `config.js` :
   `var SCORE_API = 'https://script.google.com/macros/s/.../exec';`
6. Sur l'iPad, dans l'écran d'accueil du tableau, saisir le code secret dans « Code d'enregistrement en ligne ».

À la fin d'un match, le résultat est envoyé automatiquement. Sans connexion, il reste en attente
sur l'iPad et part au prochain lancement. Tout le monde peut consulter `resultats.html` ;
seul celui qui connaît le code peut enregistrer.
