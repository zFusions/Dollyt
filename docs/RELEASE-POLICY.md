# Politique de releases (export)

À partir de novembre 2026 : **pas de brouillon GitHub par micro-correctif**.

- Les fixes s’accumulent sur `master`.
- **Un seul tag** quand une fournée est testée (objectif : export extrait sur source longue, preset Source ou QUALITY MAX).
- Les brouillons 1.2.3 / 1.2.4 ne servent pas de référence pour les tests utilisateur.

Build local pour tester entre deux tags : `npm run tauri build` (Windows, outils déjà stagés).