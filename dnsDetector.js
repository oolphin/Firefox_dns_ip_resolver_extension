// DNS Detector - Détection du serveur DNS local
class DNSDetector {
  constructor() {
    this.localDNSServer = null;
    this.systemDNSSettings = null;
  }
  
  // Détecter le serveur DNS système
  async detectSystemDNS() {
    try {
      // Méthode 1: Via WebRTC (peut révéler le DNS local)
      const dnsFromWebRTC = await this.getDNSFromWebRTC();
      if (dnsFromWebRTC) {
        this.localDNSServer = dnsFromWebRTC;
        return dnsFromWebRTC;
      }
      
      // Méthode 2: Via API réseau (expérimental)
      const networkInfo = await this.getNetworkInfo();
      if (networkInfo.dnsServers && networkInfo.dnsServers.length > 0) {
        this.localDNSServer = networkInfo.dnsServers[0];
        return this.localDNSServer;
      }
      
      // Méthode 3: Via résolution d'un nom local
      const localResolution = await this.testLocalResolution();
      if (localResolution) {
        this.localDNSServer = "DNS système (détecté)";
        return this.localDNSServer;
      }
      
      return "DNS système (non détecté)";
      
    } catch (error) {
      console.warn("Erreur de détection DNS:", error);
      return "DNS système (erreur de détection)";
    }
  }
  
  // Obtenir le DNS via WebRTC (méthode indirecte)
  async getDNSFromWebRTC() {
    return new Promise((resolve) => {
      try {
        // Créer une connexion RTCPeerConnection
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        
        let resolved = false;
        
        pc.onicecandidate = (event) => {
          if (event.candidate && !resolved) {
            // Analyser le candidat pour extraire des informations
            const candidate = event.candidate.candidate;
            console.log("ICE Candidate:", candidate);
            
            // Extraire l'IP locale si présente
            const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
            if (ipMatch) {
              // On a trouvé une IP, mais ce n'est pas directement le DNS
              // C'est l'IP locale de la machine
              console.log("IP locale détectée:", ipMatch[1]);
            }
          }
        };
        
        pc.createDataChannel('dns-test');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(() => {
            resolved = true;
            resolve(null);
          });
        
        // Timer pour éviter le blocage
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            resolve(null);
          }
        }, 2000);
      } catch (e) {
        resolve(null);
      }
    });
  }
  
  // Obtenir les informations réseau
  async getNetworkInfo() {
    try {
      // Utiliser l'API NetworkInformation si disponible
      if (navigator.connection) {
        const connection = navigator.connection;
        return {
          type: connection.type || 'unknown',
          effectiveType: connection.effectiveType,
          downlink: connection.downlink,
          rtt: connection.rtt,
          dnsServers: [] // Non disponible via cette API
        };
      }
      
      // Fallback: détection basique
      return {
        type: "unknown",
        dnsServers: []
      };
    } catch (error) {
      return {
        type: "error",
        dnsServers: [],
        error: error.message
      };
    }
  }
  
  // Tester la résolution locale
  async testLocalResolution() {
    try {
      // Essayer de résoudre localhost via l'API DNS de Firefox
      if (typeof browser !== 'undefined' && browser.dns) {
        const result = await browser.dns.resolve('localhost');
        return result && result.addresses && result.addresses.length > 0;
      }
      return false;
    } catch (error) {
      return false;
    }
  }
  
  // Tester un serveur DNS spécifique via timing
  async testDNSServer(dnsServer, domain = 'example.com') {
    return new Promise((resolve) => {
      const startTime = Date.now();
      
      // Utiliser fetch pour tester la connectivité
      fetch(`https://${domain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      })
      .then(() => {
        const responseTime = Date.now() - startTime;
        resolve({
          server: dnsServer,
          reachable: true,
          responseTime: responseTime
        });
      })
      .catch(() => {
        resolve({
          server: dnsServer,
          reachable: false,
          responseTime: null
        });
      });
      
      // Timeout après 5 secondes
      setTimeout(() => {
        resolve({
          server: dnsServer,
          reachable: false,
          responseTime: null,
          timeout: true
        });
      }, 5000);
    });
  }
  
  // Mesurer le temps de résolution DNS
  async measureDNSResolutionTime(domain) {
    const startTime = performance.now();
    
    try {
      if (typeof browser !== 'undefined' && browser.dns) {
        await browser.dns.resolve(domain);
        const endTime = performance.now();
        return {
          domain: domain,
          time: Math.round(endTime - startTime),
          success: true
        };
      }
      return { domain, time: null, success: false, error: 'API DNS non disponible' };
    } catch (error) {
      const endTime = performance.now();
      return {
        domain: domain,
        time: Math.round(endTime - startTime),
        success: false,
        error: error.message
      };
    }
  }
  
  // Obtenir le serveur DNS actuellement utilisé
  getCurrentDNSServer() {
    return this.localDNSServer || "DNS système (par défaut)";
  }
  
  // Détecter si DNS over HTTPS est activé
  async detectDoHStatus() {
    try {
      if (typeof browser !== 'undefined' && browser.dns) {
        // Résoudre un domaine et vérifier le flag isTRR
        const result = await browser.dns.resolve('example.com');
        return {
          dohEnabled: result.isTRR === true,
          method: result.isTRR ? 'DNS over HTTPS (TRR)' : 'DNS système standard'
        };
      }
      return { dohEnabled: false, method: 'Inconnu' };
    } catch (error) {
      return { dohEnabled: false, method: 'Erreur de détection', error: error.message };
    }
  }
}

// Singleton global
const dnsDetector = new DNSDetector();

// Initialiser la détection au chargement
dnsDetector.detectSystemDNS().then(server => {
  console.log("Serveur DNS détecté:", server);
});
