# Le CV

`cv-source.html` est la source du CV. Le PDF à la racine du dossier
(`CV-Jaurys-Maigret.pdf`) en est le rendu : A4, une page.

## La DA

Celle du portfolio : bandeau noir avec le nom en Anton et un filet rouge,
numéros de section en mono rouge, titres de section en Anton. Le corps est
sur fond blanc, pour rester lisible à l'écran comme à l'impression.

## Pourquoi il passe les ATS

Un ATS (logiciel de tri des candidatures) lit le texte du PDF dans l'ordre
où il le trouve. Ce CV est construit pour ça :

- **une seule colonne** : en deux colonnes, les ATS mélangent souvent les
  blocs (une date de gauche collée à une ligne de droite) ;
- **intitulés standards** : Profil, Expérience professionnelle, Formation,
  Projets, Compétences ;
- **tout est du vrai texte**, y compris le téléphone, l'e-mail et les liens,
  rien n'est dans une image ;
- **polices intégrées en TrueType**. L'ancien PDF en contenait en Type 3,
  un format que certains ATS lisent mal, parfois en charabia ;
- **tailles lisibles** : 9,3 pt minimum pour le texte courant (l'ancien
  descendait à 5,4 pt sur certains libellés).

Vérifié avec `pdftotext` : le texte ressort dans l'ordre exact de lecture.

## Modifier le CV

Tout le contenu est en clair dans `cv-source.html`. **Le CV tient sur une
page** : si tu ajoutes une ligne, il faut en retirer une ailleurs.

## Regénérer le PDF

Ouvre `cv-source.html` dans Chrome → Imprimer → « Enregistrer au format
PDF », format A4, marges « Aucune », et coche **Graphismes d'arrière-plan**
(sinon le bandeau noir sort en blanc). Le QR code est dans
`qr-portfolio.svg` : le remplacer dans la page à l'endroit `<!--QR-->`.

Les polices sont dans `cv/fonts/` : garde-les à côté du fichier.

## Le QR code

Il pointe vers https://jaurysmgrt.github.io/Portfolio et a été vérifié
lisible à 300 et 600 dpi.
