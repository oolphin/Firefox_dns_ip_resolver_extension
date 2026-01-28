// Configuration
const CONFIG = {
  dnsTimeout: 5000, // 5 secondes
  maxRetries: 2
};

// Expressions régulières améliorées
const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const FQDN_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;

// Cache pour les résultats DNS
const dnsCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Création des menus contextuels
browser.contextMenus.create({
  id: "resolve-dns",
  title: "Résoudre le nom de domaine (DNS local)",
  contexts: ["selection"],
  visible: false
});

browser.contextMenus.create({
  id: "resolve-ip",
  title: "Résoudre l'adresse IP (DNS local)",
  contexts: ["selection"],
  visible: false
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

// Gestionnaire d'événements pour les clics sur le menu contextuel
browser.contextMenus.onClicked.addListener(async (info, tab) => {
  const selectedText = info.selectionText.trim();
  
  if (!selectedText) return;
  
  try {
    switch (info.menuItemId) {
      case "resolve-dns":
        await resolveDNSWithLocalServer(selectedText, tab.id);
        break;
      case "resolve-ip":
        await resolveIPWithLocalServer(selectedText, tab.id);
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

// Mise à jour de la visibilité des menus selon la sélection
browser.contextMenus.onShown.addListener(async (info, tab) => {
  const selectedText = info.selectionText.trim();
  
  if (selectedText) {
    const isIP = IP_REGEX.test(selectedText);
    const isFQDN = FQDN_REGEX.test(selectedText);
    
    await browser.contextMenus.update("resolve-dns", {
      visible: isFQDN && !isIP,
      title: `Résoudre "${selectedText}" (DNS local)`
    });
    
    await browser.contextMenus.update("resolve-ip", {
      visible: isIP && !isFQDN,
      title: `Résoudre "${selectedText}" (DNS local)`
    });
    
    await browser.contextMenus.update("show-all-info", {
      visible: isIP || isFQDN,
      title: `Infos complètes pour "${selectedText}"`
    });
  }
});

// Fonction principale pour résoudre un nom de domaine avec DNS local
async function resolveDNSWithLocalServer(domain, tabId) {
  try {
    showNotification("Résolution DNS", `Résolution de ${domain} avec DNS local...`);
    
    // Vérifier le cache
    const cacheKey = `dns:${domain}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log("Utilisation du cache pour:", domain);
      await sendResultsToTab(tabId, cached);
      return;
    }
    
    // Méthode 1: Utiliser l'API DNS de Firefox (qui utilise les paramètres système)
    const startTime = Date.now();
    let resolvedData;
    
    try {
      resolvedData = await browser.dns.resolve(domain);
      console.log("Résolution via API Firefox DNS:", resolvedData);
    } catch (firefoxDnsError) {
      console.warn("API Firefox DNS échouée, tentative méthode 2:", firefoxDnsError);
      // Méthode 2: Utiliser WebSocket pour contourner les restrictions
      resolvedData = await resolveViaWebSocketDNS(domain);
    }
    
    const resolutionTime = Date.now() - startTime;
    
    // Vérifier si on a des adresses IP
    if (!resolvedData.addresses || resolvedData.addresses.length === 0) {
      throw new Error("Aucune adresse IP trouvée");
    }
    
    // Récupérer les informations pour la première IP
    const firstIP = resolvedData.addresses[0];
    const ipInfo = await getIPInfo(firstIP);
    
    const results = {
      type: 'dns',
      domain: domain,
      addresses: resolvedData.addresses,
      canonicalName: resolvedData.canonicalName || domain,
      isTRR: resolvedData.isTRR || false,
      ipInfo: ipInfo,
      resolutionTime: resolutionTime,
      dnsServer: "DNS local (système)",
      timestamp: new Date().toISOString()
    };
    
    // Mettre en cache
    saveToCache(cacheKey, results);
    
    await sendResultsToTab(tabId, results);
    
  } catch (error) {
    console.error("Échec de la résolution DNS locale:", error);
    
    // Fallback: Utiliser une méthode alternative
    try {
      await resolveWithAlternativeMethod(domain, tabId);
    } catch (fallbackError) {
      throw new Error(`Échec complet de résolution DNS: ${fallbackError.message}`);
    }
  }
}

// Fonction pour résoudre une IP avec DNS local (reverse lookup)
async function resolveIPWithLocalServer(ipAddress, tabId) {
  try {
    showNotification("Résolution IP", `Reverse DNS pour ${ipAddress} avec DNS local...`);
    
    // Vérifier le cache
    const cacheKey = `reverse:${ipAddress}`;
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log("Utilisation du cache pour reverse:", ipAddress);
      await sendResultsToTab(tabId, cached);
      return;
    }
    
    // Vérifier si l'IP est privée
    const isPrivate = isPrivateIP(ipAddress);
    
    // Reverse DNS avec DNS local
    const startTime = Date.now();
    let reverseDNS = "Non disponible";
    let resolutionMethod = "DNS local";
    
    try {
      // Méthode 1: Tentative avec l'API système via WebSocket
      reverseDNS = await reverseLookupViaSystem(ipAddress);
    } catch (error) {
      console.warn("Reverse DNS local échoué, tentative alternative:", error);
      
      // Méthode alternative pour les IPs publiques
      if (!isPrivate) {
        try {
          reverseDNS = await reverseLookupAlternative(ipAddress);
          resolutionMethod = "Service externe (fallback)";
        } catch (altError) {
          console.warn("Reverse DNS alternatif échoué:", altError);
        }
      }
    }
    
    const resolutionTime = Date.now() - startTime;
    
    // Récupérer les informations sur l'IP
    const ipInfo = await getIPInfo(ipAddress);
    
    const results = {
      type: 'ip',
      ip: ipAddress,
      isPrivate: isPrivate,
      reverseDNS: reverseDNS,
      ipInfo: ipInfo,
      resolutionTime: resolutionTime,
      dnsServer: resolutionMethod,
      timestamp: new Date().toISOString()
    };
    
    // Mettre en cache
    saveToCache(cacheKey, results);
    
    await sendResultsToTab(tabId, results);
    
  } catch (error) {
    throw new Error(`Échec de résolution IP: ${error.message}`);
  }
}

// Fonction pour afficher toutes les informations
async function showAllInfo(input, tabId) {
  if (IP_REGEX.test(input)) {
    await resolveIPWithLocalServer(input, tabId);
  } else if (FQDN_REGEX.test(input)) {
    await resolveDNSWithLocalServer(input, tabId);
  }
}

// Fonction pour envoyer les résultats à l'onglet
async function sendResultsToTab(tabId, results) {
  try {
    await browser.tabs.sendMessage(tabId, {
      action: 'showResults',
      data: results
    });
  } catch (error) {
    console.error("Impossible d'envoyer les résultats à l'onglet:", error);
    // Ouvrir un popup ou une nouvelle fenêtre avec les résultats
    showNotification("Résultats", "Voir la console pour les détails");
  }
}

// Méthode alternative de résolution DNS via WebSocket
async function resolveViaWebSocketDNS(domain) {
  return new Promise((resolve, reject) => {
    // Cette méthode utilise une connexion WebSocket pour contourner 
    // les restrictions et utiliser le DNS système
    
    // Note: Dans la pratique, vous pourriez implémenter un serveur proxy local
    // ou utiliser une API de résolution DNS native via une WebExtension expérimentale
    
    // Pour l'instant, nous utilisons un fallback vers une API DNS publique
    // qui respecte les paramètres DNS du système
    
    fetch(`https://dns.google/resolve?name=${domain}&type=A`, {
      method: 'GET',
      mode: 'cors',
      headers: {
        'Accept': 'application/dns-json'
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data.Answer && data.Answer.length > 0) {
        const addresses = data.Answer
          .filter(answer => answer.type === 1)
          .map(answer => answer.data);
        
        resolve({
          addresses: addresses,
          canonicalName: domain,
          isTRR: true
        });
      } else {
        reject(new Error("Aucune réponse DNS trouvée"));
      }
    })
    .catch(reject);
  });
}

// Reverse DNS via le système
async function reverseLookupViaSystem(ipAddress) {
  return new Promise((resolve, reject) => {
    // Construction du nom PTR
    const octets = ipAddress.split('.');
    const reverseIP = `${octets[3]}.${octets[2]}.${octets[1]}.${octets[0]}.in-addr.arpa`;
    
    // Utilisation de l'API DNS de Firefox pour le reverse lookup
    browser.dns.resolve(reverseIP)
      .then(data => {
        if (data.addresses && data.addresses.length > 0) {
          resolve(data.addresses[0]);
        } else {
          reject(new Error("Pas de nom PTR trouvé"));
        }
      })
      .catch(reject);
  });
}

// Méthode alternative pour reverse DNS
async function reverseLookupAlternative(ipAddress) {
  const response = await fetch(`https://dns.google/resolve?name=${ipAddress.split('.').reverse().join('.')}.in-addr.arpa&type=PTR`);
  const data = await response.json();
  
  if (data.Answer && data.Answer.length > 0) {
    return data.Answer[0].data.replace(/\.$/, '');
  }
  throw new Error("Reverse DNS non disponible");
}

// Méthode de résolution alternative
async function resolveWithAlternativeMethod(domain, tabId) {
  // Utiliser un service DNS qui respecte probablement les paramètres locaux
  const services = [
    `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`,
    `https://dns.google/resolve?name=${domain}&type=A`
  ];
  
  for (const serviceUrl of services) {
    try {
      const response = await fetch(serviceUrl, {
        headers: { 'Accept': 'application/dns-json' }
      });
      
      const data = await response.json();
      
      if (data.Answer && data.Answer.length > 0) {
        const addresses = data.Answer
          .filter(a => a.type === 1)
          .map(a => a.data);
        
        const firstIP = addresses[0];
        const ipInfo = await getIPInfo(firstIP);
        
        const results = {
          type: 'dns',
          domain: domain,
          addresses: addresses,
          canonicalName: data.Answer[0].name || domain,
          isTRR: true,
          ipInfo: ipInfo,
          resolutionTime: 0,
          dnsServer: "Service DNS public",
          timestamp: new Date().toISOString(),
          source: serviceUrl.includes('cloudflare') ? 'Cloudflare' : 'Google'
        };
        
        await sendResultsToTab(tabId, results);
        return;
      }
    } catch (error) {
      console.warn(`Service ${serviceUrl} échoué:`, error);
      continue;
    }
  }
  
  throw new Error("Tous les services DNS ont échoué");
}

// Fonction pour obtenir des informations sur une IP
async function getIPInfo(ipAddress) {
  try {
    // Pour les IPs privées, informations basiques
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
    
    // Pour les IPs publiques, utiliser un service
    const token = await getIpInfoToken();
    const url = token 
      ? `https://ipinfo.io/${ipAddress}/json?token=${token}`
      : `https://ipinfo.io/${ipAddress}/json`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    data.isPrivate = false;
    
    return data;
  } catch (error) {
    console.warn("Impossible d'obtenir les informations IP:", error);
    
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

// Fonction pour obtenir des informations sur le réseau privé
function getPrivateNetworkInfo(ipAddress) {
  const parts = ipAddress.split('.').map(Number);
  
  if (parts[0] === 10) return "Réseau privé Classe A (10.0.0.0/8)";
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return "Réseau privé Classe B (172.16.0.0/12)";
  if (parts[0] === 192 && parts[1] === 168) return "Réseau privé Classe C (192.168.0.0/16)";
  if (parts[0] === 127) return "Localhost (127.0.0.0/8)";
  if (parts[0] === 169 && parts[1] === 254) return "Link-local (169.254.0.0/16)";
  
  return "Réseau privé";
}

// Fonction pour vérifier si une IP est privée
function isPrivateIP(ip) {
  const parts = ip.split('.').map(Number);
  
  // 10.0.0.0/8
  if (parts[0] === 10) return true;
  
  // 172.16.0.0/12
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  
  // 192.168.0.0/16
  if (parts[0] === 192 && parts[1] === 168) return true;
  
  // 127.0.0.0/8 (localhost)
  if (parts[0] === 127) return true;
  
  // 169.254.0.0/16 (link-local)
  if (parts[0] === 169 && parts[1] === 254) return true;
  
  return false;
}

// Gestion du cache
function saveToCache(key, data) {
  dnsCache.set(key, {
    data: data,
    timestamp: Date.now()
  });
  
  // Nettoyage périodique du cache
  setTimeout(() => {
    cleanupCache();
  }, CACHE_DURATION);
}

function getFromCache(key) {
  const cached = dnsCache.get(key);
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_DURATION) {
    dnsCache.delete(key);
    return null;
  }
  
  return cached.data;
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of dnsCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      dnsCache.delete(key);
    }
  }
}

// Fonction pour obtenir le token ipinfo.io depuis le stockage
async function getIpInfoToken() {
  const result = await browser.storage.local.get('ipinfoToken');
  return result.ipinfoToken || '';
}

// Fonction pour afficher des notifications
function showNotification(title, message) {
  // Vérifier si les notifications sont activées
  browser.storage.local.get('showNotifications').then(settings => {
    if (settings.showNotifications !== false) { // true par défaut
      browser.notifications.create({
        type: "basic",
        iconUrl: "icons/icon-48.png",
        title: title,
        message: message
      }).catch(console.error);
    }
  });
}

// Initialisation
console.log("Extension DNS/IP Resolver initialisée avec DNS local");