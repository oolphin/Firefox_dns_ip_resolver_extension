# 🌐 DNS & IP Resolver - Extension Firefox

Une extension Firefox puissante pour résoudre les noms de domaine et adresses IP directement depuis le menu contextuel, avec des informations détaillées sur la géolocalisation, le propriétaire et l'infrastructure.

![Version](https://img.shields.io/badge/version-1.2.0-blue.svg)
![Firefox](https://img.shields.io/badge/Firefox-91%2B-orange.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## ✨ Fonctionnalités

### Résolution DNS
- **Noms de domaine (FQDN)** : Résout les domaines complets comme `google.com`, `github.com`
- **Noms courts** : Supporte les noms locaux/intranet comme `server1`, `intranet`, `mail-srv`
- **DNS local** : Utilise le serveur DNS configuré sur votre système
- **Fallback intelligent** : Bascule automatiquement vers Cloudflare/Google DNS si nécessaire

### Informations IP détaillées
- **Géolocalisation** : Ville, région, pays, coordonnées GPS avec lien Google Maps
- **Type d'IP** : Détection automatique (Cloud/Datacenter, Résidentiel, Mobile, VPN/Proxy, Hébergement)
- **Informations ASN** : Numéro AS, organisation propriétaire, description
- **Plage IP** : Préfixe CIDR, nom et description du bloc
- **Âge de l'allocation** : Date d'attribution de la plage IP avec calcul de l'ancienneté
- **Contact Abuse** : Email et téléphone pour signaler les abus (avec token ipinfo.io)
- **Indicateurs** : Badges visuels pour Mobile 📱, Proxy/VPN 🔒, Datacenter 🖥️

### Interface utilisateur
- **Menu contextuel** : Clic droit sur n'importe quel texte sélectionné
- **Popup intégré** : Interface complète accessible depuis la barre d'outils
- **Overlay élégant** : Résultats affichés directement sur la page
- **Historique** : Sauvegarde des 10 dernières recherches
- **Notifications** : Alertes optionnelles pendant la résolution

## 📸 Captures d'écran

### Menu contextuel
Sélectionnez un domaine ou une IP, faites un clic droit et choisissez l'option de résolution.

### Résultats détaillés
Les informations s'affichent dans un overlay élégant avec toutes les données disponibles.

### Popup
Accédez rapidement à l'extension depuis la barre d'outils Firefox.

## 🚀 Installation

### Depuis le fichier XPI
1. Téléchargez le fichier `dns_ip_resolver-1.2.0.xpi`
2. Ouvrez Firefox et allez dans `about:addons`
3. Cliquez sur l'icône ⚙️ → "Installer un module depuis un fichier..."
4. Sélectionnez le fichier XPI téléchargé

### Installation temporaire (développement)
1. Ouvrez Firefox et allez dans `about:debugging`
2. Cliquez sur "Ce Firefox" dans le menu de gauche
3. Cliquez sur "Charger un module temporaire..."
4. Sélectionnez le fichier `manifest.json` du projet

### Depuis les sources
```bash
git clone https://github.com/oolphin/Firefox_dns_ip_resolver_extension.git
cd Firefox_dns_ip_resolver_extension
# Puis chargez l'extension via about:debugging
```

## 📖 Utilisation

### Via le menu contextuel
1. Sélectionnez un nom de domaine ou une adresse IP sur n'importe quelle page web
2. Faites un clic droit pour ouvrir le menu contextuel
3. Choisissez l'option appropriée :
   - **Résoudre le nom de domaine** : Pour les FQDN et noms courts
   - **Résoudre l'adresse IP** : Pour les adresses IPv4
   - **Afficher toutes les informations** : Détection automatique

### Via le popup
1. Cliquez sur l'icône de l'extension dans la barre d'outils
2. Entrez un domaine ou une IP dans le champ de saisie
3. Cliquez sur "Résoudre" ou appuyez sur Entrée

### Exemples de requêtes supportées
| Type | Exemples |
|------|----------|
| FQDN | `google.com`, `sub.domain.org`, `api.example.co.uk` |
| Nom court | `server1`, `intranet`, `mail-srv`, `dc01` |
| IPv4 publique | `8.8.8.8`, `1.1.1.1`, `208.67.222.222` |
| IPv4 privée | `192.168.1.1`, `10.0.0.1`, `172.16.0.1` |

## ⚙️ Configuration

### Token ipinfo.io (optionnel)
Pour obtenir des informations supplémentaires (contact abuse, données enrichies) :

1. Créez un compte gratuit sur [ipinfo.io](https://ipinfo.io)
2. Récupérez votre token API (50 000 requêtes/mois gratuites)
3. Ouvrez le popup de l'extension
4. Collez votre token dans le champ "Token ipinfo.io"
5. Cliquez sur "Enregistrer"

### Options disponibles
| Option | Description | Par défaut |
|--------|-------------|------------|
| Token ipinfo.io | Clé API pour données enrichies | Vide |
| Fermeture auto | Ferme l'overlay après 10 secondes | Désactivé |
| Notifications | Affiche les notifications système | Activé |

## 🏗️ Structure du projet

```
Firefox_dns_ip_resolver_extension/
├── manifest.json          # Configuration de l'extension
├── background.js          # Script principal (résolution DNS, API)
├── content.js             # Injection de l'overlay dans les pages
├── dnsDetector.js         # Détection du serveur DNS local
├── popup/
│   ├── popup.html         # Interface du popup
│   ├── popup.js           # Logique du popup
│   └── popup.css          # Styles du popup
├── icons/
│   ├── icon-16.png
│   ├── icon-32.png
│   ├── icon-48.png
│   └── icon-96.png
└── README.md
```

## 🔧 APIs et sources de données

L'extension utilise plusieurs sources pour fournir des informations complètes :

| Source | Données | Limite |
|--------|---------|--------|
| [Firefox DNS API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/dns) | Résolution DNS locale | Illimitée |
| [ipinfo.io](https://ipinfo.io) | Géolocalisation, ASN, Abuse | 50k/mois (gratuit) |
| [BGPView](https://bgpview.io) | Détails ASN, Préfixes, Allocation | Illimitée |
| [ip-api.com](https://ip-api.com) | Fallback géolocalisation | 45/minute |
| [Cloudflare DNS](https://cloudflare-dns.com) | Résolution DNS fallback | Illimitée |
| [Google DNS](https://dns.google) | Résolution DNS fallback | Illimitée |

## 🛡️ Permissions requises

| Permission | Raison |
|------------|--------|
| `contextMenus` | Afficher les options dans le menu clic droit |
| `activeTab` | Injecter l'overlay dans la page active |
| `storage` | Sauvegarder les paramètres et l'historique |
| `dns` | Utiliser l'API DNS native de Firefox |
| `notifications` | Afficher les notifications système |
| `<all_urls>` | Permettre la résolution sur tous les sites |

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :

1. 🍴 Fork le projet
2. 🔧 Créer une branche (`git checkout -b feature/amelioration`)
3. 💾 Commit vos changements (`git commit -am 'Ajout d'une fonctionnalité'`)
4. 📤 Push sur la branche (`git push origin feature/amelioration`)
5. 🔃 Ouvrir une Pull Request

### Idées d'améliorations
- [ ] Support IPv6
- [ ] Export des résultats (JSON, CSV)
- [ ] Thème sombre
- [ ] Résolution DNS inverse améliorée
- [ ] Support des enregistrements MX, TXT, CNAME
- [ ] Intégration VirusTotal pour la réputation

## 📝 Changelog

### v1.2.1
- ✨ Informations IP détaillées (ASN, propriétaire, âge)
- ✨ Détection du type d'IP (Cloud, Privée, VPN, etc.)
- ✨ Support des noms courts (intranet)
- ✨ Intégration BGPView pour les données ASN
- ✨ Intégration de la mise en forme dynamique du popup
- ✨ Authorisation du déploiement dans la bibliothèque "Addons Mozilla"
- 🔗 Mise à jour du dépôt GitHub

### v1.2.0
- ✨ Informations IP détaillées (ASN, propriétaire, âge)
- ✨ Détection du type d'IP (Cloud, Résidentiel, VPN, etc.)
- ✨ Support des noms courts (intranet)
- ✨ Intégration BGPView pour les données ASN
- 🔗 Ajout du lien GitHub

### v1.1.0
- ✨ Support du DNS local
- ✨ Intégration dnsDetector
- 🐛 Corrections de bugs

### v1.0.0
- 🎉 Version initiale
- ✨ Résolution DNS et IP
- ✨ Géolocalisation basique
- ✨ Menu contextuel et popup

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

## 👨‍💻 Auteur

**Guy SOW**
- GitHub : [@oolphin](https://github.com/oolphin)
- Email : info@thetekitpro.fr

---

⭐ Si cette extension vous est utile, n'hésitez pas à mettre une étoile sur le repo !

Made with ❤️ by <a href="https://github.com/LAB-INF0/.githLAB" target="_blank">LAB-INFO</a>

🧠 *LAB-INFO – Depuis 2024 / Since 2024, pour un logiciel libre, durable et responsable / for free, sustainable, and responsible software.*
