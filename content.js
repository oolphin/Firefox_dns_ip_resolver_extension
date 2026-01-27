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
  const closeBtn = overlay.querySelector('.dns-ip-resolver-close');
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
function createDNSResults(data) {
  const hasPrivate = data.addresses && data.addresses.some(ip => isPrivateIP(ip));
  const nameTypeLabel = data.isShortName ? 
    '<span style="color: #e67e22; font-weight: bold;">Nom court</span>' : 
    '<span style="color: #27ae60;">FQDN</span>';

  return `
    <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Informations du domaine</h4>
      <div class="dns-ip-resolver-info-grid">
        <div class="dns-ip-resolver-label">Domaine:</div>
        <div class="dns-ip-resolver-value">${escapeHtml(data.domain)}</div>

        <div class="dns-ip-resolver-label">Type de nom:</div>
        <div class="dns-ip-resolver-value">${nameTypeLabel}</div>

        <div class="dns-ip-resolver-label">Nom canonique:</div>
        <div class="dns-ip-resolver-value">${escapeHtml(data.canonicalName || data.domain)}</div>

        <div class="dns-ip-resolver-label">Serveur DNS:</div>
        <div class="dns-ip-resolver-value">${escapeHtml(data.dnsServer || 'Non spécifié')}</div>

        <div class="dns-ip-resolver-label">Temps:</div>
        <div class="dns-ip-resolver-value">${data.resolutionTime || 'N/A'} ms</div>

        <div class="dns-ip-resolver-label">Méthode:</div>
        <div class="dns-ip-resolver-value">${data.isTRR ? 'DNS over HTTPS' : 'DNS système'}</div>
      </div>
    </div>

    <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Adresses IP</h4>
      <div class="dns-ip-resolver-ip-list">
        ${(data.addresses || []).map(ip => `
          <span class="dns-ip-resolver-ip-chip ${isPrivateIP(ip) ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}">
            ${escapeHtml(ip)}
          </span>
        `).join('')}
      </div>
      <div class="dns-ip-resolver-info-grid" style="margin-top: 15px;">
        <div class="dns-ip-resolver-label">Type:</div>
        <div class="dns-ip-resolver-value">
          ${hasPrivate ? 'Réseau privé' : 'Réseau public'}
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
            <div class="dns-ip-resolver-value">${escapeHtml(data.source)}</div>
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
        <div class="dns-ip-resolver-value">${escapeHtml(data.ip)}</div>

        <div class="dns-ip-resolver-label">Type:</div>
        <div class="dns-ip-resolver-value">
          <span class="dns-ip-resolver-ip-chip ${data.isPrivate ? 'dns-ip-resolver-private' : 'dns-ip-resolver-public'}">
            ${data.isPrivate ? 'IP privée' : 'IP publique'}
          </span>
        </div>

        <div class="dns-ip-resolver-label">Serveur DNS:</div>
        <div class="dns-ip-resolver-value">${escapeHtml(data.dnsServer || 'Non spécifié')}</div>

        <div class="dns-ip-resolver-label">Temps:</div>
        <div class="dns-ip-resolver-value">${data.resolutionTime || 'N/A'} ms</div>

        ${data.reverseDNS && data.reverseDNS !== 'Non disponible' ? `
          <div class="dns-ip-resolver-label">Nom inverse:</div>
          <div class="dns-ip-resolver-value">${escapeHtml(data.reverseDNS)}</div>
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
         rel="noopener noreferrer"
         class="dns-ip-resolver-map-link">
        📍 Voir sur Google Maps
      </a>
    `;
  }
  
  // Section type d'IP
  let ipTypeHtml = '';
  if (ipInfo.ipType) {
    ipTypeHtml = `
      <div class="dns-ip-resolver-label">Type d'IP:</div>
      <div class="dns-ip-resolver-value">
        <span style="background: ${ipInfo.ipType.color}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
          ${escapeHtml(ipInfo.ipType.label)}
        </span>
      </div>
    `;
  }
  
  // Section ASN détaillée
  let asnHtml = '';
  if (ipInfo.asn || ipInfo.asnInfo) {
    const asnData = ipInfo.asnInfo || {};
    asnHtml = `
      <div class="dns-ip-resolver-section">
        <h4 class="dns-ip-resolver-section-title">Informations ASN / Propriétaire</h4>
        <div class="dns-ip-resolver-info-grid">
          ${ipInfo.asn ? `
            <div class="dns-ip-resolver-label">ASN:</div>
            <div class="dns-ip-resolver-value">
              <a href="https://bgpview.io/asn/${ipInfo.asn.replace('AS', '')}" target="_blank" rel="noopener" style="color: #3498db;">
                ${escapeHtml(ipInfo.asn)}
              </a>
            </div>
          ` : ''}
          
          ${ipInfo.orgName || asnData.name ? `
            <div class="dns-ip-resolver-label">Organisation:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.orgName || asnData.name)}</div>
          ` : ''}
          
          ${asnData.description ? `
            <div class="dns-ip-resolver-label">Description:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(asnData.description)}</div>
          ` : ''}
          
          ${ipInfo.isp && ipInfo.isp !== ipInfo.orgName ? `
            <div class="dns-ip-resolver-label">FAI:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.isp)}</div>
          ` : ''}
          
          ${asnData.country || ipInfo.country ? `
            <div class="dns-ip-resolver-label">Pays (ASN):</div>
            <div class="dns-ip-resolver-value">${escapeHtml(asnData.country || ipInfo.country)}</div>
          ` : ''}
          
          ${asnData.rirName ? `
            <div class="dns-ip-resolver-label">RIR:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(asnData.rirName)}</div>
          ` : ''}
          
          ${asnData.dateAllocated ? `
            <div class="dns-ip-resolver-label">Date allocation:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(asnData.dateAllocated)} ${calculateAge(asnData.dateAllocated)}</div>
          ` : ''}
          
          ${asnData.website ? `
            <div class="dns-ip-resolver-label">Site web:</div>
            <div class="dns-ip-resolver-value">
              <a href="${escapeHtml(asnData.website)}" target="_blank" rel="noopener" style="color: #3498db;">
                ${escapeHtml(asnData.website)}
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Section plage IP
  let ipRangeHtml = '';
  if (ipInfo.ipRange) {
    ipRangeHtml = `
      <div class="dns-ip-resolver-section">
        <h4 class="dns-ip-resolver-section-title">Plage IP / Préfixe</h4>
        <div class="dns-ip-resolver-info-grid">
          <div class="dns-ip-resolver-label">Préfixe:</div>
          <div class="dns-ip-resolver-value">
            <code style="background: #ecf0f1; padding: 2px 6px; border-radius: 3px;">${escapeHtml(ipInfo.ipRange.prefix)}</code>
          </div>
          
          ${ipInfo.ipRange.name ? `
            <div class="dns-ip-resolver-label">Nom:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.ipRange.name)}</div>
          ` : ''}
          
          ${ipInfo.ipRange.description ? `
            <div class="dns-ip-resolver-label">Description:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.ipRange.description)}</div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Section contact abuse
  let abuseHtml = '';
  if (ipInfo.abuse) {
    abuseHtml = `
      <div class="dns-ip-resolver-section">
        <h4 class="dns-ip-resolver-section-title">Contact Abuse</h4>
        <div class="dns-ip-resolver-info-grid">
          ${ipInfo.abuse.name ? `
            <div class="dns-ip-resolver-label">Nom:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.abuse.name)}</div>
          ` : ''}
          
          ${ipInfo.abuse.email ? `
            <div class="dns-ip-resolver-label">Email:</div>
            <div class="dns-ip-resolver-value">
              <a href="mailto:${escapeHtml(ipInfo.abuse.email)}" style="color: #3498db;">
                ${escapeHtml(ipInfo.abuse.email)}
              </a>
            </div>
          ` : ''}
          
          ${ipInfo.abuse.phone ? `
            <div class="dns-ip-resolver-label">Téléphone:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.abuse.phone)}</div>
          ` : ''}
          
          ${ipInfo.abuse.network ? `
            <div class="dns-ip-resolver-label">Réseau:</div>
            <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.abuse.network)}</div>
          ` : ''}
        </div>
      </div>
    `;
  }
  
  // Indicateurs spéciaux
  let indicatorsHtml = '';
  if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
    const indicators = [];
    if (ipInfo.isMobile) indicators.push('<span style="background: #3498db; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">📱 Mobile</span>');
    if (ipInfo.isProxy) indicators.push('<span style="background: #e74c3c; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🔒 Proxy/VPN</span>');
    if (ipInfo.isHosting) indicators.push('<span style="background: #9b59b6; color: white; padding: 2px 6px; border-radius: 4px; font-size: 11px; margin-right: 4px;">🖥️ Datacenter</span>');
    
    indicatorsHtml = `
      <div class="dns-ip-resolver-label">Indicateurs:</div>
      <div class="dns-ip-resolver-value">${indicators.join(' ')}</div>
    `;
  }
  
  return `
    <div class="dns-ip-resolver-section">
      <h4 class="dns-ip-resolver-section-title">Géolocalisation</h4>
      <div class="dns-ip-resolver-info-grid">
        <div class="dns-ip-resolver-label">IP:</div>
        <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.ip || ip)}</div>
        
        ${ipTypeHtml}
        
        ${indicatorsHtml}
        
        ${ipInfo.hostname ? `
          <div class="dns-ip-resolver-label">Hostname:</div>
          <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.hostname)}</div>
        ` : ''}
        
        <div class="dns-ip-resolver-label">Localisation:</div>
        <div class="dns-ip-resolver-value">
          ${escapeHtml([ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean).join(', '))}
        </div>
        
        ${ipInfo.postal ? `
          <div class="dns-ip-resolver-label">Code postal:</div>
          <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.postal)}</div>
        ` : ''}
        
        ${ipInfo.loc && ipInfo.loc !== 'Non disponible' ? `
          <div class="dns-ip-resolver-label">Coordonnées:</div>
          <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.loc)}</div>
        ` : ''}
        
        ${ipInfo.timezone && ipInfo.timezone !== 'Non disponible' ? `
          <div class="dns-ip-resolver-label">Fuseau horaire:</div>
          <div class="dns-ip-resolver-value">${escapeHtml(ipInfo.timezone)}</div>
        ` : ''}
      </div>
      ${mapLink}
    </div>
    
    ${asnHtml}
    ${ipRangeHtml}
    ${abuseHtml}
  `;
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
      return `<span style="color: #7f8c8d; font-size: 12px;">(${diffYears} an${diffYears > 1 ? 's' : ''}${diffMonths > 0 ? `, ${diffMonths} mois` : ''})</span>`;
    } else if (diffMonths > 0) {
      return `<span style="color: #7f8c8d; font-size: 12px;">(${diffMonths} mois)</span>`;
    } else {
      return `<span style="color: #7f8c8d; font-size: 12px;">(${diffDays} jours)</span>`;
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

// Fonction pour échapper le HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
