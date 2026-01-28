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
        
        clearElement(resultsContent);
        const loading = document.createElement('div');
        loading.className = 'loading';
        loading.textContent = 'Résolution en cours...';
        resultsContent.appendChild(loading);
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
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error';
            
            const strong = document.createElement('strong');
            strong.textContent = 'Erreur: ';
            
            errorDiv.appendChild(strong);
            errorDiv.appendChild(document.createTextNode(escapeHtml(error.message)));
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
    
    // Fonction pour afficher les résultats
    function displayResults(data) {
        clearElement(resultsContent);
        
        if (data.type === 'dns') {
            createDNSResults(data, resultsContent);
        } else if (data.type === 'ip') {
            createIPResults(data, resultsContent);
        }
    }
    
    // Fonction pour créer les résultats DNS
    function createDNSResults(data, container) {
        // Domaine
        const domainDiv = createResultItem('Domaine:', escapeHtml(data.domain));
        container.appendChild(domainDiv);
        
        // IPs résolues
        if (data.addresses && data.addresses.length > 0) {
            const ipDiv = createResultItem('IPs résolues:', '');
            
            const ipContainer = document.createElement('div');
            ipContainer.style.marginTop = '5px';
            
            data.addresses.forEach(ip => {
                const ipChip = document.createElement('span');
                ipChip.className = `ip-chip ${isPrivateIP(ip) ? 'ip-private' : 'ip-public'}`;
                ipChip.textContent = escapeHtml(ip);
                ipChip.style.marginRight = '5px';
                ipContainer.appendChild(ipChip);
            });
            
            ipDiv.appendChild(ipContainer);
            container.appendChild(ipDiv);
        }
        
        // Informations IP supplémentaires
        if (data.ipInfo) {
            displayIPInfo(data.ipInfo, container, data.addresses?.[0]);
        }
        
        // Informations techniques
        if (data.timestamp) {
            const timestampDiv = createResultItem('Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR'));
            container.appendChild(timestampDiv);
        }
    }
    
    // Fonction pour créer les résultats IP
    function createIPResults(data, container) {
        // Adresse IP
        const ipDiv = createResultItem('Adresse IP:', escapeHtml(data.ip));
        container.appendChild(ipDiv);
        
        // Type
        const typeDiv = createResultItem('Type:', '');
        const typeChip = document.createElement('span');
        typeChip.className = `ip-chip ${data.isPrivate ? 'ip-private' : 'ip-public'}`;
        typeChip.textContent = data.isPrivate ? 'IP privée' : 'IP publique';
        typeDiv.appendChild(typeChip);
        container.appendChild(typeDiv);
        
        // Nom inverse
        if (data.reverseDNS && data.reverseDNS !== 'Non disponible') {
            const reverseDiv = createResultItem('Nom inverse:', escapeHtml(data.reverseDNS));
            container.appendChild(reverseDiv);
        }
        
        // Informations IP supplémentaires
        if (data.ipInfo) {
            displayIPInfo(data.ipInfo, container, data.ip);
        }
        
        // Informations techniques
        if (data.timestamp) {
            const timestampDiv = createResultItem('Horodatage:', new Date(data.timestamp).toLocaleString('fr-FR'));
            container.appendChild(timestampDiv);
        }
    }
    
    // Fonction pour afficher les informations IP détaillées
    function displayIPInfo(ipInfo, container, ip) {
        if (!ipInfo || ipInfo.city === "Information non disponible") {
            return;
        }
        
        // Créer une section pour les informations IP
        const ipSection = document.createElement('div');
        ipSection.className = 'result-section';
        ipSection.style.marginTop = '15px';
        ipSection.style.paddingTop = '15px';
        ipSection.style.borderTop = '1px solid #eee';
        
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = 'Informations détaillées';
        sectionTitle.style.margin = '0 0 10px 0';
        sectionTitle.style.color = '#2c3e50';
        sectionTitle.style.fontSize = '14px';
        sectionTitle.style.fontWeight = '600';
        ipSection.appendChild(sectionTitle);
        
        // Type d'IP
        if (ipInfo.ipType) {
            const typeDiv = createResultItem('Type d\'IP:', '');
            const typeChip = document.createElement('span');
            typeChip.className = 'ip-chip';
            typeChip.style.cssText = `background: ${ipInfo.ipType.color}; color: white;`;
            typeChip.textContent = escapeHtml(ipInfo.ipType.label);
            typeDiv.appendChild(typeChip);
            ipSection.appendChild(typeDiv);
        }
        
        // Indicateurs
        if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
            const indicators = [];
            if (ipInfo.isMobile) indicators.push('📱 Mobile');
            if (ipInfo.isProxy) indicators.push('🔒 Proxy/VPN');
            if (ipInfo.isHosting) indicators.push('🖥️ Datacenter');
            
            const indicatorsDiv = createResultItem('Indicateurs:', indicators.join(', '));
            ipSection.appendChild(indicatorsDiv);
        }
        
        // Localisation
        const locationParts = [ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean);
        if (locationParts.length > 0) {
            const locationDiv = createResultItem('Localisation:', escapeHtml(locationParts.join(', ')));
            ipSection.appendChild(locationDiv);
        }
        
        // Coordonnées
        if (ipInfo.loc && ipInfo.loc !== 'Non disponible') {
            const coordDiv = createResultItem('Coordonnées:', escapeHtml(ipInfo.loc));
            ipSection.appendChild(coordDiv);
        }
        
        // Fuseau horaire
        if (ipInfo.timezone && ipInfo.timezone !== 'Non disponible') {
            const timezoneDiv = createResultItem('Fuseau horaire:', escapeHtml(ipInfo.timezone));
            ipSection.appendChild(timezoneDiv);
        }
        
        // Section ASN / Propriétaire
        if (ipInfo.asn || ipInfo.asnInfo || ipInfo.orgName) {
            const asnSection = document.createElement('div');
            asnSection.style.marginTop = '15px';
            
            const asnTitle = document.createElement('h5');
            asnTitle.textContent = 'ASN / Propriétaire';
            asnTitle.style.margin = '10px 0 5px 0';
            asnTitle.style.color = '#34495e';
            asnTitle.style.fontSize = '13px';
            asnTitle.style.fontWeight = '600';
            asnSection.appendChild(asnTitle);
            
            // ASN
            if (ipInfo.asn) {
                const asnDiv = createResultItem('ASN:', escapeHtml(ipInfo.asn));
                asnSection.appendChild(asnDiv);
            }
            
            // Organisation
            if (ipInfo.orgName) {
                const orgDiv = createResultItem('Organisation:', escapeHtml(ipInfo.orgName));
                asnSection.appendChild(orgDiv);
            }
            
            // Description ASN
            if (ipInfo.asnInfo && ipInfo.asnInfo.description) {
                const descDiv = createResultItem('Description:', escapeHtml(ipInfo.asnInfo.description));
                asnSection.appendChild(descDiv);
            }
            
            // FAI
            if (ipInfo.isp && ipInfo.isp !== ipInfo.orgName) {
                const ispDiv = createResultItem('FAI:', escapeHtml(ipInfo.isp));
                asnSection.appendChild(ispDiv);
            }
            
            // Pays ASN
            if (ipInfo.asnInfo && ipInfo.asnInfo.country) {
                const countryDiv = createResultItem('Pays ASN:', escapeHtml(ipInfo.asnInfo.country));
                asnSection.appendChild(countryDiv);
            }
            
            // RIR
            if (ipInfo.asnInfo && ipInfo.asnInfo.rirName) {
                const rirDiv = createResultItem('RIR:', escapeHtml(ipInfo.asnInfo.rirName));
                asnSection.appendChild(rirDiv);
            }
            
            // Date d'allocation et âge
            if (ipInfo.asnInfo && ipInfo.asnInfo.dateAllocated) {
                const ageText = calculateAgeDetailed(ipInfo.asnInfo.dateAllocated);
                const allocDiv = createResultItem('Date allocation:', escapeHtml(ipInfo.asnInfo.dateAllocated) + ' ' + ageText);
                asnSection.appendChild(allocDiv);
            }
            
            // Site web
            if (ipInfo.asnInfo && ipInfo.asnInfo.website) {
                const websiteDiv = createResultItem('Site web:', '');
                const websiteLink = document.createElement('a');
                websiteLink.href = escapeHtml(ipInfo.asnInfo.website);
                websiteLink.textContent = escapeHtml(ipInfo.asnInfo.website);
                websiteLink.target = '_blank';
                websiteLink.rel = 'noopener noreferrer';
                websiteLink.style.color = '#3498db';
                websiteLink.style.textDecoration = 'none';
                websiteDiv.appendChild(websiteLink);
                asnSection.appendChild(websiteDiv);
            }
            
            ipSection.appendChild(asnSection);
        }
        
        // Section Plage IP
        if (ipInfo.ipRange && ipInfo.ipRange.prefix) {
            const rangeSection = document.createElement('div');
            rangeSection.style.marginTop = '15px';
            
            const rangeTitle = document.createElement('h5');
            rangeTitle.textContent = 'Plage IP';
            rangeTitle.style.margin = '10px 0 5px 0';
            rangeTitle.style.color = '#34495e';
            rangeTitle.style.fontSize = '13px';
            rangeTitle.style.fontWeight = '600';
            rangeSection.appendChild(rangeTitle);
            
            const prefixDiv = createResultItem('Préfixe:', escapeHtml(ipInfo.ipRange.prefix));
            rangeSection.appendChild(prefixDiv);
            
            if (ipInfo.ipRange.name) {
                const nameDiv = createResultItem('Nom:', escapeHtml(ipInfo.ipRange.name));
                rangeSection.appendChild(nameDiv);
            }
            
            if (ipInfo.ipRange.description) {
                const descDiv = createResultItem('Description:', escapeHtml(ipInfo.ipRange.description));
                rangeSection.appendChild(descDiv);
            }
            
            ipSection.appendChild(rangeSection);
        }
        
        // Section Contact Abuse
        if (ipInfo.abuse && (ipInfo.abuse.email || ipInfo.abuse.phone)) {
            const abuseSection = document.createElement('div');
            abuseSection.style.marginTop = '15px';
            
            const abuseTitle = document.createElement('h5');
            abuseTitle.textContent = 'Contact Abuse';
            abuseTitle.style.margin = '10px 0 5px 0';
            abuseTitle.style.color = '#34495e';
            abuseTitle.style.fontSize = '13px';
            abuseTitle.style.fontWeight = '600';
            abuseSection.appendChild(abuseTitle);
            
            if (ipInfo.abuse.name) {
                const nameDiv = createResultItem('Nom:', escapeHtml(ipInfo.abuse.name));
                abuseSection.appendChild(nameDiv);
            }
            
            if (ipInfo.abuse.email) {
                const emailDiv = createResultItem('Email:', '');
                const emailLink = document.createElement('a');
                emailLink.href = 'mailto:' + escapeHtml(ipInfo.abuse.email);
                emailLink.textContent = escapeHtml(ipInfo.abuse.email);
                emailLink.style.color = '#3498db';
                emailLink.style.textDecoration = 'none';
                emailDiv.appendChild(emailLink);
                abuseSection.appendChild(emailDiv);
            }
            
            if (ipInfo.abuse.phone) {
                const phoneDiv = createResultItem('Téléphone:', escapeHtml(ipInfo.abuse.phone));
                abuseSection.appendChild(phoneDiv);
            }
            
            if (ipInfo.abuse.network) {
                const networkDiv = createResultItem('Réseau:', escapeHtml(ipInfo.abuse.network));
                abuseSection.appendChild(networkDiv);
            }
            
            ipSection.appendChild(abuseSection);
        }
        
        container.appendChild(ipSection);
    }
    
    // Fonction utilitaire pour créer un élément de résultat
    function createResultItem(label, content) {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.style.marginBottom = '8px';
        
        const labelSpan = document.createElement('span');
        labelSpan.className = 'result-label';
        labelSpan.textContent = label;
        labelSpan.style.fontWeight = '600';
        labelSpan.style.color = '#7f8c8d';
        labelSpan.style.display = 'inline-block';
        labelSpan.style.width = '120px';
        labelSpan.style.verticalAlign = 'top';
        
        const contentSpan = document.createElement('span');
        contentSpan.className = 'result-content';
        contentSpan.style.color = '#2c3e50';
        contentSpan.style.wordBreak = 'break-all';
        
        if (typeof content === 'string') {
            contentSpan.textContent = content;
        } else if (content instanceof Node) {
            contentSpan.appendChild(content);
        }
        
        div.appendChild(labelSpan);
        div.appendChild(contentSpan);
        
        return div;
    }
    
    // Fonction pour calculer l'âge détaillé
    function calculateAgeDetailed(dateString) {
        if (!dateString) return '';
        
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffYears = Math.floor(diffDays / 365);
            const diffMonths = Math.floor((diffDays % 365) / 30);
            const remainingDays = diffDays % 30;
            
            let ageText = '(';
            if (diffYears > 0) {
                ageText += `${diffYears} an${diffYears > 1 ? 's' : ''}`;
                if (diffMonths > 0) {
                    ageText += `, ${diffMonths} mois`;
                }
            } else if (diffMonths > 0) {
                ageText += `${diffMonths} mois`;
                if (remainingDays > 0) {
                    ageText += `, ${remainingDays} jour${remainingDays > 1 ? 's' : ''}`;
                }
            } else {
                ageText += `${diffDays} jour${diffDays > 1 ? 's' : ''}`;
            }
            ageText += ')';
            
            return ageText;
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
                
                historyList.slice(0, 5).forEach(item => {
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    historyItem.dataset.input = escapeHtml(item.input);
                    
                    const strong = document.createElement('strong');
                    strong.textContent = escapeHtml(item.input);
                    
                    const br = document.createElement('br');
                    
                    const small = document.createElement('small');
                    small.textContent = new Date(item.timestamp).toLocaleString('fr-FR');
                    
                    historyItem.appendChild(strong);
                    historyItem.appendChild(br);
                    historyItem.appendChild(small);
                    historyContent.appendChild(historyItem);
                    
                    // Ajouter l'événement de clic
                    historyItem.addEventListener('click', function() {
                        inputText.value = this.dataset.input;
                        resolveManual();
                    });
                });
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
    
    // Fonction pour échapper le HTML
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.textContent;
    }
    
    // Fonction pour vider un élément
    function clearElement(element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
});