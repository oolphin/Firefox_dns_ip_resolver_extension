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
        
        resultsContent.innerHTML = '<div class="loading">Résolution en cours...</div>';
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
            resultsContent.innerHTML = `
                <div class="error">
                    <strong>Erreur:</strong> ${escapeHtml(error.message)}
                </div>
            `;
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
        let html = '';
        
        if (data.type === 'dns') {
            html = `
                <div class="result-item">
                    <span class="result-label">Domaine:</span> ${escapeHtml(data.domain)}
                </div>
                <div class="result-item">
                    <span class="result-label">IPs résolues:</span><br>
                    ${(data.addresses || []).map(ip => `
                        <span class="ip-chip ${isPrivateIP(ip) ? 'ip-private' : 'ip-public'}">
                            ${escapeHtml(ip)}
                        </span>
                    `).join(' ')}
                </div>
                ${data.ipInfo ? displayIPInfo(data.ipInfo) : ''}
            `;
        } else if (data.type === 'ip') {
            html = `
                <div class="result-item">
                    <span class="result-label">Adresse IP:</span> ${escapeHtml(data.ip)}
                </div>
                <div class="result-item">
                    <span class="result-label">Type:</span>
                    <span class="ip-chip ${data.isPrivate ? 'ip-private' : 'ip-public'}">
                        ${data.isPrivate ? 'IP privée' : 'IP publique'}
                    </span>
                </div>
                ${data.reverseDNS && data.reverseDNS !== 'Non disponible' ? `
                    <div class="result-item">
                        <span class="result-label">Nom inverse:</span> ${escapeHtml(data.reverseDNS)}
                    </div>
                ` : ''}
                ${data.ipInfo ? displayIPInfo(data.ipInfo) : ''}
            `;
        }
        
        resultsContent.innerHTML = html;
    }
    
    // Fonction pour afficher les informations IP détaillées
    function displayIPInfo(ipInfo) {
        if (!ipInfo || ipInfo.city === "Information non disponible") {
            return '';
        }
        
        let html = '';
        
        // Type d'IP
        if (ipInfo.ipType) {
            html += `
                <div class="result-item">
                    <span class="result-label">Type d'IP:</span>
                    <span class="ip-chip" style="background: ${ipInfo.ipType.color}; color: white;">
                        ${escapeHtml(ipInfo.ipType.label)}
                    </span>
                </div>
            `;
        }
        
        // Indicateurs
        if (ipInfo.isMobile || ipInfo.isProxy || ipInfo.isHosting) {
            const indicators = [];
            if (ipInfo.isMobile) indicators.push('📱 Mobile');
            if (ipInfo.isProxy) indicators.push('🔒 Proxy/VPN');
            if (ipInfo.isHosting) indicators.push('🖥️ Datacenter');
            
            html += `
                <div class="result-item">
                    <span class="result-label">Indicateurs:</span> ${indicators.join(', ')}
                </div>
            `;
        }
        
        // Localisation
        html += `
            <div class="result-item">
                <span class="result-label">Localisation:</span> ${escapeHtml([ipInfo.city, ipInfo.region, ipInfo.countryName || ipInfo.country].filter(Boolean).join(', '))}
            </div>
        `;
        
        // Organisation / ASN
        if (ipInfo.orgName || ipInfo.org) {
            html += `
                <div class="result-item">
                    <span class="result-label">Organisation:</span> ${escapeHtml(ipInfo.orgName || ipInfo.org)}
                </div>
            `;
        }
        
        if (ipInfo.asn) {
            html += `
                <div class="result-item">
                    <span class="result-label">ASN:</span> ${escapeHtml(ipInfo.asn)}
                </div>
            `;
        }
        
        // ISP
        if (ipInfo.isp && ipInfo.isp !== ipInfo.orgName) {
            html += `
                <div class="result-item">
                    <span class="result-label">FAI:</span> ${escapeHtml(ipInfo.isp)}
                </div>
            `;
        }
        
        // Plage IP
        if (ipInfo.ipRange && ipInfo.ipRange.prefix) {
            html += `
                <div class="result-item">
                    <span class="result-label">Préfixe:</span> <code>${escapeHtml(ipInfo.ipRange.prefix)}</code>
                </div>
            `;
        }
        
        // Date allocation (âge)
        if (ipInfo.asnInfo && ipInfo.asnInfo.dateAllocated) {
            const age = calculateAge(ipInfo.asnInfo.dateAllocated);
            html += `
                <div class="result-item">
                    <span class="result-label">Allocation:</span> ${escapeHtml(ipInfo.asnInfo.dateAllocated)} ${age}
                </div>
            `;
        }
        
        // Coordonnées
        if (ipInfo.loc && ipInfo.loc !== 'Non disponible') {
            html += `
                <div class="result-item">
                    <span class="result-label">Coordonnées:</span> ${escapeHtml(ipInfo.loc)}
                </div>
            `;
        }
        
        return html;
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
                return `(${diffYears} an${diffYears > 1 ? 's' : ''})`;
            } else {
                return `(${diffDays} jours)`;
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
                
                historyContent.innerHTML = historyList.slice(0, 5).map(item => `
                    <div class="history-item" data-input="${escapeHtml(item.input)}">
                        <strong>${escapeHtml(item.input)}</strong><br>
                        <small>${new Date(item.timestamp).toLocaleString('fr-FR')}</small>
                    </div>
                `).join('');
                
                // Ajouter les événements de clic
                document.querySelectorAll('.history-item').forEach(item => {
                    item.addEventListener('click', function() {
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
        return div.innerHTML;
    }
});
