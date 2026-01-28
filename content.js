// Injection du CSS pour les résultats
const style = document.createElement('style');
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
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    overflow: hidden;
    animation: slideIn 0.3s ease-out;
  }
  
  @keyframes slideIn {
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
  
  .dns-ip-resolver-content {
    padding: 20px;
    max-height: calc(80vh - 60px);
    overflow-y: auto;
  }
  
  .dns-ip-resolver-section {
    margin-bottom: 20px;
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

// Écoute des messages du background script
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'showResults') {
    showResults(message.data);
  }
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
  
  let content = '';
  
  if (data.type === 'dns') {
    content = createDNSResults(data);
  } else if (data.type === 'ip') {
    content = createIPResults(data);
  }
  
  overlay.innerHTML = `
    <div class="dns-ip-resolver-header">
      <h3 class="dns-ip-resolver-title">
        ${data.type === 'dns' ? 'Résolution DNS' : 'Résolution IP'}
      </h3>
      <button class="dns-ip-resolver-close" aria-label="Fermer">&times;</button>
    </div>
    <div class="dns-ip-resolver-content">
      ${content}
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Gestionnaire pour fermer l'overlay
  overlay.querySelector('.dns-ip-resolver-close').addEventListener('click', () => {
    overlay.remove();
  });
  
  // Fermer l'overlay en cliquant à l'extérieur
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
  
  // Fermer avec la touche Échap
  document.addEventListener('keydown', function closeOnEscape(e) {
    if (e.key === 'Escape') {
      overlay.remove();
      document.removeEventListener('keydown', closeOnEscape);
    }
  });
}

// Fonction pour créer le contenu des résultats DNS
function createDNSResults(data) {
  const isPrivate = data.addresses.some(ip => isPrivateIP(ip));

  return `
  <div class="dns-ip-resolver-section">
  <h4 class="dns-ip-resolver-section-title">Informations du domaine</h4>
  <div class="dns-ip-resolver-info-grid">
  <div class="dns-ip-resolver-label">Domaine:</div>
  <div class="dns-ip-resolver-value">${data.domain}</div>

  <div class="dns-ip-resolver-label">Nom canonique:</div>
  <div class="dns-ip-resolver-value">${data.canonicalName || data.domain}</div>

  <div class="dns-ip-resolver-label">Serveur DNS:</div>
  <div class="dns-ip-resolver-value">${data.dnsServer || 'Non spécifié'}</div>

  <div class="dns-ip-resolver-label">Temps de résolution:</div>
  <div class="dns-ip-resolver-value">${data.resolutionTime || 'N/A'} ms</div>

  <div class="dns-ip-resolver-label">Méthode:</div>
  <div class="dns-ip-resolver-value">${data.isTRR ? 'DNS over HTTPS' : 'DNS système'}</div>
  </div>
  </div>

  <div class="dns-ip-resolver-section">
  <h4 class="dns-ip-resolver-section-title">Adresses IP</h4>
  <div class="dns-ip-resolver-ip-list">
  ${data.addresses.map(ip => `
    <span class="dns-ip-resolver-ip-chip ${isPrivateIP(ip) ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}">
    ${ip}
    </span>
    `).join('')}
    </div>
    <div class="dns-ip-resolver-info-grid" style="margin-top: 15px;">
    <div class="dns-ip-resolver-label">Type:</div>
    <div class="dns-ip-resolver-value">
    ${isPrivate ? 'Réseau privé' : 'Réseau public'}
    </div>
    </div>
    </div>

    ${data.ipInfo ? createIPInfoSection(data.ipInfo, data.addresses[0]) : ''}

    ${data.timestamp ? `
      <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Informations techniques</h4>
      <div class="dns-ip-resolver-info-grid">
      <div class="dns-ip-resolver-label">Horodatage:</div>
      <div class="dns-ip-resolver-value">${new Date(data.timestamp).toLocaleString('fr-FR')}</div>

      ${data.source ? `
        <div class="dns-ip-resolver-label">Source:</div>
        <div class="dns-ip-resolver-value">${data.source}</div>
        ` : ''}
        </div>
        </div>
        ` : ''}
        `;
}

// Fonction pour créer le contenu des résultats IP
function createIPResults(data) {
  return `
  <div class="dns-ip-resolver-section">
  <h4 class="dns-ip-resolver-section-title">Informations de l'adresse IP</h4>
  <div class="dns-ip-resolver-info-grid">
  <div class="dns-ip-resolver-label">Adresse IP:</div>
  <div class="dns-ip-resolver-value">${data.ip}</div>

  <div class="dns-ip-resolver-label">Type:</div>
  <div class="dns-ip-resolver-value">
  <span class="dns-ip-resolver-ip-chip ${data.isPrivate ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}">
  ${data.isPrivate ? 'IP privée' : 'IP publique'}
  </span>
  </div>

  <div class="dns-ip-resolver-label">Serveur DNS:</div>
  <div class="dns-ip-resolver-value">${data.dnsServer || 'Non spécifié'}</div>

  <div class="dns-ip-resolver-label">Temps de résolution:</div>
  <div class="dns-ip-resolver-value">${data.resolutionTime || 'N/A'} ms</div>

  ${data.reverseDNS ? `
    <div class="dns-ip-resolver-label">Nom inverse:</div>
    <div class="dns-ip-resolver-value">${data.reverseDNS}</div>
    ` : ''}
    </div>
    </div>

    ${data.ipInfo ? createIPInfoSection(data.ipInfo, data.ip) : ''}

    ${data.timestamp ? `
      <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Informations techniques</h4>
      <div class="dns-ip-resolver-info-grid">
      <div class="dns-ip-resolver-label">Horodatage:</div>
      <div class="dns-ip-resolver-value">${new Date(data.timestamp).toLocaleString('fr-FR')}</div>
      </div>
      </div>
      ` : ''}
      `;
}
// Fonction pour créer la section des informations IP
function createIPInfoSection(ipInfo, ip) {
  if (!ipInfo || ipInfo.city === "Information non disponible") {
    return '';
  }
  
  let mapLink = '';
  if (ipInfo.loc && ipInfo.loc !== '0,0' && ipInfo.loc !== 'Non disponible') {
    const [lat, lon] = ipInfo.loc.split(',');
    mapLink = `
      <a href="https://maps.google.com/?q=${lat},${lon}" 
         target="_blank" 
         class="dns-ip-resolver-map-link">
        📍 Voir sur Google Maps
      </a>
    `;
  }
  
  return `
    <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Géolocalisation</h4>
      <div class="dns-ip-resolver-info-grid">
        <div class="dns-ip-resolver-label">IP:</div>
        <div class="dns-ip-resolver-value">${ipInfo.ip || ip}</div>
        
        <div class="dns-ip-resolver-label">Localisation:</div>
        <div class="dns-ip-resolver-value">
          ${[ipInfo.city, ipInfo.region, ipInfo.country].filter(Boolean).join(', ')}
        </div>
        
        <div class="dns-ip-resolver-label">Organisation:</div>
        <div class="dns-ip-resolver-value">${ipInfo.org || 'Inconnue'}</div>
        
        ${ipInfo.loc && ipInfo.loc !== 'Non disponible' ? `
          <div class="dns-ip-resolver-label">Coordonnées:</div>
          <div class="dns-ip-resolver-value">${ipInfo.loc}</div>
        ` : ''}
        
        ${ipInfo.timezone && ipInfo.timezone !== 'Non disponible' ? `
          <div class="dns-ip-resolver-label">Fuseau horaire:</div>
          <div class="dns-ip-resolver-value">${ipInfo.timezone}</div>
        ` : ''}
      </div>
      ${mapLink}
    </div>
  `;
}

// Fonction pour vérifier si une IP est privée
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  
  return false;
}
