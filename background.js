// Configuration
const CONFIG = {
  dnsTimeout: 5000,
  maxRetries: 2
};

// Expressions régulières
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const FQDN_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;
// Noms courts : lettres, chiffres, tirets, 1-63 caractères, ne commence/finit pas par un tiret
const SHORT_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-]{0,62}(?<!-)$/;

// Fonction pour vérifier si c'est un nom résolvable (FQDN ou nom court)
function isResolvableName(text) {
  return FQDN_REGEX.test(text) || SHORT_NAME_REGEX.test(text);
}

// Cache pour les résultats DNS
const dnsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

// Création des menus contextuels au démarrage
browser.runtime.onInstalled.addListener(() => {
  createContextMenus();
});

// Aussi créer les menus au démarrage normal
createContextMenus();

function createContextMenus() {
  // Supprimer les menus existants pour éviter les doublons
  browser.contextMenus.removeAll().then(() => {
    browser.contextMenus.create({
      id: "resolve-dns",
      title: "Résoudre le nom de domaine",
      contexts: ["selection"]
    });

    browser.contextMenus.create({
      id: "resolve-ip",
      title: "Résoudre l'adresse IP",
      contexts: ["selection"]
    });

    browser.contextMenus.create({
      id: "separator-1",
      type: "separator",
      contexts: ["selection"]
    });

    browser.contextMenus.create({
      id: "show-all-info",
      title: "Afficher toutes les informations",
      contexts: ["selection"]
    });
  }).catch(err => console.error("Erreur création menus:", err));
}

// Gestionnaire pour les messages du popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'resolveDNS') {
    resolveDNSFromPopup(message.domain)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Indique une réponse asynchrone
  }
  
  if (message.action === 'resolveIP') {
    resolveIPFromPopup(message.ip)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true;
  }
});

// Gestionnaire de clics sur le menu contextuel
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText ? info.selectionText.trim() : '';
  
  if (!selectedText) return;
  
  try {
    switch (info.menuItemId) {
      case "resolve-dns":
        if (isResolvableName(selectedText)) {
          await resolveDNSWithLocalServer(selectedText, tab.id);
        } else {
          showNotification("Erreur", "Le texte sélectionné n'est pas un nom de domaine valide");
        }
        break;
      case "resolve-ip":
        if (IP_REGEX.test(selectedText)) {
          await resolveIPWithLocalServer(selectedText, tab.id);
        } else {
          showNotification("Erreur", "Le texte sélectionné n'est pas une adresse IP valide");
        }
        break;
      case "show-all-info":
        await showAllInfo(selectedText, tab.id);
        break;
    }
  } catch (error) {
    console.error("Erreur:", error);
    showNotification("Erreur", `Impossible de résoudre: ${error.message}`);
  }
});

// Résolution DNS pour le popup
async function resolveDNSFromPopup(domain) {
  const startTime = Date.now();
  
  try {
    // Essayer l'API DNS de Firefox
    let resolvedData;
    let dnsServerUsed = dnsDetector.getCurrentDNSServer();
    
    try {
      resolvedData = await browser.dns.resolve(domain);
      
      // Détecter si DoH est utilisé
      const dohStatus = await dnsDetector.detectDoHStatus();
      if (dohStatus.dohEnabled) {
        dnsServerUsed = dohStatus.method;
      }
    } catch (e) {
      // Fallback vers DNS public
      resolvedData = await resolveViaDNSAPI(domain);
      dnsServerUsed = "Service DNS public (fallback)";
    }
    
    const resolutionTime = Date.now() - startTime;
    
    if (!resolvedData.addresses || resolvedData.addresses.length === 0) {
      throw new Error("Aucune adresse IP trouvée");
    }
    
    const firstIP = resolvedData.addresses[0];
    const ipInfo = await getIPInfo(firstIP);
    
    return {
      type: 'dns',
      domain: domain,
      addresses: resolvedData.addresses,
      canonicalName: resolvedData.canonicalName || domain,
      isTRR: resolvedData.isTRR || false,
      ipInfo: ipInfo,
      resolutionTime: resolutionTime,
      dnsServer: dnsServerUsed,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Échec de résolution DNS: ${error.message}`);
  }
}

// Résolution IP pour le popup
async function resolveIPFromPopup(ipAddress) {
  const startTime = Date.now();
  const isPrivate = isPrivateIP(ipAddress);
  
  let reverseDNS = "Non disponible";
  
  if (!isPrivate) {
    try {
      reverseDNS = await reverseLookupAlternative(ipAddress);
    } catch (e) {
      console.warn("Reverse DNS échoué:", e);
    }
  }
  
  const resolutionTime = Date.now() - startTime;
  const ipInfo = await getIPInfo(ipAddress);
  
  return {
    type: 'ip',
    ip: ipAddress,
    isPrivate: isPrivate,
    reverseDNS: reverseDNS,
    ipInfo: ipInfo,
    resolutionTime: resolutionTime,
    dnsServer: "DNS système",
    timestamp: new Date().toISOString()
  };
}

// Fonction principale pour résoudre un nom de domaine
async function resolveDNSWithLocalServer(domain, tabId) {
  try {
    const isShortName = !domain.includes('.');
    const nameType = isShortName ? 'Nom court (local)' : 'FQDN';
    
    showNotification("Résolution DNS", `Résolution de ${domain} (${nameType})...`);
    
    // Vérifier le cache
    const cacheKey = `dns:${domain}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      await sendResultsToTab(tabId, cached);
      return;
    }
    
    const startTime = Date.now();
    let resolvedData;
    let dnsServerUsed = dnsDetector.getCurrentDNSServer();
    
    // Méthode 1: API DNS de Firefox (obligatoire pour les noms courts)
    try {
      resolvedData = await browser.dns.resolve(domain);
      console.log("Résolution via API Firefox DNS:", resolvedData);
      
      // Détecter si DoH est utilisé
      const dohStatus = await dnsDetector.detectDoHStatus();
      if (dohStatus.dohEnabled) {
        dnsServerUsed = dohStatus.method;
      }
    } catch (firefoxDnsError) {
      console.warn("API Firefox DNS échouée:", firefoxDnsError);
      // Méthode 2: Utiliser un service DNS public (seulement pour FQDN)
      resolvedData = await resolveViaDNSAPI(domain);
      dnsServerUsed = "Service DNS public (fallback)";
    }
    
    const resolutionTime = Date.now() - startTime;
    
    if (!resolvedData.addresses || resolvedData.addresses.length === 0) {
      throw new Error("Aucune adresse IP trouvée");
    }
    
    const firstIP = resolvedData.addresses[0];
    const ipInfo = await getIPInfo(firstIP);
    
    const results = {
      type: 'dns',
      domain: domain,
      nameType: nameType,
      isShortName: isShortName,
      addresses: resolvedData.addresses,
      canonicalName: resolvedData.canonicalName || domain,
      isTRR: resolvedData.isTRR || false,
      ipInfo: ipInfo,
      resolutionTime: resolutionTime,
      dnsServer: dnsServerUsed,
      timestamp: new Date().toISOString()
    };
    
    saveToCache(cacheKey, results);
    await sendResultsToTab(tabId, results);
    
  } catch (error) {
    console.error("Échec de la résolution DNS:", error);
    showNotification("Erreur", error.message);
  }
}

// Fonction pour résoudre une IP
async function resolveIPWithLocalServer(ipAddress, tabId) {
  try {
    showNotification("Résolution IP", `Analyse de ${ipAddress}...`);
    
    const cacheKey = `reverse:${ipAddress}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      await sendResultsToTab(tabId, cached);
      return;
    }
    
    const isPrivate = isPrivateIP(ipAddress);
    const startTime = Date.now();
    let reverseDNS = "Non disponible";
    
    if (!isPrivate) {
      try {
        reverseDNS = await reverseLookupAlternative(ipAddress);
      } catch (error) {
        console.warn("Reverse DNS échoué:", error);
      }
    }
    
    const resolutionTime = Date.now() - startTime;
    const ipInfo = await getIPInfo(ipAddress);
    
    const results = {
      type: 'ip',
      ip: ipAddress,
      isPrivate: isPrivate,
      reverseDNS: reverseDNS,
      ipInfo: ipInfo,
      resolutionTime: resolutionTime,
      dnsServer: "DNS système",
      timestamp: new Date().toISOString()
    };
    
    saveToCache(cacheKey, results);
    await sendResultsToTab(tabId, results);
    
  } catch (error) {
    console.error("Échec de résolution IP:", error);
    showNotification("Erreur", error.message);
  }
}

// Afficher toutes les informations
async function showAllInfo(input, tabId) {
  if (IP_REGEX.test(input)) {
    await resolveIPWithLocalServer(input, tabId);
  } else if (isResolvableName(input)) {
    await resolveDNSWithLocalServer(input, tabId);
  } else {
    showNotification("Erreur", "Format non reconnu. Entrez un domaine, nom court ou une IP valide.");
  }
}

// Envoyer les résultats à l'onglet
async function sendResultsToTab(tabId, results) {
  try {
    await browser.tabs.sendMessage(tabId, {
      action: 'showResults',
      data: results
    });
  } catch (error) {
    console.error("Impossible d'envoyer les résultats:", error);
    // Essayer d'injecter le content script d'abord
    try {
      await browser.tabs.executeScript(tabId, { file: 'content.js' });
      await browser.tabs.sendMessage(tabId, {
        action: 'showResults',
        data: results
      });
    } catch (injectError) {
      console.error("Injection échouée:", injectError);
      showNotification("Résultat", `${results.domain || results.ip}: ${results.addresses ? results.addresses.join(', ') : 'Voir la console'}`);
    }
  }
}

// Résolution DNS via API publique (ne fonctionne pas pour les noms courts!)
async function resolveViaDNSAPI(domain) {
  // Vérifier si c'est un nom court (sans point)
  const isShortName = !domain.includes('.');
  
  if (isShortName) {
    throw new Error(`Le nom court "${domain}" ne peut être résolu que via le DNS local. Vérifiez que l'API DNS de Firefox est disponible.`);
  }
  
  const services = [
    { url: `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`, name: 'Cloudflare' },
    { url: `https://dns.google/resolve?name=${domain}&type=A`, name: 'Google' }
  ];
  
  for (const service of services) {
    try {
      const response = await fetch(service.url, {
        headers: { 'Accept': 'application/dns-json' }
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      
      if (data.Answer && data.Answer.length > 0) {
        const addresses = data.Answer
          .filter(a => a.type === 1)
          .map(a => a.data);
        
        return {
          addresses: addresses,
          canonicalName: domain,
          isTRR: true
        };
      }
    } catch (error) {
      console.warn(`Service ${service.name} échoué:`, error);
    }
  }
  
  throw new Error("Tous les services DNS ont échoué");
}

// Reverse DNS
async function reverseLookupAlternative(ipAddress) {
  const reverseIP = ipAddress.split('.').reverse().join('.');
  const response = await fetch(`https://dns.google/resolve?name=${reverseIP}.in-addr.arpa&type=PTR`);
  const data = await response.json();
  
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data.replace(/\.$/, '');
  }
  throw new Error("Reverse DNS non disponible");
}

// Obtenir les informations détaillées sur une IP
async function getIPInfo(ipAddress) {
  try {
    if (isPrivateIP(ipAddress)) {
      return {
        ip: ipAddress,
        city: "Réseau privé",
        region: "Réseau local",
        country: "Local",
        org: getPrivateNetworkInfo(ipAddress),
        loc: "Non disponible",
        timezone: "Non disponible",
        isPrivate: true
      };
    }
    
    // Pour les IPs publiques, récupérer des infos détaillées
    const token = await getIpInfoToken();
    
    // Requête principale ipinfo.io
    const ipinfoUrl = token 
      ? `https://ipinfo.io/${ipAddress}/json?token=${token}`
      : `https://ipinfo.io/${ipAddress}/json`;
    
    const response = await fetch(ipinfoUrl);
    
    if (!response.ok) {
      throw new Error(`API status ${response.status}`);
    }
    
    const data = await response.json();
    data.isPrivate = false;
    
    // Enrichir avec des informations supplémentaires
    const enrichedData = await enrichIPData(ipAddress, data);
    
    return enrichedData;
  } catch (error) {
    console.warn("Info IP non disponible:", error);
    
    // Essayer une source alternative
    try {
      const altData = await getIPInfoAlternative(ipAddress);
      return altData;
    } catch (altError) {
      return {
        ip: ipAddress,
        city: "Information non disponible",
        region: "Information non disponible",
        country: "Information non disponible",
        org: "Information non disponible",
        loc: "Non disponible",
        timezone: "Non disponible",
        isPrivate: isPrivateIP(ipAddress)
      };
    }
  }
}

// Enrichir les données IP avec des informations supplémentaires
async function enrichIPData(ipAddress, baseData) {
  const enriched = { ...baseData };
  
  // Extraire les informations de l'organisation
  if (enriched.org) {
    const orgParts = enriched.org.match(/^(AS\d+)\s+(.+)$/);
    if (orgParts) {
      enriched.asn = orgParts[1];
      enriched.orgName = orgParts[2];
    } else {
      enriched.orgName = enriched.org;
    }
  }
  
  // Récupérer les informations WHOIS/ASN détaillées
  try {
    const asnInfo = await getASNInfo(enriched.asn || ipAddress);
    if (asnInfo) {
      enriched.asnInfo = asnInfo;
    }
  } catch (e) {
    console.warn("ASN info non disponible:", e);
  }
  
  // Récupérer les informations de réputation/abuse
  try {
    const abuseInfo = await getAbuseInfo(ipAddress);
    if (abuseInfo) {
      enriched.abuse = abuseInfo;
    }
  } catch (e) {
    console.warn("Abuse info non disponible:", e);
  }
  
  // Déterminer le type d'IP
  enriched.ipType = determineIPType(enriched);
  
  // Ajouter les informations de plage
  enriched.ipRange = await getIPRange(ipAddress);
  
  return enriched;
}

// Récupérer les informations ASN détaillées
async function getASNInfo(asnOrIp) {
  try {
    // Utiliser l'API de bgpview.io pour les infos ASN
    let url;
    if (asnOrIp && asnOrIp.startsWith('AS')) {
      const asnNum = asnOrIp.replace('AS', '');
      url = `https://api.bgpview.io/asn/${asnNum}`;
    } else {
      url = `https://api.bgpview.io/ip/${asnOrIp}`;
    }
    
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const result = await response.json();
    
    if (result.status === 'ok' && result.data) {
      const data = result.data;
      
      // Si c'est une requête IP, extraire les infos de préfixe
      if (data.prefixes && data.prefixes.length > 0) {
        const prefix = data.prefixes[0];
        return {
          asn: prefix.asn?.asn ? `AS${prefix.asn.asn}` : null,
          name: prefix.asn?.name || prefix.name,
          description: prefix.asn?.description,
          country: prefix.asn?.country_code,
          prefix: prefix.prefix,
          cidr: prefix.cidr,
          rirAllocation: prefix.rir_allocation || null,
          dateAllocated: prefix.rir_allocation?.date_allocated || null
        };
      }
      
      // Si c'est une requête ASN directe
      return {
        asn: data.asn ? `AS${data.asn}` : null,
        name: data.name,
        description: data.description_short || data.description_full,
        country: data.country_code,
        website: data.website,
        emailContacts: data.email_contacts,
        abuseContacts: data.abuse_contacts,
        ownerAddress: data.owner_address,
        dateAllocated: data.rir_allocation?.date_allocated || null,
        rirName: data.rir_allocation?.rir_name || null
      };
    }
    
    return null;
  } catch (error) {
    console.warn("Erreur ASN lookup:", error);
    return null;
  }
}

// Récupérer les informations d'abuse
async function getAbuseInfo(ipAddress) {
  try {
    const token = await getIpInfoToken();
    if (!token) return null;
    
    // ipinfo.io fournit les infos d'abuse avec un token
    const response = await fetch(`https://ipinfo.io/${ipAddress}/json?token=${token}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    
    if (data.abuse) {
      return {
        address: data.abuse.address,
        country: data.abuse.country,
        email: data.abuse.email,
        name: data.abuse.name,
        network: data.abuse.network,
        phone: data.abuse.phone
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Déterminer le type d'IP (datacenter, résidentiel, mobile, etc.)
function determineIPType(data) {
  const org = (data.org || data.orgName || '').toLowerCase();
  const hostname = (data.hostname || '').toLowerCase();
  
  // Détection des datacenters/cloud
  const cloudProviders = [
    'amazon', 'aws', 'google', 'microsoft', 'azure', 'digitalocean', 
    'linode', 'vultr', 'ovh', 'hetzner', 'cloudflare', 'akamai',
    'fastly', 'oracle', 'ibm', 'alibaba', 'tencent', 'scaleway'
  ];
  
  if (cloudProviders.some(p => org.includes(p))) {
    return { type: 'cloud', label: 'Cloud/Datacenter', color: '#9b59b6' };
  }
  
  // Détection des hébergeurs
  const hostingKeywords = ['hosting', 'server', 'dedicated', 'vps', 'datacenter', 'colo'];
  if (hostingKeywords.some(k => org.includes(k))) {
    return { type: 'hosting', label: 'Hébergement', color: '#e67e22' };
  }
  
  // Détection mobile
  const mobileKeywords = ['mobile', 'wireless', 'cellular', '3g', '4g', '5g', 'lte'];
  if (mobileKeywords.some(k => org.includes(k) || hostname.includes(k))) {
    return { type: 'mobile', label: 'Mobile/Cellulaire', color: '#3498db' };
  }
  
  // Détection VPN/Proxy
  const vpnKeywords = ['vpn', 'proxy', 'tunnel', 'anonymo', 'private'];
  if (vpnKeywords.some(k => org.includes(k) || hostname.includes(k))) {
    return { type: 'vpn', label: 'VPN/Proxy', color: '#e74c3c' };
  }
  
  // Détection FAI résidentiel
  const ispKeywords = ['telecom', 'broadband', 'cable', 'dsl', 'fiber', 'isp', 
    'orange', 'free', 'sfr', 'bouygues', 'comcast', 'verizon', 'at&t'];
  if (ispKeywords.some(k => org.includes(k))) {
    return { type: 'residential', label: 'Résidentiel/FAI', color: '#27ae60' };
  }
  
  // Détection éducation/gouvernement
  if (org.includes('university') || org.includes('education') || org.includes('gouv') || 
      org.includes('.edu') || org.includes('.gov')) {
    return { type: 'institution', label: 'Institution', color: '#2c3e50' };
  }
  
  return { type: 'unknown', label: 'Standard', color: '#95a5a6' };
}

// Récupérer la plage IP
async function getIPRange(ipAddress) {
  try {
    const response = await fetch(`https://api.bgpview.io/ip/${ipAddress}`);
    if (!response.ok) return null;
    
    const result = await response.json();
    
    if (result.status === 'ok' && result.data && result.data.prefixes) {
      const prefix = result.data.prefixes[0];
      if (prefix) {
        return {
          prefix: prefix.prefix,
          cidr: prefix.cidr,
          name: prefix.name,
          description: prefix.description
        };
      }
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

// Source alternative pour les infos IP
async function getIPInfoAlternative(ipAddress) {
  try {
    // Utiliser ip-api.com comme fallback (gratuit, pas de token)
    const response = await fetch(`http://ip-api.com/json/${ipAddress}?fields=status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,reverse,mobile,proxy,hosting,query`);
    
    if (!response.ok) throw new Error('API error');
    
    const data = await response.json();
    
    if (data.status === 'success') {
      return {
        ip: data.query,
        city: data.city,
        region: data.regionName,
        country: data.countryCode,
        countryName: data.country,
        loc: `${data.lat},${data.lon}`,
        timezone: data.timezone,
        postal: data.zip,
        org: data.org,
        orgName: data.org,
        asn: data.as ? data.as.split(' ')[0] : null,
        isp: data.isp,
        hostname: data.reverse,
        isPrivate: false,
        isMobile: data.mobile,
        isProxy: data.proxy,
        isHosting: data.hosting,
        ipType: data.hosting ? 
          { type: 'hosting', label: 'Hébergement/Datacenter', color: '#e67e22' } :
          data.mobile ? 
            { type: 'mobile', label: 'Mobile', color: '#3498db' } :
            data.proxy ?
              { type: 'proxy', label: 'Proxy/VPN', color: '#e74c3c' } :
              { type: 'residential', label: 'Résidentiel', color: '#27ae60' }
      };
    }
    
    throw new Error('API returned error');
  } catch (error) {
    throw error;
  }
}

// Informations sur les réseaux privés
function getPrivateNetworkInfo(ipAddress) {
  const parts = ipAddress.split('.').map(Number);
  
  if (parts[0] === 10) return "Réseau privé Classe A (10.0.0.0/8)";
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return "Réseau privé Classe B (172.16.0.0/12)";
  if (parts[0] === 192 && parts[1] === 168) return "Réseau privé Classe C (192.168.0.0/16)";
  if (parts[0] === 127) return "Localhost (127.0.0.0/8)";
  if (parts[0] === 169 && parts[1] === 254) return "Link-local (169.254.0.0/16)";
  
  return "Réseau privé";
}

// Vérifier si une IP est privée
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  
  if (parts[0] === 10) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  
  return false;
}

// Gestion du cache
function saveToCache(key, data) {
  dnsCache.set(key, {
    data: data,
    timestamp: Date.now()
  });
}

function getFromCache(key) {
  const cached = dnsCache.get(key);
  if (!cached) return null;
  
  if (Date.now() - cached.timestamp > CACHE_DURATION) {
    dnsCache.delete(key);
    return null;
  }
  
  return cached.data;
}

// Obtenir le token ipinfo.io
async function getIpInfoToken() {
  try {
    const result = await browser.storage.local.get('ipinfoToken');
    return result.ipinfoToken || '';
  } catch (e) {
    return '';
  }
}

// Afficher une notification
function showNotification(title, message) {
  browser.storage.local.get('showNotifications').then(settings => {
    if (settings.showNotifications !== false) {
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: title,
        message: message
      }).catch(err => console.warn("Notification échouée:", err));
    }
  }).catch(() => {
    // Ignorer les erreurs de notification
  });
}

console.log("DNS & IP Resolver initialisé");
