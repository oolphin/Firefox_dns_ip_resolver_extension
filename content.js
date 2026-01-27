// Injection du CSS pour les résultats
(function() {
  // Éviter les injections multiples
  if (document.getElementById('dns-ip-resolver-styles')) return;
  
  const style = document.createElement('style');
  style.id = 'dns-ip-resolver-styles';
  style.textContent = `
    .dns-ip-resolver-overlay {
      position: fixed;
      top: 20px;
      right: 20px;
      width: 400px;
      max-height: 80vh;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      overflow: hidden;
      animation: dns-slideIn 0.3s ease-out;
    }
    
    @keyframes dns-slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    .dns-ip-resolver-header {
      background: #2c3e50;
      color: white;
      padding: 15px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .dns-ip-resolver-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0;
    }
    
    .dns-ip-resolver-close {
      background: none;
      border: none;
      color: white;
      font-size: 24px;
      cursor: pointer;
      line-height: 1;
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .dns-ip-resolver-close:hover {
      opacity: 0.8;
    }
    
    .dns-ip-resolver-content {
      padding: 20px;
      max-height: calc(80vh - 60px);
      overflow-y: auto;
    }
    
    .dns-ip-resolver-section {
      margin-bottom: 20px;
    }
    
    .dns-ip-resolver-section:last-child {
      margin-bottom: 0;
    }
    
    .dns-ip-resolver-section-title {
      font-size: 14px;
      font-weight: 600;
      color: #2c3e50;
      margin: 0 0 10px 0;
      padding-bottom: 5px;
      border-bottom: 2px solid #3498db;
    }
    
    .dns-ip-resolver-info-grid {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 10px;
      font-size: 14px;
    }
    
    .dns-ip-resolver-label {
      font-weight: 600;
      color: #7f8c8d;
    }
    
    .dns-ip-resolver-value {
      color: #2c3e50;
      word-break: break-all;
    }
    
    .dns-ip-resolver-ip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 5px;
    }
    
    .dns-ip-resolver-ip-chip {
      display: inline-block;
      background: #e3f2fd;
      color: #1976d2;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
    }
    
    .dns-ip-resolver-private {
      background: #ffebee;
      color: #c62828;
    }
    
    .dns-ip-resolver-public {
      background: #e8f5e9;
      color: #2e7d32;
    }
    
    .dns-ip-resolver-map-link {
      display: inline-block;
      margin-top: 10px;
      color: #3498db;
      text-decoration: none;
      font-size: 14px;
    }
    
    .dns-ip-resolver-map-link:hover {
      text-decoration: underline;
    }
    
    .dns-ip-resolver-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      color: white;
      margin-right: 4px;
    }
    
    .dns-ip-resolver-code {
      background: #ecf0f1;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 12px;
    }
    
    .dns-ip-resolver-link {
      color: #3498db;
      text-decoration: none;
    }
    
    .dns-ip-resolver-link:hover {
      text-decoration: underline;
    }
    
    .dns-ip-resolver-age {
      color: #7f8c8d;
      font-size: 12px;
    }
  `;
  document.head.appendChild(style);
})();

// Écoute des messages du background script
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'showResults') {
    showResults(message.data);
  }
  return false;
});

// Fonction utilitaire pour créer un élément avec des attributs et du contenu
function createElement(tag, attributes = {}, children = []) {
  const element = document.createElement(tag);
  
  for (const [key, value] of Object.entries(attributes)) {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('data')) {
      element.setAttribute(key.replace(/([A-Z])/g, '-$1').toLowerCase(), value);
    } else {
      element.setAttribute(key, value);
    }
  }
  
  for (const child of children) {
    if (typeof child === 'string') {
      element.appendChild(document.createTextNode(child));
    } else if (child instanceof Node) {
      element.appendChild(child);
    }
  }
  
  return element;
}

// Fonction pour créer une ligne label/valeur
function createInfoRow(label, value, isHtml = false) {
  const fragment = document.createDocumentFragment();
  
  const labelDiv = createElement('div', { className: 'dns-ip-resolver-label' }, [label]);
  const valueDiv = createElement('div', { className: 'dns-ip-resolver-value' });
  
  if (isHtml && value instanceof Node) {
    valueDiv.appendChild(value);
  } else {
    valueDiv.textContent = value || '';
  }
  
  fragment.appendChild(labelDiv);
  fragment.appendChild(valueDiv);
  
  return fragment;
}

// Fonction pour créer une section
function createSection(title, contentElements) {
  const section = createElement('div', { className: 'dns-ip-resolver-section' });
  const titleEl = createElement('h4', { className: 'dns-ip-resolver-section-title' }, [title]);
  const grid = createElement('div', { className: 'dns-ip-resolver-info-grid' });
  
  section.appendChild(titleEl);
  
  for (const el of contentElements) {
    if (el instanceof Node) {
      grid.appendChild(el);
    }
  }
  
  section.appendChild(grid);
  return section;
}

// Fonction pour créer un badge
function createBadge(text, color) {
  return createElement('span', { 
    className: 'dns-ip-resolver-badge',
    style: { backgroundColor: color }
  }, [text]);
}

// Fonction pour créer un lien
function createLink(href, text, isExternal = true) {
  const attrs = { 
    href: href, 
    className: 'dns-ip-resolver-link'
  };
  if (isExternal) {
    attrs.target = '_blank';
    attrs.rel = 'noopener noreferrer';
  }
  return createElement('a', attrs, [text]);
}

// Fonction pour afficher les résultats
function showResults(data) {
  // Supprimer l'overlay précédent s'il existe
  const existingOverlay = document.querySelector('.dns-ip-resolver-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Créer le nouvel overlay
  const overlay = createElement('div', { className: 'dns-ip-resolver-overlay' });
  
  // Header
  const header = createElement('div', { className: 'dns-ip-resolver-header' });
  const title = createElement('h3', { className: 'dns-ip-resolver-title' }, [
    data.type === 'dns' ? 'Résolution DNS' : 'Résolution IP'
  ]);
  const closeBtn = createElement('button', { 
    className: 'dns-ip-resolver-close',
    'aria-label': 'Fermer'
  }, ['×']);
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  overlay.appendChild(header);
  
  // Content
  const content = createElement('div', { className: 'dns-ip-resolver-content' });
  
  if (data.type === 'dns') {
    buildDNSResults(content, data);
  } else if (data.type === 'ip') {
    buildIPResults(content, data);
  }
  
  overlay.appendChild(content);
  document.body.appendChild(overlay);
  
  // Gestionnaire pour fermer l'overlay
  closeBtn.addEventListener('click', () => {
    overlay.remove();
  });
  
  // Fermer avec la touche Échap
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);
  
  // Auto-fermeture optionnelle
  browser.storage.local.get('autoClose').then(settings => {
    if (settings.autoClose) {
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          overlay.remove();
        }
      }, 10000);
    }
  }).catch(() => {});
}

// Construire les résultats DNS
function buildDNSResults(container, data) {
  const hasPrivate = data.addresses && data.addresses.some(ip => isPrivateIP(ip));
  
  // Section informations du domaine
  const domainRows = [];
  
  domainRows.push(createInfoRow('Domaine:', data.domain));
  
  // Type de nom
  const nameTypeSpan = createElement('span', {
    style: { 
      color: data.isShortName ? '#e67e22' : '#27ae60',
      fontWeight: 'bold'
    }
  }, [data.isShortName ? 'Nom court' : 'FQDN']);
  domainRows.push(createInfoRow('Type de nom:', nameTypeSpan, true));
  
  domainRows.push(createInfoRow('Nom canonique:', data.canonicalName || data.domain));
  domainRows.push(createInfoRow('Serveur DNS:', data.dnsServer || 'Non spécifié'));
  domainRows.push(createInfoRow('Temps:', (data.resolutionTime || 'N/A') + ' ms'));
  domainRows.push(createInfoRow('Méthode:', data.isTRR ? 'DNS over HTTPS' : 'DNS système'));
  
  container.appendChild(createSection('Informations du domaine', domainRows));
  
  // Section adresses IP
  const ipSection = createElement('div', { className: 'dns-ip-resolver-section' });
  ipSection.appendChild(createElement('h4', { className: 'dns-ip-resolver-section-title' }, ['Adresses IP']));
  
  const ipList = createElement('div', { className: 'dns-ip-resolver-ip-list' });
  for (const ip of (data.addresses || [])) {
    const chipClass = 'dns-ip-resolver-ip-chip ' + (isPrivateIP(ip) ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public');
    ipList.appendChild(createElement('span', { className: chipClass }, [ip]));
  }
  ipSection.appendChild(ipList);
  
  const typeGrid = createElement('div', { className: 'dns-ip-resolver-info-grid', style: { marginTop: '15px' } });
  typeGrid.appendChild(createInfoRow('Type:', hasPrivate ? 'Réseau privé' : 'Réseau public'));
  ipSection.appendChild(typeGrid);
  
  container.appendChild(ipSection);
  
  // Section IP Info
  if (data.ipInfo) {
    buildIPInfoSection(container, data.ipInfo, data.addresses[0]);
  }
  
  // Section technique
  if (data.timestamp) {
    const techRows = [];
    techRows.push(createInfoRow('Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR')));
    if (data.source) {
      techRows.push(createInfoRow('Source:', data.source));
    }
    container.appendChild(createSection('Informations techniques', techRows));
  }
}

// Construire les résultats IP
function buildIPResults(container, data) {
  // Section informations IP
  const ipRows = [];
  
  ipRows.push(createInfoRow('Adresse IP:', data.ip));
  
  // Type d'IP
  const typeChip = createElement('span', {
    className: 'dns-ip-resolver-ip-chip ' + (data.isPrivate ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public')
  }, [data.isPrivate ? 'IP privée' : 'IP publique']);
  ipRows.push(createInfoRow('Type:', typeChip, true));
  
  ipRows.push(createInfoRow('Serveur DNS:', data.dnsServer || 'Non spécifié'));
  ipRows.push(createInfoRow('Temps:', (data.resolutionTime || 'N/A') + ' ms'));
  
  if (data.reverseDNS && data.reverseDNS !== 'Non disponible') {
    ipRows.push(createInfoRow('Nom inverse:', data.reverseDNS));
  }
  
  container.appendChild(createSection("Informations de l'adresse IP", ipRows));
  
  // Section IP Info
  if (data.ipInfo) {
    buildIPInfoSection(container, data.ipInfo, data.ip);
  }
  
  // Section technique
  if (data.timestamp) {
    const techRows = [];
    techRows.push(createInfoRow('Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR')));
    container.appendChild(createSection('Informations techniques', techRows));
  }
}

// Construire la section d'informations IP détaillées
function buildIPInfoSection(container, ipInfo, ip) {
  if (!ipInfo || ipInfo.city === "Information non disponible") {
    return;
  }
  
  // Section Géolocalisation
  const geoRows = [];
  
  geoRows.push(createInfoRow('IP:', ipInfo.ip || ip));
  
  // Type d'IP
  if (ipInfo.ipType) {
    const typeBadge = createBadge(ipInfo.ipType.label, ipInfo.ipType.color);
    geoRows.push(createInfoRow("Type d'IP:", typeBadge, true));
  }
  
  // Indicateurs
  if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
    const indicatorsContainer = createElement('span');
    if (ipInfo.isMobile) indicatorsContainer.appendChild(createBadge('📱 Mobile', '#3498db'));
    if (ipInfo.isProxy) indicatorsContainer.appendChild(createBadge('🔒 Proxy/VPN', '#e74c3c'));
    if (ipInfo.isHosting) indicatorsContainer.appendChild(createBadge('🖥️ Datacenter', '#9b59b6'));
    geoRows.push(createInfoRow('Indicateurs:', indicatorsContainer, true));
  }
  
  if (ipInfo.hostname) {
    geoRows.push(createInfoRow('Hostname:', ipInfo.hostname));
  }
  
  const location = [ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean).join(', ');
  geoRows.push(createInfoRow('Localisation:', location));
  
  if (ipInfo.postal) {
    geoRows.push(createInfoRow('Code postal:', ipInfo.postal));
  }
  
  if (ipInfo.loc && ipInfo.loc !== 'Non disponible') {
    geoRows.push(createInfoRow('Coordonnées:', ipInfo.loc));
  }
  
  if (ipInfo.timezone && ipInfo.timezone !== 'Non disponible') {
    geoRows.push(createInfoRow('Fuseau horaire:', ipInfo.timezone));
  }
  
  const geoSection = createSection('Géolocalisation', geoRows);
  
  // Lien Google Maps
  if (ipInfo.loc && ipInfo.loc !== '0,0' && ipInfo.loc !== 'Non disponible') {
    const [lat, lon] = ipInfo.loc.split(',');
    const mapLink = createLink('https://maps.google.com/?q=' + lat + ',' + lon, '📍 Voir sur Google Maps');
    mapLink.className = 'dns-ip-resolver-map-link';
    geoSection.appendChild(mapLink);
  }
  
  container.appendChild(geoSection);
  
  // Section ASN / Propriétaire
  if (ipInfo.asn || ipInfo.asnInfo) {
    const asnData = ipInfo.asnInfo || {};
    const asnRows = [];
    
    if (ipInfo.asn) {
      const asnLink = createLink('https://bgpview.io/asn/' + ipInfo.asn.replace('AS', ''), ipInfo.asn);
      asnRows.push(createInfoRow('ASN:', asnLink, true));
    }
    
    if (ipInfo.orgName || asnData.name) {
      asnRows.push(createInfoRow('Organisation:', ipInfo.orgName || asnData.name));
    }
    
    if (asnData.description) {
      asnRows.push(createInfoRow('Description:', asnData.description));
    }
    
    if (ipInfo.isp && ipInfo.isp !== ipInfo.orgName) {
      asnRows.push(createInfoRow('FAI:', ipInfo.isp));
    }
    
    if (asnData.country || ipInfo.country) {
      asnRows.push(createInfoRow('Pays (ASN):', asnData.country || ipInfo.country));
    }
    
    if (asnData.rirName) {
      asnRows.push(createInfoRow('RIR:', asnData.rirName));
    }
    
    if (asnData.dateAllocated) {
      const ageContainer = createElement('span');
      ageContainer.appendChild(document.createTextNode(asnData.dateAllocated + ' '));
      ageContainer.appendChild(createElement('span', { className: 'dns-ip-resolver-age' }, [calculateAge(asnData.dateAllocated)]));
      asnRows.push(createInfoRow('Date allocation:', ageContainer, true));
    }
    
    if (asnData.website) {
      const websiteLink = createLink(asnData.website, asnData.website);
      asnRows.push(createInfoRow('Site web:', websiteLink, true));
    }
    
    if (asnRows.length > 0) {
      container.appendChild(createSection('Informations ASN / Propriétaire', asnRows));
    }
  }
  
  // Section Plage IP
  if (ipInfo.ipRange) {
    const rangeRows = [];
    
    const prefixCode = createElement('code', { className: 'dns-ip-resolver-code' }, [ipInfo.ipRange.prefix]);
    rangeRows.push(createInfoRow('Préfixe:', prefixCode, true));
    
    if (ipInfo.ipRange.name) {
      rangeRows.push(createInfoRow('Nom:', ipInfo.ipRange.name));
    }
    
    if (ipInfo.ipRange.description) {
      rangeRows.push(createInfoRow('Description:', ipInfo.ipRange.description));
    }
    
    container.appendChild(createSection('Plage IP / Préfixe', rangeRows));
  }
  
  // Section Contact Abuse
  if (ipInfo.abuse) {
    const abuseRows = [];
    
    if (ipInfo.abuse.name) {
      abuseRows.push(createInfoRow('Nom:', ipInfo.abuse.name));
    }
    
    if (ipInfo.abuse.email) {
      const emailLink = createLink('mailto:' + ipInfo.abuse.email, ipInfo.abuse.email, false);
      abuseRows.push(createInfoRow('Email:', emailLink, true));
    }
    
    if (ipInfo.abuse.phone) {
      abuseRows.push(createInfoRow('Téléphone:', ipInfo.abuse.phone));
    }
    
    if (ipInfo.abuse.network) {
      abuseRows.push(createInfoRow('Réseau:', ipInfo.abuse.network));
    }
    
    if (abuseRows.length > 0) {
      container.appendChild(createSection('Contact Abuse', abuseRows));
    }
  }
}

// Fonction pour calculer l'âge depuis une date
function calculateAge(dateString) {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffYears = Math.floor(diffDays / 365);
    const diffMonths = Math.floor((diffDays % 365) / 30);
    
    if (diffYears > 0) {
      return '(' + diffYears + ' an' + (diffYears > 1 ? 's' : '') + (diffMonths > 0 ? ', ' + diffMonths + ' mois' : '') + ')';
    } else if (diffMonths > 0) {
      return '(' + diffMonths + ' mois)';
    } else {
      return '(' + diffDays + ' jours)';
    }
  } catch (e) {
    return '';
  }
}

// Fonction pour vérifier si une IP est privée
function isPrivateIP(ip) {
  if (!ip || typeof ip !== 'string') return false;
  const parts = ip.split('.').map(Number);
  
  if (parts.length !== 4) return false;
  
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  
  return false;
}
