# Portfolio — Jaurys Maigret

Portfolio de direction artistique. Site statique, sans dépendance, sans build.

**En ligne :** https://jaurysmgrt.github.io/Portfolio/

---

## Ce qu'il y a dans le dossier

```
index.html               tout le site : structure, styles, comportements
images/                  toutes les photos, affiches et logos
favicon.svg              l'icône dans l'onglet du navigateur
og-image.jpg             l'aperçu quand on partage le lien (WhatsApp, LinkedIn…)
Portfolio-Jaurys-Maigret.pdf   le PDF à imprimer avec le QR code
QR-Portfolio-Jaurys.svg        le QR code seul, en vectoriel
AJOUTER-UN-PROJET.md     comment ajouter une photo, une affiche ou une vidéo
```

Il n'y a **pas** de `npm install`, pas de framework, pas d'étape de compilation.
Ouvre `index.html` dans un navigateur et tu vois le site.

---

## La direction artistique : la Soufflerie

Tout le site est tenu par une seule image : **un hall d'essai automobile**.
Pas de papier, pas de scotch, pas de carte postale. Des plaques usinées,
une lumière rasante, des relevés d'instrument.

Les quatre règles :

1. **Le noir est le fond, pas une couleur.** Les surfaces sont des plaques
   métal avec une arête claire en haut qui capte la lumière.
2. **Le rouge est le seul accent.** Un seul. Dès qu'une deuxième couleur
   apparaît, la Soufflerie se dilue.
3. **Les chiffres et les étiquettes sont en IBM Plex Mono.** C'est ce qui
   fait « instrument » plutôt que « site web ».
4. **On ne recadre jamais une pièce.** Une affiche se voit en entier. Si
   elle ne tient pas, c'est la boîte qui s'adapte, pas l'image.

Les couleurs sont toutes définies au même endroit, au début de `index.html`,
dans le bloc `:root`. Changer `--red` change le rouge partout.

| Variable | À quoi ça sert |
|---|---|
| `--bg`, `--bg2` | les deux noirs de fond |
| `--paper`, `--paper2`, `--paper3` | les plaques métal |
| `--ink`, `--cream` | les textes clairs |
| `--chrome`, `--chrome-hi` | les étiquettes et relevés |
| `--red`, `--red2` | l'accent, et sa version survol |
| `--border`, `--edge` | les filets et l'arête de lumière |

---

## Mettre le site à jour

Le site est publié par GitHub Pages depuis la branche **`gh-pages`**.
`main` est tenue à l'identique.

```bash
git add -A
git commit -m "ce que j'ai changé"
git push origin gh-pages
git branch -f main gh-pages && git push origin main
```

Compter **une à deux minutes** avant que le changement soit visible, puis
forcer le rafraîchissement du navigateur (`Cmd+Maj+R` ou `Ctrl+F5`).

> Le lien ne change jamais. Tu peux imprimer le QR code sans crainte :
> chaque mise à jour se fait à la même adresse.

---

## Ajouter un projet

Tout est dans **[AJOUTER-UN-PROJET.md](AJOUTER-UN-PROJET.md)**, avec des blocs
à copier-coller pour chacun des trois cas : une photo, une campagne, une vidéo.

---

## Ce qu'il ne faut pas faire

- **Ne pas recoller d'images en base64 dans `index.html`.** Elles pesaient
  2,75 Mo et bloquaient l'affichage. Elles vivent maintenant dans `images/`.
- **Ne pas héberger une image sur un site tiers** (ibb.co, imgur…). Le jour
  où le site tombe, le visuel disparaît du portfolio. Tout va dans `images/`.
- **Ne pas oublier `width` et `height`** sur une nouvelle image : sans eux,
  la mosaïque saute pendant le chargement.
- **Ne pas ajouter une deuxième couleur d'accent.**

---

## Les points encore ouverts

- La photo de profil et le visuel « Uber, Monaco F1 » sont encore chargés
  depuis `i.ibb.co`. À rapatrier dans `images/`.
- Les pages projet s'arrêtent au brief. Pour convaincre un DA senior il y
  manque la démarche : pistes écartées, parti pris, ce qui serait refait
  autrement.
