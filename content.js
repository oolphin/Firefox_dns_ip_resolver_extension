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

// Fonction pour afficher les résultats
function showResults(data) {
  // Supprimer l'overlay précédent s'il existe
  const existingOverlay = document.querySelector('.dns-ip-resolver-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }
  
  // Créer le nouvel overlay
  const overlay = document.createElement('div');
  overlay.className = 'dns-ip-resolver-overlay';
  
  // Créer l'en-tête
  const header = document.createElement('div');
  header.className = 'dns-ip-resolver-header';
  
  const title = document.createElement('h3');
  title.className = 'dns-ip-resolver-title';
  title.textContent = data.type === 'dns' ? 'Résolution DNS' : 'Résolution IP';
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'dns-ip-resolver-close';
  closeBtn.setAttribute('aria-label', 'Fermer');
  closeBtn.textContent = '×';
  
  header.appendChild(title);
  header.appendChild(closeBtn);
  
  // Créer le contenu
  const content = document.createElement('div');
  content.className = 'dns-ip-resolver-content';
  
  // Ajouter le contenu spécifique
  if (data.type === 'dns') {
    createDNSResults(data, content);
  } else if (data.type === 'ip') {
    createIPResults(data, content);
  }
  
  overlay.appendChild(header);
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

// Fonction pour créer le contenu des résultats DNS
function createDNSResults(data, container) {
  const hasPrivate = data.addresses && data.addresses.some(ip => isPrivateIP(ip));
  
  // Section informations du domaine
  const domainSection = document.createElement('div');
  domainSection.className = 'dns-ip-resolver-section';
  
  const domainTitle = document.createElement('h4');
  domainTitle.className = 'dns-ip-resolver-section-title';
  domainTitle.textContent = 'Informations du domaine';
  
  const domainGrid = document.createElement('div');
  domainGrid.className = 'dns-ip-resolver-info-grid';
  
  // Ajouter les informations
  addGridRow(domainGrid, 'Domaine:', escapeHtml(data.domain));
  addGridRow(domainGrid, 'Type de nom:', data.isShortName ? 'Nom court' : 'FQDN');
  addGridRow(domainGrid, 'Nom canonique:', escapeHtml(data.canonicalName || data.domain));
  addGridRow(domainGrid, 'Serveur DNS:', escapeHtml(data.dnsServer || 'Non spécifié'));
  addGridRow(domainGrid, 'Temps:', data.resolutionTime ? `${data.resolutionTime} ms` : 'N/A');
  addGridRow(domainGrid, 'Méthode:', data.isTRR ? 'DNS over HTTPS' : 'DNS système');
  
  domainSection.appendChild(domainTitle);
  domainSection.appendChild(domainGrid);
  container.appendChild(domainSection);
  
  // Section adresses IP
  if (data.addresses && data.addresses.length > 0) {
    const ipSection = document.createElement('div');
    ipSection.className = 'dns-ip-resolver-section';
    
    const ipTitle = document.createElement('h4');
    ipTitle.className = 'dns-ip-resolver-section-title';
    ipTitle.textContent = 'Adresses IP';
    
    const ipList = document.createElement('div');
    ipList.className = 'dns-ip-resolver-ip-list';
    
    // Ajouter chaque IP
    data.addresses.forEach(ip => {
      const ipChip = document.createElement('span');
      ipChip.className = `dns-ip-resolver-ip-chip ${isPrivateIP(ip) ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}`;
      ipChip.textContent = escapeHtml(ip);
      ipList.appendChild(ipChip);
    });
    
    const typeGrid = document.createElement('div');
    typeGrid.className = 'dns-ip-resolver-info-grid';
    typeGrid.style.marginTop = '15px';
    addGridRow(typeGrid, 'Type:', hasPrivate ? 'Réseau privé' : 'Réseau public');
    
    ipSection.appendChild(ipTitle);
    ipSection.appendChild(ipList);
    ipSection.appendChild(typeGrid);
    container.appendChild(ipSection);
  }
  
  // Informations IP supplémentaires
  if (data.ipInfo) {
    createIPInfoSection(data.ipInfo, data.addresses?.[0], container);
  }
  
  // Informations techniques
  if (data.timestamp) {
    const techSection = document.createElement('div');
    techSection.className = 'dns-ip-resolver-section';
    
    const techTitle = document.createElement('h4');
    techTitle.className = 'dns-ip-resolver-section-title';
    techTitle.textContent = 'Informations techniques';
    
    const techGrid = document.createElement('div');
    techGrid.className = 'dns-ip-resolver-info-grid';
    
    addGridRow(techGrid, 'Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR'));
    
    if (data.source) {
      addGridRow(techGrid, 'Source:', escapeHtml(data.source));
    }
    
    techSection.appendChild(techTitle);
    techSection.appendChild(techGrid);
    container.appendChild(techSection);
  }
}

// Fonction pour créer le contenu des résultats IP
function createIPResults(data, container) {
  // Section informations IP
  const ipSection = document.createElement('div');
  ipSection.className = 'dns-ip-resolver-section';
  
  const ipTitle = document.createElement('h4');
  ipTitle.className = 'dns-ip-resolver-section-title';
  ipTitle.textContent = 'Informations de l\'adresse IP';
  
  const ipGrid = document.createElement('div');
  ipGrid.className = 'dns-ip-resolver-info-grid';
  
  // Ajouter les informations
  addGridRow(ipGrid, 'Adresse IP:', escapeHtml(data.ip));
  
  const typeChip = document.createElement('span');
  typeChip.className = `dns-ip-resolver-ip-chip ${data.isPrivate ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}`;
  typeChip.textContent = data.isPrivate ? 'IP privée' : 'IP publique';
  
  const typeValue = document.createElement('div');
  typeValue.className = 'dns-ip-resolver-value';
  typeValue.appendChild(typeChip);
  
  ipGrid.appendChild(createGridLabel('Type:'));
  ipGrid.appendChild(typeValue);
  
  addGridRow(ipGrid, 'Serveur DNS:', escapeHtml(data.dnsServer || 'Non spécifié'));
  addGridRow(ipGrid, 'Temps:', data.resolutionTime ? `${data.resolutionTime} ms` : 'N/A');
  
  if (data.reverseDNS && data.reverseDNS !== 'Non disponible') {
    addGridRow(ipGrid, 'Nom inverse:', escapeHtml(data.reverseDNS));
  }
  
  ipSection.appendChild(ipTitle);
  ipSection.appendChild(ipGrid);
  container.appendChild(ipSection);
  
  // Informations IP supplémentaires
  if (data.ipInfo) {
    createIPInfoSection(data.ipInfo, data.ip, container);
  }
  
  // Informations techniques
  if (data.timestamp) {
    const techSection = document.createElement('div');
    techSection.className = 'dns-ip-resolver-section';
    
    const techTitle = document.createElement('h4');
    techTitle.className = 'dns-ip-resolver-section-title';
    techTitle.textContent = 'Informations techniques';
    
    const techGrid = document.createElement('div');
    techGrid.className = 'dns-ip-resolver-info-grid';
    
    addGridRow(techGrid, 'Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR'));
    
    techSection.appendChild(techTitle);
    techSection.appendChild(techGrid);
    container.appendChild(techSection);
  }
}

// Fonction pour créer la section des informations IP
function createIPInfoSection(ipInfo, ip, container) {
  if (!ipInfo || ipInfo.city === "Information non disponible") {
    return;
  }
  
  // Section géolocalisation
  const geoSection = document.createElement('div');
  geoSection.className = 'dns-ip-resolver-section';
  
  const geoTitle = document.createElement('h4');
  geoTitle.className = 'dns-ip-resolver-section-title';
  geoTitle.textContent = 'Géolocalisation';
  
  const geoGrid = document.createElement('div');
  geoGrid.className = 'dns-ip-resolver-info-grid';
  
  addGridRow(geoGrid, 'IP:', escapeHtml(ipInfo.ip || ip));
  
  // Type d'IP
  if (ipInfo.ipType) {
    const typeSpan = document.createElement('span');
    typeSpan.style.cssText = 'background: ' + ipInfo.ipType.color + '; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;';
    typeSpan.textContent = escapeHtml(ipInfo.ipType.label);
    
    const typeValue = document.createElement('div');
    typeValue.className = 'dns-ip-resolver-value';
    typeValue.appendChild(typeSpan);
    
    geoGrid.appendChild(createGridLabel('Type d\'IP:'));
    geoGrid.appendChild(typeValue);
  }
  
  // Indicateurs
  if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
    const indicators = [];
    if (ipInfo.isMobile) indicators.push('📱 Mobile');
    if (ipInfo.isProxy) indicators.push('🔒 Proxy/VPN');
    if (ipInfo.isHosting) indicators.push('🖥️ Datacenter');
    
    addGridRow(geoGrid, 'Indicateurs:', indicators.join(', '));
  }
  
  // Localisation
  if (ipInfo.hostname) {
    addGridRow(geoGrid, 'Hostname:', escapeHtml(ipInfo.hostname));
  }
  
  const locationParts = [ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean);
  addGridRow(geoGrid, 'Localisation:', escapeHtml(locationParts.join(', ')));
  
  if (ipInfo.postal) {
    addGridRow(geoGrid, 'Code postal:', escapeHtml(ipInfo.postal));
  }
  
  if (ipInfo.loc && ipInfo.loc !== 'Non disponible') {
    addGridRow(geoGrid, 'Coordonnées:', escapeHtml(ipInfo.loc));
  }
  
  if (ipInfo.timezone && ipInfo.timezone !== 'Non disponible') {
    addGridRow(geoGrid, 'Fuseau horaire:', escapeHtml(ipInfo.timezone));
  }
  
  geoSection.appendChild(geoTitle);
  geoSection.appendChild(geoGrid);
  
  // Lien Google Maps
  if (ipInfo.loc && ipInfo.loc !== '0,0' && ipInfo.loc !== 'Non disponible') {
    const [lat, lon] = ipInfo.loc.split(',');
    const mapLink = document.createElement('a');
    mapLink.href = `https://maps.google.com/?q=${lat},${lon}`;
    mapLink.target = '_blank';
    mapLink.rel = 'noopener noreferrer';
    mapLink.className = 'dns-ip-resolver-map-link';
    mapLink.textContent = '📍 Voir sur Google Maps';
    geoSection.appendChild(mapLink);
  }
  
  container.appendChild(geoSection);
}

// Fonction utilitaire pour ajouter une ligne au grid
function addGridRow(grid, label, value) {
  const labelElement = createGridLabel(label);
  const valueElement = document.createElement('div');
  valueElement.className = 'dns-ip-resolver-value';
  valueElement.textContent = value;
  
  grid.appendChild(labelElement);
  grid.appendChild(valueElement);
}

// Fonction utilitaire pour créer un label
function createGridLabel(text) {
  const label = document.createElement('div');
  label.className = 'dns-ip-resolver-label';
  label.textContent = text;
  return label;
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

// Fonction pour échapper le HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.textContent;
}