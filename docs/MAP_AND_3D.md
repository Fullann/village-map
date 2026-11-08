# 4. Cartographie 2.5D & Expérience Visuelle

Ce document décrit le fonctionnement du moteur cartographique, les sources de données géographiques suisses, le rendu 3D, le système de particules et les composants mobiles interactifs de **Village en Fête**.

---

## 🗺️ Moteur Cartographique (MapLibre GL JS)

La carte principale est implémentée dans `src/components/map/Map3DContainer.tsx` à l'aide de **MapLibre GL JS**, une bibliothèque libre, rapide et performante basée sur WebGL.

### Flux de Tuiles et Sources Hybrides
La carte combine deux couches officielles :
1. **Plan Cadastral / Rétro Neutre** : Tuiles OpenStreetMap traitées par filtres WebGL (désaturation et contraste personnalisé) pour un rendu épuré mettant en valeur les décorations.
2. **Orthophoto Aérienne Swisstopo (`SWISSIMAGE`)** : Tuiles aériennes haute résolution issues du géo-portail national suisse `wmts.geo.admin.ch`, activables d'un clic via le sélecteur de couches.

---

## 🏢 Bâtiments 3D & Extrusions Cadastrales

Les bâtiments du village sont représentés sous forme de volumes extrudés en 3D à partir du fichier `public/data/vufflens-buildings-3d.geojson` :

```typescript
map.addLayer({
  id: "village-buildings-3d",
  type: "fill-extrusion",
  source: "village-buildings-source",
  paint: {
    "fill-extrusion-color": [
      "case",
      ["boolean", ["feature-state", "highlighted"], false],
      theme.buildingHighlight,
      theme.buildingDefault
    ],
    "fill-extrusion-height": ["get", "height"],
    "fill-extrusion-base": ["get", "min_height"],
    "fill-extrusion-opacity": 0.88,
  },
});
```

### Caractéristiques de l'extrusion 3D :
- **Hauteur réaliste** : Calculée à partir des étages cadastrés ou de la hauteur réelle fournie par le modèle de données Swisstopo.
- **Mise en valeur contextuelle** : Lorsqu'une adresse participante accueille un événement, ou lorsqu'un utilisateur survole un élément dans la liste, le bâtiment s'illumine dans la teinte de la fête (orange chaud pour Halloween, doré chaleureux pour l'Avent).
- **Inclinaison dynamique (Pitch)** : La caméra bascule automatiquement avec une inclinaison de 45° pour apprécier les volumes architecturaux du village.

---

## ❄️ Atmosphère Visuelle & Particules Réactives

Le composant `AtmosphericParticles.tsx` génère une animation sur toile HTML5 Canvas superposée à la carte, créant une ambiance festive immersive adaptée à la météo et à la saison :

- **Saison Halloween** :
  - Particules de braises incandescentes (*embers*) et de lucioles violettes montant doucement vers le haut de l'écran avec une variation de transparence aléatoire.
  - Brume légère oscillante.
- **Saison de l'Avent / Noël** :
  - Flocons de neige délicats descendant lentement avec un décalage horizontal fluide (*snow drift*).
  - Éclats dorés lumineux scintillants à proximité des fenêtres de l'Avent allumées.

Les particules peuvent être activées ou désactivées à tout moment par l'utilisateur depuis les commandes rapides de la carte.

---

## 📱 Tiroir Tactile Rétractable (`MobileDrawer`)

L'interface mobile propose un tiroir tactile optimisé pour smartphone à 3 crans de hauteur (*snaps*) via **Framer Motion** :

1. **`collapsed` (135 px)** : Vue synthèse affichant le statut de la fête, la météo, la prochaine animation et la barre d'accès rapide.
2. **`card` (440 px)** : Fiche détaillée de l'adresse sélectionnée (photo de la façade, horaires d'accueil, formule proposée, accessibilité PMR, distance GPS et itinéraire).
3. **`expanded` (85dvh)** : Liste complète des adresses participantes avec barre de recherche, filtres actifs et vue chronologique.

### Fonctionnalités intégrées au Drawer :
- **Calculs Géodésiques GPS (Haversine)** : Calcule la distance réelle séparant la position de l'habitant de chaque maison participante, avec estimation du temps de marche à pied (~4.3 km/h).
- **Bouton Itinéraire Piéton** : Trace la boucle complète de promenade reliant tous les points participants dans un ordre géographique optimisé.
- **Export Calendrier (.ics)** : Permet d'ajouter la festivité en 1 clic dans Apple Calendar, Google Calendar ou Outlook.
- **Retours Haptiques (Vibrations)** : Déclenche de légères vibrations haptiques (`navigator.vibrate`) lors des interactions tactiles sur smartphone.
- **Suivi des Visites (LocalStorage)** : Permet aux enfants et familles de cocher les maisons déjà visitées au cours de la soirée.
