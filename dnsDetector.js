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
      // Créer une connexion RTCPeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      pc.createDataChannel('dns-test');
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(() => resolve(null));
      
      // Timer pour éviter le blocage
      setTimeout(() => {
        pc.close();
        // Dans Firefox, cette méthode ne donne pas directement le DNS
        // mais peut aider à détecter certaines configurations
        resolve(null);
      }, 1000);
    });
  }
  
  // Obtenir les informations réseau
  async getNetworkInfo() {
    try {
      // Utiliser l'API NetworkInformation si disponible
      if (navigator.connection) {
        const connection = navigator.connection;
        return {
          type: connection.type,
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
      // Essayer de résoudre un nom de domaine qui devrait utiliser le DNS local
      const testDomain = 'localhost';
      const response = await fetch(`http://${testDomain}`, {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      }).catch(() => ({ ok: false }));
      
      // Si on peut contacter localhost, c'est que la résolution fonctionne
      return true;
    } catch (error) {
      return false;
    }
  }
  
  // Tester un serveur DNS spécifique
  async testDNSServer(dnsServer, domain = 'example.com') {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const img = new Image();
      
      img.onload = img.onerror = () => {
        const responseTime = Date.now() - startTime;
        resolve({
          server: dnsServer,
          reachable: true,
          responseTime: responseTime
        });
      };
      
      // URL avec timestamp pour éviter le cache
      img.src = `http://${dnsServer}/test?t=${Date.now()}`;
      
      // Timeout après 3 secondes
      setTimeout(() => {
        img.onload = img.onerror = null;
        resolve({
          server: dnsServer,
          reachable: false,
          responseTime: null
        });
      }, 3000);
    });
  }
  
  // Obtenir le serveur DNS actuellement utilisé
  getCurrentDNSServer() {
    return this.localDNSServer || "DNS système (par défaut)";
  }
}

// Singleton
const dnsDetector = new DNSDetector();

// Exporter pour utilisation dans background.js
if (typeof module !== 'undefined') {
  module.exports = dnsDetector;
}