# Le CV

`cv-source.html` est la source du CV. Le PDF à la racine du dossier
(`CV-Jaurys-Maigret.pdf`) en est le rendu, en A4, sur une page.

Version claire. Même grammaire que le site — Anton pour les titres,
IBM Plex Mono pour les relevés, le rouge comme seul accent, la grille de
mesure en fond — mais sur papier clair, lisible et imprimable sans vider
une cartouche.

## Modifier le CV

Ouvre `cv-source.html` dans un éditeur de texte. Tout le contenu est
en clair dans le HTML, il n'y a rien à deviner.

Attention : **le CV tient sur une page, et une seule.** Si tu ajoutes une
expérience, il faut en retirer ailleurs, ou réduire un peu les tailles.

## Regénérer le PDF

Le plus simple : ouvre `cv-source.html` dans Chrome, puis Imprimer →
Destination « Enregistrer au format PDF », format A4, marges « Aucune »,
et coche **Graphismes d'arrière-plan** (sinon tout sort en blanc).

## Le QR code

Il est intégré en vectoriel, 22 mm de côté, soit 0,54 mm par module —
au-dessus du seuil de 0,4 mm en dessous duquel un téléphone peine à lire.
Il pointe vers https://jaurysmgrt.github.io/Portfolio

Vérifié : il se décode depuis le PDF à 300 et 600 dpi.

## La photo

L'emplacement est prêt en haut de la colonne de gauche. Tant qu'il n'y a
pas de fichier, il affiche le monogramme JM.

Pour l'intégrer : dépose ton portrait dans `images/profil.jpg` (format
portrait, cadrage serré sur le visage, au moins 800 px de large), puis
regénère le PDF. Le build l'encode automatiquement dans le fichier.

## À vérifier avant d'envoyer

Ce CV a été composé à partir des informations déjà présentes sur le site.
Rien n'a été inventé, mais rien n'a été vérifié non plus. Relis :

- les dates des trois expériences
- les intitulés de poste
- les années de formation
- le numéro de téléphone et l'adresse e-mail
