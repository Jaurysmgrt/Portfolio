# Ajouter un projet

Trois cas, trois recettes. Tout se passe dans `index.html`, dans le bloc
qui commence par `<div class="gallery" id="gallery">`.

**Avant tout :** mets ton image dans `images/`, avec un nom en minuscules,
sans accent ni espace. Par exemple `images/nike-affiche.jpg`.

Tu auras besoin de ses **dimensions en pixels** (clic droit → Lire les
informations sur Mac, Propriétés sur Windows). C'est ce qui empêche la
mosaïque de sauter pendant le chargement.

---

## 1. Une photo

À coller à la suite des autres photos, juste avant les vidéos.

```html
<div class="gal-item" data-c="auto photo"
     data-title="Porsche 992, Phare"
     data-cat="Photo · Détail · Talon Pointe"
     data-desc="Phare avant de la 992, lumière de fin de journée.">
  <img src="images/porsche-992-phare.jpg" alt="Porsche 992, phare"
       width="1200" height="800" loading="lazy" decoding="async">
  <div class="gal-ov"><div class="gal-paper">
    <div class="gal-title">Porsche 992, Phare</div>
    <span class="gal-cat">Photo · Détail · Talon Pointe</span>
  </div></div>
</div>
```

| À changer | Quoi mettre |
|---|---|
| `data-c` | les filtres où la pièce apparaît. `photo` pour « Mes photos », `affiche` pour « Affiches », `video` pour « Vidéos ». On peut en mettre plusieurs : `data-c="auto photo"` |
| `data-title` | le titre, répété dans `.gal-title` |
| `data-cat` | la catégorie, répétée dans `.gal-cat` |
| `data-desc` | la phrase affichée quand on agrandit la photo |
| `width` / `height` | les vraies dimensions du fichier |

Le numéro en bas de la vignette se calcule tout seul. Rien à renuméroter.

**Une photo de nuit ?** Ajoute `gal-astro` : `class="gal-item gal-astro"` et
`data-c="photo nuit"`.

---

## 2. Une campagne (plusieurs visuels, une page dédiée)

Une campagne, c'est **deux choses** : une vignette dans la galerie, et une
fiche dans `CAMPAIGNS`.

### a. La fiche

Cherche `var CAMPAIGNS = {` dans `index.html` et ajoute une entrée :

```js
nike: {
  name: "Nike, Air Max Day",
  cat:  "Campagne · Sport",
  logo: "images/logo-nike.svg",
  meta: { "Type": "Campagne", "Secteur": "Sport", "Année": "2026" },
  brief: "Le contexte du projet, ce qu'on te demandait, et surtout ce que "
       + "TU as décidé. C'est ce paragraphe qu'un DA lit en premier.",
  posterSlots: 0,
  videoSlots: 0
},
```

La clé (`nike`) est le nom interne. Minuscules, sans accent, sans espace.

### b. La vignette

```html
<div class="gal-item brand-thumb has-card" data-c="affiche"
     data-group="nike" data-brand="Nike"
     data-title="Nike, Air Max Day"
     data-cat="Campagne · Sport"
     data-desc="Campagne Air Max Day, direction artistique complète.">
  <img src="images/nike-1.jpg" alt="Nike" width="800" height="1200"
       loading="lazy" decoding="async">
  <div class="gal-ov"><div class="gal-paper">
    <div class="gal-title">Nike, Air Max Day</div>
    <span class="gal-cat">Campagne · Sport</span>
  </div></div>
</div>
```

`data-group="nike"` doit correspondre **exactement** à la clé de la fiche.
C'est ce qui relie la vignette à la page projet.

### c. Les autres visuels de la campagne

Même bloc, mais `class="gal-item brand-secondary"` au lieu de
`brand-thumb has-card`, et **sans** le `gal-ov`. Ils n'apparaissent pas dans
la galerie : ils se retrouvent sur la page projet.

```html
<div class="gal-item brand-secondary" data-c="affiche"
     data-group="nike" data-brand="Nike"
     data-title="Nike, Air Max Day — déclinaison 2"
     data-cat="Campagne · Sport"
     data-desc="Deuxième déclinaison.">
  <img src="images/nike-2.jpg" alt="Nike" width="800" height="1200"
       loading="lazy" decoding="async">
</div>
```

La page projet affiche automatiquement tous les visuels qui partagent le
même `data-group`, dans l'ordre où ils sont écrits.

Le lien « Projet suivant » en bas de page se met à jour tout seul : il suit
l'ordre des vignettes dans la galerie.

---

## 3. Une vidéo YouTube

Prends l'identifiant de la vidéo : dans `https://youtu.be/zON4zQJtES4`,
c'est `zON4zQJtES4`. Il apparaît **trois fois** dans le bloc.

```html
<div class="gal-item gal-video gv-h" data-c="video"
     data-vsrc="https://youtu.be/TON_ID"
     data-title="Titre de la vidéo"
     data-cat="Montage · Automobile"
     data-desc="Une phrase sur ce que tu as fait dessus.">
  <div class="gv-frame">
    <img class="gv-poster"
         src="https://img.youtube.com/vi/TON_ID/maxresdefault.jpg"
         onerror="this.onerror=null;this.src='https://img.youtube.com/vi/TON_ID/mqdefault.jpg'"
         alt="">
    <div class="gv-play"><span class="gv-ring"></span>
      <svg viewBox="0 0 24 24"><path d="M5 3l14 9-14 9V3z"/></svg></div>
  </div>
  <div class="gal-ov"><div class="gal-paper">
    <div class="gal-title">Titre de la vidéo</div>
    <span class="gal-cat">Montage · Automobile</span>
  </div></div>
  <span class="gal-num">▶</span>
</div>
```

La vidéo doit être **publique ou non répertoriée** sur YouTube, et la
lecture sur d'autres sites doit être autorisée (YouTube Studio → la vidéo →
Plus d'options). Sinon le lecteur affiche un message d'indisponibilité au
lieu de planter.

---

## Après avoir ajouté quelque chose

1. Ouvre `index.html` dans ton navigateur et vérifie :
   - la vignette apparaît au bon endroit
   - le filtre correspondant l'affiche
   - le clic ouvre bien la bonne chose
2. Publie :

```bash
git add -A
git commit -m "Ajout : Nike, Air Max Day"
git push origin gh-pages
git branch -f main gh-pages && git push origin main
```

3. Attends une à deux minutes, puis `Cmd+Maj+R` sur le site en ligne.

---

## Les erreurs qui reviennent

| Symptôme | Cause |
|---|---|
| La vignette n'apparaît pas | `data-c` ne contient aucun filtre existant (`photo`, `affiche`, `video`) |
| Le clic ne fait rien | `data-group` ne correspond à aucune clé de `CAMPAIGNS` |
| La mosaïque saute au chargement | `width` / `height` manquants ou faux |
| L'image est un cadre vide | mauvais chemin — vérifie `images/` et la casse du nom |
| Le site n'a pas changé en ligne | poussé sur `main` seulement : il faut `gh-pages` |
