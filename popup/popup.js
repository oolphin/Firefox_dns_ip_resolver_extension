document.addEventListener('DOMContentLoaded', function() {
    // Éléments DOM
    const inputText = document.getElementById('input-text');
    const resolveBtn = document.getElementById('resolve-btn');
    const resultsSection = document.getElementById('results-section');
    const resultsContent = document.getElementById('results-content');
    const historySection = document.getElementById('history-section');
    const historyContent = document.getElementById('history-content');
    const ipinfoToken = document.getElementById('ipinfo-token');
    const saveTokenBtn = document.getElementById('save-token');
    const autoClose = document.getElementById('auto-close');
    const showNotifications = document.getElementById('show-notifications');
    
    // Expressions régulières
    const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const FQDN_REGEX = /^(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,})$/;
    // Noms courts : lettres, chiffres, tirets, 1-63 caractères
    const SHORT_NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-]{0,62}$/;
    
    // Fonction pour vérifier si c'est un nom résolvable
    function isResolvableName(text) {
        // Éviter les noms qui finissent par un tiret
        if (text.endsWith('-')) return false;
        return FQDN_REGEX.test(text) || SHORT_NAME_REGEX.test(text);
    }
    
    // Fonction utilitaire pour créer un élément
    function createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else if (key === 'textContent') {
                element.textContent = value;
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
    
    // Fonction pour vider un élément
    function clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
    
    // Charger les paramètres
    loadSettings();
    loadHistory();
    
    // Événements
    resolveBtn.addEventListener('click', resolveManual);
    inputText.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') resolveManual();
    });
    
    saveTokenBtn.addEventListener('click', saveToken);
    autoClose.addEventListener('change', saveSettings);
    showNotifications.addEventListener('change', saveSettings);
    
    // Fonction pour résoudre manuellement
    async function resolveManual() {
        const input = inputText.value.trim();
        if (!input) return;
        
        // Afficher le loading
        clearElement(resultsContent);
        const loadingDiv = createElement('div', { className: 'loading' }, ['Résolution en cours...']);
        resultsContent.appendChild(loadingDiv);
        resultsSection.style.display = 'block';
        
        try {
            let result;
            
            if (IP_REGEX.test(input)) {
                result = await resolveIP(input);
            } else if (isResolvableName(input)) {
                result = await resolveDNS(input);
            } else {
                throw new Error('Format invalide. Veuillez entrer un nom de domaine, un nom court (ex: server1) ou une adresse IP.');
            }
            
            if (result.error) {
                throw new Error(result.error);
            }
            
            displayResults(result);
            saveToHistory(input, result);
            
        } catch (error) {
            clearElement(resultsContent);
            const errorDiv = createElement('div', { className: 'error' });
            errorDiv.appendChild(createElement('strong', {}, ['Erreur: ']));
            errorDiv.appendChild(document.createTextNode(error.message));
            resultsContent.appendChild(errorDiv);
        }
    }
    
    // Fonction pour résoudre un nom de domaine
    async function resolveDNS(domain) {
        return browser.runtime.sendMessage({
            action: 'resolveDNS',
            domain: domain
        });
    }
    
    // Fonction pour résoudre une adresse IP
    async function resolveIP(ipAddress) {
        return browser.runtime.sendMessage({
            action: 'resolveIP',
            ip: ipAddress
        });
    }
    
    // Fonction pour créer un result-item
    function createResultItem(label, value, isNode = false) {
        const item = createElement('div', { className: 'result-item' });
        item.appendChild(createElement('span', { className: 'result-label' }, [label]));
        
        if (isNode && value instanceof Node) {
            item.appendChild(document.createTextNode(' '));
            item.appendChild(value);
        } else {
            item.appendChild(document.createTextNode(' ' + (value || '')));
        }
        
        return item;
    }
    
    // Fonction pour afficher les résultats
    function displayResults(data) {
        clearElement(resultsContent);
        
        if (data.type === 'dns') {
            // Domaine
            resultsContent.appendChild(createResultItem('Domaine:', data.domain));
            
            // IPs résolues
            const ipsItem = createElement('div', { className: 'result-item' });
            ipsItem.appendChild(createElement('span', { className: 'result-label' }, ['IPs résolues:']));
            ipsItem.appendChild(createElement('br'));
            
            for (const ip of (data.addresses || [])) {
                const chipClass = 'ip-chip ' + (isPrivateIP(ip) ? 'ip-private' : 'ip-public');
                ipsItem.appendChild(createElement('span', { className: chipClass }, [ip]));
                ipsItem.appendChild(document.createTextNode(' '));
            }
            resultsContent.appendChild(ipsItem);
            
            // IP Info
            if (data.ipInfo) {
                displayIPInfo(data.ipInfo);
            }
            
        } else if (data.type === 'ip') {
            // Adresse IP
            resultsContent.appendChild(createResultItem('Adresse IP:', data.ip));
            
            // Type
            const typeItem = createElement('div', { className: 'result-item' });
            typeItem.appendChild(createElement('span', { className: 'result-label' }, ['Type:']));
            typeItem.appendChild(document.createTextNode(' '));
            const typeChip = createElement('span', {
                className: 'ip-chip ' + (data.isPrivate ? 'ip-private' : 'ip-public')
            }, [data.isPrivate ? 'IP privée' : 'IP publique']);
            typeItem.appendChild(typeChip);
            resultsContent.appendChild(typeItem);
            
            // Nom inverse
            if (data.reverseDNS && data.reverseDNS !== 'Non disponible') {
                resultsContent.appendChild(createResultItem('Nom inverse:', data.reverseDNS));
            }
            
            // IP Info
            if (data.ipInfo) {
                displayIPInfo(data.ipInfo);
            }
        }
    }
    
    // Fonction pour afficher les informations IP détaillées
    function displayIPInfo(ipInfo) {
        if (!ipInfo || ipInfo.city === "Information non disponible") {
            return;
        }
        
        // Type d'IP
        if (ipInfo.ipType) {
            const typeItem = createElement('div', { className: 'result-item' });
            typeItem.appendChild(createElement('span', { className: 'result-label' }, ["Type d'IP:"]));
            typeItem.appendChild(document.createTextNode(' '));
            const typeBadge = createElement('span', {
                className: 'ip-chip',
                style: { background: ipInfo.ipType.color, color: 'white' }
            }, [ipInfo.ipType.label]);
            typeItem.appendChild(typeBadge);
            resultsContent.appendChild(typeItem);
        }
        
        // Indicateurs
        if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
            const indicators = [];
            if (ipInfo.isMobile) indicators.push('📱 Mobile');
            if (ipInfo.isProxy) indicators.push('🔒 Proxy/VPN');
            if (ipInfo.isHosting) indicators.push('🖥️ Datacenter');
            resultsContent.appendChild(createResultItem('Indicateurs:', indicators.join(', ')));
        }
        
        // Localisation
        const location = [ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean).join(', ');
        resultsContent.appendChild(createResultItem('Localisation:', location));
        
        // Organisation / ASN
        if (ipInfo.orgName || ipInfo.org) {
            resultsContent.appendChild(createResultItem('Organisation:', ipInfo.orgName || ipInfo.org));
        }
        
        if (ipInfo.asn) {
            resultsContent.appendChild(createResultItem('ASN:', ipInfo.asn));
        }
        
        // ISP
        if (ipInfo.isp && ipInfo.isp !== ipInfo.orgName) {
            resultsContent.appendChild(createResultItem('FAI:', ipInfo.isp));
        }
        
        // Plage IP
        if (ipInfo.ipRange && ipInfo.ipRange.prefix) {
            const prefixItem = createElement('div', { className: 'result-item' });
            prefixItem.appendChild(createElement('span', { className: 'result-label' }, ['Préfixe:']));
            prefixItem.appendChild(document.createTextNode(' '));
            prefixItem.appendChild(createElement('code', {}, [ipInfo.ipRange.prefix]));
            resultsContent.appendChild(prefixItem);
        }
        
        // Date allocation (âge)
        if (ipInfo.asnInfo && ipInfo.asnInfo.dateAllocated) {
            const age = calculateAge(ipInfo.asnInfo.dateAllocated);
            resultsContent.appendChild(createResultItem('Allocation:', ipInfo.asnInfo.dateAllocated + ' ' + age));
        }
        
        // Coordonnées
        if (ipInfo.loc && ipInfo.loc !== 'Non disponible') {
            resultsContent.appendChild(createResultItem('Coordonnées:', ipInfo.loc));
        }
    }
    
    // Fonction pour calculer l'âge
    function calculateAge(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365);
            
            if (diffYears > 0) {
                return '(' + diffYears + ' an' + (diffYears > 1 ? 's' : '') + ')';
            } else {
                return '(' + diffDays + ' jours)';
            }
        } catch (e) {
            return '';
        }
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
    
    // Fonction pour sauvegarder le token
    async function saveToken() {
        await browser.storage.local.set({
            ipinfoToken: ipinfoToken.value
        });
        
        // Afficher une confirmation
        const originalText = saveTokenBtn.textContent;
        saveTokenBtn.textContent = '✓ Enregistré';
        saveTokenBtn.style.background = '#2ecc71';
        
        setTimeout(() => {
            saveTokenBtn.textContent = originalText;
            saveTokenBtn.style.background = '';
        }, 2000);
    }
    
    // Fonction pour charger les paramètres
    async function loadSettings() {
        try {
            const settings = await browser.storage.local.get([
                'ipinfoToken',
                'autoClose',
                'showNotifications'
            ]);
            
            ipinfoToken.value = settings.ipinfoToken || '';
            autoClose.checked = settings.autoClose === true;
            showNotifications.checked = settings.showNotifications !== false;
        } catch (e) {
            console.warn("Erreur chargement paramètres:", e);
        }
    }
    
    // Fonction pour sauvegarder les paramètres
    async function saveSettings() {
        await browser.storage.local.set({
            autoClose: autoClose.checked,
            showNotifications: showNotifications.checked
        });
    }
    
    // Fonction pour charger l'historique
    async function loadHistory() {
        try {
            const history = await browser.storage.local.get('history');
            const historyList = history.history || [];
            
            if (historyList.length > 0) {
                historySection.style.display = 'block';
                clearElement(historyContent);
                
                for (const item of historyList.slice(0, 5)) {
                    const historyItem = createElement('div', {
                        className: 'history-item'
                    });
                    historyItem.dataset.input = item.input;
                    
                    historyItem.appendChild(createElement('strong', {}, [item.input]));
                    historyItem.appendChild(createElement('br'));
                    historyItem.appendChild(createElement('small', {}, [
                        new Date(item.timestamp).toLocaleString('fr-FR')
                    ]));
                    
                    // Ajouter l'événement de clic
                    historyItem.addEventListener('click', function() {
                        inputText.value = this.dataset.input;
                        resolveManual();
                    });
                    
                    historyContent.appendChild(historyItem);
                }
            }
        } catch (e) {
            console.warn("Erreur chargement historique:", e);
        }
    }
    
    // Fonction pour sauvegarder dans l'historique
    async function saveToHistory(input, result) {
        try {
            const history = await browser.storage.local.get('history');
            const historyList = history.history || [];
            
            // Éviter les doublons consécutifs
            if (historyList.length > 0 && historyList[0].input === input) {
                return;
            }
            
            // Ajouter au début de la liste
            historyList.unshift({
                input: input,
                result: result,
                timestamp: new Date().toISOString()
            });
            
            // Garder seulement les 10 derniers éléments
            const limitedHistory = historyList.slice(0, 10);
            
            await browser.storage.local.set({ history: limitedHistory });
            loadHistory();
        } catch (e) {
            console.warn("Erreur sauvegarde historique:", e);
        }
    }
});
