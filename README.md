# scoreTT – Tableau de score de tennis de table (iPad 2)

- `index.html` : tableau de score (compatible Safari 9 / iOS 9.3.5).
- `resultats.html` : consultation des matchs enregistrés.
- `config.js` : adresse du serveur de résultats.
- `google-apps-script/Code.gs` : serveur de résultats (Google Sheets).

Site : https://ttfrisno-design.github.io/scoreTT/

## Appareils

- **iPad 2 (iOS 9)** et tablettes : joueurs côte à côte. Safari > Partager > « Sur l'écran d'accueil ».
- **Téléphone Android / iPhone** : en hauteur, les joueurs sont l'un au-dessus de l'autre ; en largeur, côte à côte.
  Chrome > ⋮ > « Ajouter à l'écran d'accueil » (ou « Installer l'application »).
  L'écran reste allumé pendant un match et le site fonctionne sans réseau une fois ouvert.
- **PC** : souris, ou clavier : ← / → point au joueur de gauche / droite, Maj + flèche pour retirer un point,
  Retour arrière ou Ctrl+Z pour annuler, Entrée pour continuer, Échap pour fermer une fenêtre.

## Rencontre par équipes (4 contre 4)

Onglet « Rencontre par équipes » : saisir la journée, les deux clubs et les joueurs A B C D / W X Y Z.
Les 14 parties s'affichent dans l'ordre : AW BX CY DZ AX BW DY CZ, Double 1, Double 2, AY CW DX BZ.
Toucher une partie pour l'arbitrer (pour un double, on choisit les 2 joueurs de chaque club).
Dans `resultats.html`, on choisit la journée, puis la rencontre, puis on consulte les parties
et le bilan de chaque joueur.

Après une mise à jour de `Code.gs` : Apps Script > Déployer > Gérer les déploiements > ✎ Modifier >
Version : **Nouvelle version** > Déployer (l'adresse `/exec` ne change pas).

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
