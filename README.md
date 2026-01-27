# DNS & IP Resolver pour Firefox

Extension Firefox permanente pour résoudre les noms de domaine et adresses IP avec le serveur DNS local.

## Fonctionnalités

- 🔍 **Résolution DNS locale** : Utilise le serveur DNS configuré sur votre PC
- 🔄 **Reverse DNS** : Résolution inverse des adresses IP
- 🌍 **Géolocalisation** : Informations de localisation pour les IPs publiques
- 🖱️ **Menu contextuel** : Cliquez droit sur les noms de domaine ou IPs
- ⚡ **Cache local** : Mise en cache des résultats pour plus de rapidité
- 🔧 **Interface de configuration** : Paramètres personnalisables

## Installation permanente

### Méthode 1 : Package signé (recommandé)

1. Téléchargez le fichier `.xpi` depuis les releases
2. Dans Firefox, allez dans `about:addons`
3. Cliquez sur le menu (≡) → "Installer un module depuis un fichier"
4. Sélectionnez le fichier `.xpi`
5. Confirmez l'installation

### Méthode 2 : Installation depuis le code source

1. Clonez ou téléchargez ce dépôt
2. Ouvrez `about:debugging` dans Firefox
3. Cliquez sur "Ce Firefox" → "Charger un module temporaire"
4. Naviguez jusqu'au dossier de l'extension
5. Sélectionnez le fichier `manifest.json`
6. **Important** : Pour le rendre permanent, suivez les étapes de packaging ci-dessous

## Packaging pour installation permanente

### Sur Windows

```bash
# 1. Installer Node.js et npm
# 2. Installer web-ext
npm install --global web-ext

# 3. Créer le package
web-ext build --source-dir ./dns-ip-resolver-permanent --artifacts-dir ./dist