const API_BASE = ""; // Relative to served host
let authToken = localStorage.getItem("siege_token") || "";
let userRole = localStorage.getItem("siege_role") || "";
let userEmail = localStorage.getItem("siege_email") || "";
let activeTab = "dashboard";
let alertsFilter = "all";
let pollInterval = null;
let knownAlertsCount = -1;

// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    if (authToken) {
        setupAppSession();
    } else {
        showAuthScreen();
    }
});

function showAuthScreen() {
    document.getElementById("auth-screen").style.display = "flex";
    document.getElementById("app-screen").style.display = "none";
    stopPolling();
}

function setupAppSession() {
    document.getElementById("auth-screen").style.display = "none";
    document.getElementById("app-screen").style.display = "flex";
    
    // Apply role-based classes to body
    if (userRole === "admin") {
        document.body.classList.add("is-admin");
        document.getElementById("user-role-display").className = "role-badge admin";
        document.getElementById("user-role-display").innerText = "ADMIN";
    } else {
        document.body.classList.remove("is-admin");
        document.getElementById("user-role-display").className = "role-badge viewer";
        document.getElementById("user-role-display").innerText = "VIEWER";
    }
    
    document.getElementById("user-email-display").innerText = userEmail;
    
    // Default tab
    switchTab("dashboard");
    
    // Start background updates
    startPolling();
    refreshData();
}

// --- AUTH HANDLERS ---
function switchAuthTab(tab) {
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const loginBtn = document.getElementById("tab-login-btn");
    const registerBtn = document.getElementById("tab-register-btn");
    
    if (tab === "login") {
        loginForm.style.display = "block";
        registerForm.style.display = "none";
        loginBtn.classList.add("active");
        registerBtn.classList.remove("active");
    } else {
        loginForm.style.display = "none";
        registerForm.style.display = "block";
        loginBtn.classList.remove("active");
        registerBtn.classList.add("active");
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Authentication failed");
        }
        
        const data = await response.json();
        authToken = data.token;
        userRole = data.role;
        userEmail = data.email;
        
        localStorage.setItem("siege_token", authToken);
        localStorage.setItem("siege_role", userRole);
        localStorage.setItem("siege_email", userEmail);
        
        showToast("Authenticated", "Access token granted. Welcome back.", "success");
        setupAppSession();
    } catch (err) {
        showToast("Access Denied", err.message, "danger");
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    
    try {
        const response = await fetch(`${API_BASE}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        
        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Registration failed");
        }
        
        showToast("Registration Complete", "Account created successfully. You can now login.", "success");
        switchAuthTab("login");
    } catch (err) {
        showToast("Registration Failed", err.message, "danger");
    }
}

function handleLogout() {
    authToken = "";
    userRole = "";
    userEmail = "";
    localStorage.removeItem("siege_token");
    localStorage.removeItem("siege_role");
    localStorage.removeItem("siege_email");
    showToast("Logged Out", "Session terminated successfully.", "info");
    showAuthScreen();
}

// --- NAVIGATION & ROUTING ---
function switchTab(tabId) {
    activeTab = tabId;
    
    // Update active nav button
    document.querySelectorAll(".nav-btn").forEach(btn => {
        btn.classList.remove("active");
    });
    const activeBtn = document.getElementById(`nav-${tabId}`);
    if (activeBtn) activeBtn.classList.add("active");
    
    // Hide all views
    document.querySelectorAll(".view-section").forEach(view => {
        view.style.display = "none";
    });
    
    // Show selected view
    const viewEl = document.getElementById(`view-${tabId}`);
    if (viewEl) viewEl.style.display = "block";
    
    // Set headers
    const title = document.getElementById("page-title");
    const subtitle = document.getElementById("page-subtitle");
    
    if (tabId === "dashboard") {
        title.innerText = "Security Command Center";
        subtitle.innerText = "Real-time defacement monitoring and risk mitigation metrics.";
    } else if (tabId === "assets") {
        title.innerText = "Monitored Portals";
        subtitle.innerText = "Manage site registries and configure baseline snapshots.";
    } else if (tabId === "alerts") {
        title.innerText = "Incident Alert Feed";
        subtitle.innerText = "Analyze visual and structural webpage changes graded by AI risk scoring.";
    } else if (tabId === "audit") {
        title.innerText = "Platform Audit Trail";
        subtitle.innerText = "Verifiable record of administrative actions and system checks.";
    }
    
    refreshData();
}

// --- DATA FETCHING & POLLING ---
function startPolling() {
    stopPolling();
    // Poll every 12 seconds
    pollInterval = setInterval(refreshData, 12000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function apiFetch(endpoint, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
        headers["Authorization"] = `Bearer ${authToken}`;
    }
    
    const res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });
    
    if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please login again.");
    }
    if (res.status === 403) {
        throw new Error("Forbidden. Permission denied.");
    }
    
    return res;
}

async function refreshData() {
    if (!authToken) return;
    
    try {
        if (activeTab === "dashboard") {
            await Promise.all([updateDashboardMetrics(), updateDashboardAssets(), updateDashboardRecentAlerts()]);
        } else if (activeTab === "assets") {
            await updateAssetsList();
        } else if (activeTab === "alerts") {
            await updateAlertsFeed();
        } else if (activeTab === "audit") {
            await updateAuditLogs();
        }
        
        // Background check for alerts count to trigger Toast notifications on new critical items
        await checkNewAlertsCount();
        
    } catch (err) {
        console.error("Refresh error: ", err);
    }
}

async function checkNewAlertsCount() {
    try {
        const res = await apiFetch("/alerts?status=open");
        const alerts = await res.json();
        
        // Update alerts badge count in sidebar
        const badge = document.getElementById("alerts-badge");
        if (alerts.length > 0) {
            badge.innerText = alerts.length;
            badge.style.display = "inline-block";
        } else {
            badge.style.display = "none";
        }
        
        // Posture status badge update
        const postureBadge = document.getElementById("overall-status-badge");
        const radarDot = document.getElementById("radar-dot");
        const criticalAlerts = alerts.filter(a => a.severity === "high" || a.severity === "medium");
        if (criticalAlerts.length > 0) {
            postureBadge.className = "posture-badge flagged";
            postureBadge.innerText = `COMPROMISED (${criticalAlerts.length} RISKS)`;
            if (radarDot) radarDot.className = "radar-dot flagged";
        } else {
            postureBadge.className = "posture-badge clean";
            postureBadge.innerText = "SECURE";
            if (radarDot) radarDot.className = "radar-dot clean";
        }
        
        if (knownAlertsCount !== -1 && alerts.length > knownAlertsCount) {
            // New alert detected!
            const newAlert = alerts[0];
            showToast(
                `INCIDENT DETECTED [${newAlert.severity.toUpperCase()}]`,
                `Defacement risk identified on site: ${newAlert.asset_label || newAlert.asset_url}`,
                newAlert.severity === 'high' ? 'danger' : 'warning'
            );
            // Auto refresh current view
            if (activeTab === "dashboard" || activeTab === "alerts") {
                refreshData();
            }
        }
        
        knownAlertsCount = alerts.length;
    } catch (e) {
        // ignore errors in passive polling
    }
}

// --- VIEW UPDATERS ---

// Metrics
async function updateDashboardMetrics() {
    const resAssets = await apiFetch("/assets");
    const assets = await resAssets.json();
    document.getElementById("metric-assets-count").innerText = assets.length;
    
    const resAlerts = await apiFetch("/alerts?status=open");
    const alerts = await resAlerts.json();
    document.getElementById("metric-alerts-count").innerText = alerts.length;
    
    // Count snapshots across assets
    let totalSnaps = 0;
    for (let asset of assets) {
        try {
            const resSnaps = await apiFetch(`/assets/${asset.id}/snapshots`);
            const snaps = await resSnaps.json();
            totalSnaps += snaps.length;
        } catch (e) {}
    }
    document.getElementById("metric-snapshots-count").innerText = totalSnaps;
    
    if (userRole === "admin") {
        try {
            const resAudit = await apiFetch("/audit-logs");
            const logs = await resAudit.json();
            document.getElementById("metric-audit-count").innerText = logs.length;
        } catch(e) {}
    } else {
        document.getElementById("metric-audit-count").innerText = "N/A";
    }
}

// Assets list in dashboard
async function updateDashboardAssets() {
    const res = await apiFetch("/assets");
    const assets = await res.json();
    
    const tbody = document.getElementById("dashboard-assets-table-body");
    tbody.innerHTML = "";
    
    if (assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-cell">No sites registered. Go to "Monitored Sites" to register one.</td></tr>`;
        return;
    }
    
    assets.slice(0, 5).forEach(asset => {
        const tr = document.createElement("tr");
        
        const lastChecked = asset.created_at ? formatTime(asset.created_at) : "Never";
        
        tr.innerHTML = `
            <td><strong>${escapeHtml(asset.label)}</strong></td>
            <td><a href="${escapeHtml(asset.url)}" target="_blank" class="cyber-link">${escapeHtml(asset.url)}</a></td>
            <td><span class="table-status-badge ${asset.status}">${asset.status}</span></td>
            <td>${lastChecked}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Recent alerts on dashboard
async function updateDashboardRecentAlerts() {
    const res = await apiFetch("/alerts?status=open");
    const alerts = await res.json();
    
    const container = document.getElementById("dashboard-recent-alerts");
    container.innerHTML = "";
    
    if (alerts.length === 0) {
        container.innerHTML = `<div class="loading-cell">No active threat alerts detected. Posture nominal.</div>`;
        return;
    }
    
    alerts.slice(0, 4).forEach(alert => {
        const item = document.createElement("div");
        item.className = `recent-alert-item ${alert.severity}`;
        
        item.innerHTML = `
            <div class="recent-alert-info">
                <h4>${escapeHtml(alert.asset_label)}</h4>
                <p>Visual Diff: <strong>${alert.diff_score}%</strong> | Severity: <strong>${alert.severity.toUpperCase()}</strong></p>
            </div>
            <button class="cyber-small-btn" onclick="switchTab('alerts')">ANALYZE</button>
        `;
        container.appendChild(item);
    });
}

// Portal management list
async function updateAssetsList() {
    const res = await apiFetch("/assets");
    const assets = await res.json();
    
    const tbody = document.getElementById("assets-table-body");
    tbody.innerHTML = "";
    
    if (assets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading-cell">No websites registered under surveillance.</td></tr>`;
        return;
    }
    
    assets.forEach(asset => {
        const tr = document.createElement("tr");
        const date = formatTime(asset.created_at);
        
        const actionHtml = userRole === "admin" ? `
            <button class="cyber-small-btn" onclick="triggerManualScan(${asset.id}, this)">SCAN NOW</button>
            <button class="cyber-small-btn btn-danger" onclick="deleteAsset(${asset.id})">DELETE</button>
        ` : `<span class="text-muted">No Permissions</span>`;
        
        tr.innerHTML = `
            <td><strong>${escapeHtml(asset.label)}</strong></td>
            <td><a href="${escapeHtml(asset.url)}" target="_blank" class="cyber-link">${escapeHtml(asset.url)}</a></td>
            <td><span id="asset-badge-${asset.id}" class="table-status-badge ${asset.status}">${asset.status}</span></td>
            <td>${date}</td>
            <td><div class="flex gap-10">${actionHtml}</div></td>
        `;
        tbody.appendChild(tr);
    });
}

// Alerts feed
async function updateAlertsFeed() {
    let endpoint = "/alerts";
    if (alertsFilter === "open") endpoint = "/alerts?status=open";
    
    const res = await apiFetch(endpoint);
    let alerts = await res.json();
    
    if (alertsFilter === "resolved") {
        alerts = alerts.filter(a => a.status === "dismissed" || a.status === "reviewed");
    }
    
    const container = document.getElementById("alerts-feed-container");
    container.innerHTML = "";
    
    if (alerts.length === 0) {
        container.innerHTML = `<div class="loading-cell">No alert entries match the selected filters.</div>`;
        return;
    }
    
    alerts.forEach(alert => {
        const card = document.createElement("div");
        card.className = `alert-card ${alert.severity}`;
        
        // Format screenshots
        // We serve them via `/screenshots/snap_...`
        const snapBeforePath = alert.snapshot_id_before ? `/screenshots/${getFilename(alert.snapshot_id_before, alert.screenshot_path_before)}` : '';
        const snapAfterPath = `/screenshots/${getFilename(alert.snapshot_id_after, alert.screenshot_path_after)}`;
        const diffPath = snapAfterPath.replace(".png", "_diff.png");
        
        // Setup visual comparison block
        let visualCompareHtml = "";
        if (alert.snapshot_id_before) {
            visualCompareHtml = `
                <div class="visual-comparison-container" id="visual-compare-${alert.id}">
                    <div class="visual-panel">
                        <div class="visual-panel-title">Before Change Baseline</div>
                        <div class="visual-frame" onclick="zoomImage('${escapeHtml(alert.asset_label)} - Baseline', '${snapBeforePath}')">
                            <img src="${snapBeforePath}" onerror="this.src='https://placehold.co/600x400/png?text=Baseline+Screenshot+Missing'" alt="Before">
                        </div>
                    </div>
                    <div class="visual-panel">
                        <div class="visual-panel-title">After Change Flagged</div>
                        <div class="visual-frame" onclick="zoomImage('${escapeHtml(alert.asset_label)} - Flagged', '${snapAfterPath}')">
                            <img src="${snapAfterPath}" onerror="this.src='https://placehold.co/600x400/png?text=Target+Screenshot+Missing'" alt="After">
                        </div>
                    </div>
                </div>
                
                <!-- Hidden Diff Overlay view toggleable -->
                <div class="visual-comparison-container" id="visual-diff-overlay-view-${alert.id}" style="display: none;">
                    <div class="visual-diff-view">
                        <div class="visual-panel-title" style="padding: 10px;">Visual Difference Overlay (Pink highlights show modifications)</div>
                        <div class="visual-frame" style="aspect-ratio: 12/8;" onclick="zoomImage('${escapeHtml(alert.asset_label)} - Diff Map', '${diffPath}')">
                            <img src="${diffPath}" onerror="this.src='https://placehold.co/1200x800/png?text=Visual+Diff+Map+Not+Available+for+text+only+updates'" alt="Diff Overlay">
                        </div>
                    </div>
                </div>
            `;
        } else {
            visualCompareHtml = `
                <div class="visual-comparison-container">
                    <div class="visual-panel" style="grid-column: span 2;">
                        <div class="visual-panel-title">Baseline Snapshot Initialized</div>
                        <div class="visual-frame" style="aspect-ratio: 24/8;" onclick="zoomImage('${escapeHtml(alert.asset_label)} - Initial', '${snapAfterPath}')">
                            <img src="${snapAfterPath}" alt="Baseline">
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Parse raw unified diff to style it
        const domDiffText = alert.ai_explanation ? "Unified DOM Text Differences" : "DOM Diff Not Available";
        
        let actionButtonsHtml = "";
        if (alert.status === "open" && userRole === "admin") {
            actionButtonsHtml = `
                <button class="cyber-small-btn" onclick="reviewAlert(${alert.id})">MARK REVIEWED</button>
                <button class="cyber-small-btn btn-danger" onclick="dismissAlert(${alert.id})">DISMISS INCIDENT</button>
            `;
        } else if (alert.status !== "open") {
            actionButtonsHtml = `<span class="role-badge viewer">Incident ${alert.status}</span>`;
        } else {
            actionButtonsHtml = `<span class="text-muted">No Permissions to Resolve</span>`;
        }
        
        // Fetch diff block info
        let textDiffBlockHtml = "";
        // We will fetch snapshots details to compute diff text dynamically or load it
        textDiffBlockHtml = `
            <div class="dom-diff-section">
                <div class="dom-diff-header">
                    <span>${domDiffText}</span>
                    <button class="cyber-small-btn" onclick="toggleTextDiff(${alert.id})">Show/Hide Diff Text</button>
                </div>
                <div class="dom-diff-body" id="text-diff-body-${alert.id}" style="display: none;">
                    <pre class="dom-diff-pre" id="text-diff-pre-${alert.id}">Loading unified DOM diff lines...</pre>
                </div>
            </div>
        `;
        
        card.innerHTML = `
            <div class="alert-card-header">
                <div class="alert-card-title">
                    <h3>${escapeHtml(alert.asset_label)}</h3>
                    <span>Target URL: <a href="${escapeHtml(alert.asset_url)}" target="_blank" class="cyber-link">${escapeHtml(alert.asset_url)}</a></span>
                </div>
                <div class="alert-meta">
                    <span class="alert-severity ${alert.severity}">${alert.severity.toUpperCase()} RISK</span>
                    <span class="alert-timestamp">Flagged: ${formatTime(alert.created_at)}</span>
                </div>
            </div>
            <div class="alert-card-body">
                
                <div class="flex gap-15" style="margin-bottom: 20px;">
                    <div style="font-size: 0.95rem;">Visual Shift: <strong style="color: var(--color-pink);">${alert.diff_score}%</strong> of screen pixels changed.</div>
                    ${alert.snapshot_id_before ? `<button class="cyber-small-btn" id="toggle-overlay-btn-${alert.id}" onclick="toggleVisualOverlay(${alert.id})">Toggle Visual Diff Overlay</button>` : ''}
                </div>
                
                ${visualCompareHtml}
                
                <!-- AI report -->
                <div class="ai-report-panel">
                    <div class="ai-report-title">
                        <span>🛡️ AI VULNERABILITY ASSESSMENT REPORT</span>
                    </div>
                    <div class="ai-explanation-text">
                        ${escapeHtml(alert.ai_explanation || "Analyzing security risks...")}
                    </div>
                    <div class="ai-remediation-box">
                        <div class="remediation-title">Recommended Remediation Tasks</div>
                        <ul class="remediation-steps">
                            ${formatRemediation(alert.recommended_action)}
                        </ul>
                    </div>
                </div>
                
                ${textDiffBlockHtml}
                
                <div class="alert-actions-panel">
                    ${actionButtonsHtml}
                </div>
            </div>
        `;
        
        container.appendChild(card);
        
        // Lazy load unified text diff for this card
        if (alert.snapshot_id_before) {
            loadTextDiff(alert.id, alert.snapshot_id_before, alert.snapshot_id_after);
        }
    });
}

// Audit Logs
async function updateAuditLogs() {
    if (userRole !== "admin") return;
    
    const res = await apiFetch("/audit-logs");
    const logs = await res.json();
    
    const tbody = document.getElementById("audit-table-body");
    tbody.innerHTML = "";
    
    if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading-cell">No security operations logged.</td></tr>`;
        return;
    }
    
    logs.forEach(log => {
        const tr = document.createElement("tr");
        const date = formatTime(log.timestamp);
        
        tr.innerHTML = `
            <td><span style="font-family: var(--font-mono); font-size: 0.85rem;">${date}</span></td>
            <td><strong>${escapeHtml(log.user_email || "System/Daemon")}</strong></td>
            <td>${escapeHtml(log.action)}</td>
            <td><span class="role-badge viewer" style="font-family: var(--font-mono); font-size: 0.75rem;">${escapeHtml(log.target_type || "N/A")} ID: ${log.target_id || "N/A"}</span></td>
        `;
        tbody.appendChild(tr);
    });
}

// --- ACTIONS ---

async function handleAddAsset(e) {
    e.preventDefault();
    if (userRole !== "admin") return;
    
    const label = document.getElementById("asset-label").value;
    const url = document.getElementById("asset-url").value;
    
    try {
        const res = await apiFetch("/assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, url })
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Could not add website");
        }
        
        document.getElementById("asset-label").value = "";
        document.getElementById("asset-url").value = "";
        
        showToast("Site Registered", `Started monitoring site: ${label}`, "success");
        refreshData();
    } catch (err) {
        showToast("Error", err.message, "danger");
    }
}

async function deleteAsset(id) {
    if (userRole !== "admin") return;
    if (!confirm("Are you sure you want to stop monitoring this site and delete all historical snapshots/alerts?")) return;
    
    try {
        const res = await apiFetch(`/assets/${id}`, {
            method: "DELETE"
        });
        
        if (!res.ok) throw new Error("Could not delete asset");
        
        showToast("Site Deleted", "Asset removed from surveillance database.", "info");
        refreshData();
    } catch (err) {
        showToast("Error", err.message, "danger");
    }
}

async function triggerManualScan(id, button) {
    if (userRole !== "admin") return;
    
    const badge = document.getElementById(`asset-badge-${id}`);
    if (badge) {
        badge.className = "table-status-badge checking";
        badge.innerText = "checking";
    }
    
    button.disabled = true;
    const originalText = button.innerText;
    button.innerText = "SCANNING...";
    
    showToast("Scan Initialized", "Connecting headless runner to capture target screenshot...", "info");
    
    try {
        const res = await apiFetch(`/assets/${id}/snapshot`, {
            method: "POST"
        });
        
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Visual scan failed");
        }
        
        showToast("Scan Complete", "A new snapshot was taken and compared against baseline.", "success");
        refreshData();
    } catch (err) {
        showToast("Scan Failed", err.message, "danger");
        if (badge) {
            badge.className = "table-status-badge clean";
            badge.innerText = "clean";
        }
    } finally {
        button.disabled = false;
        button.innerText = originalText;
    }
}

async function dismissAlert(id) {
    if (userRole !== "admin") return;
    if (!confirm("Dismissing this alert will mark the visual/text modifications as acknowledged and flag the site as clean. Continue?")) return;
    
    try {
        const res = await apiFetch(`/alerts/${id}/dismiss`, {
            method: "POST"
        });
        if (!res.ok) throw new Error("Could not dismiss alert");
        
        showToast("Alert Dismissed", "Threat report cleared from incident center.", "success");
        refreshData();
    } catch (err) {
        showToast("Error", err.message, "danger");
    }
}

async function reviewAlert(id) {
    if (userRole !== "admin") return;
    
    try {
        const res = await apiFetch(`/alerts/${id}/review`, {
            method: "POST"
        });
        if (!res.ok) throw new Error("Could not review alert");
        
        showToast("Status Updated", "Incident marked as under review.", "info");
        refreshData();
    } catch (err) {
        showToast("Error", err.message, "danger");
    }
}

// --- UTILITY LOADERS & HELPERS ---

async function loadTextDiff(alertId, beforeId, afterId) {
    try {
        // We will fetch the snapshots and compute text diff or load it from backend
        // Since we already store snapshots in DB, we can write a quick endpoint or fetch them
        const resBefore = await apiFetch(`/assets/0/snapshots`); // placeholder or fetch specific snaps
        // Actually, let's fetch snapshots details to reconstruct diff
        // Let's create an endpoint in main.py, or we can compute it on frontend by fetching snapshot details.
        // Wait, let's fetch both snapshots content to compute it, or we can make a dedicated endpoint!
        // Wait, did we define a route for snapshots? Yes: GET /assets/:id/snapshots.
        // We can fetch snapshots from the asset and compare. But wait! Let's check how main.py handles it.
        // Actually, we can fetch snapshots. Let's make a dedicated API call to get snapshots text.
        // Let's add a quick endpoint `/snapshots/{snapshot_id}` in backend/main.py if we need it, or we can query it.
        // Wait, let's check backend/main.py. We have GET /assets/:id/snapshots. It returns snapshots of that asset!
        // We can search through the list of snapshots for matching IDs.
        // Let's do that! That's very clean and avoids adding endpoints.
        // Wait! Let's check if the snapshots returned contain the full text: yes, `dom_text` is returned in the snapshots list!
        // But the snapshots list can be huge. To make it extremely robust and fast, let's write a simple helper:
        // We can make a call to retrieve specific snapshots, or let's create a text diff viewer.
        // Let's implement an endpoint `GET /alerts/{alert_id}/diff` in main.py? 
        // No, wait, we don't need to change main.py if we can just fetch the snapshots.
        // Let's check if there is an easier way.
        // Wait! We did not add `/snapshots/{id}` in main.py, but we can easily add it!
        // Or, we can just edit main.py to return the diff text directly in the alert object!
        // Yes! Adding the DOM diff text or unified diff directly in the alert object is SO MUCH SIMPLER and cleaner!
        // Let's check if we can add a `dom_diff` field to the alerts query.
        // In the `alerts` table, we have `snapshot_id_before` and `snapshot_id_after`.
        // In the diff engine, we run `compare_dom_texts(prev_snap["dom_text"], snap_res["dom_text"])`.
        // But we did not save the text diff in the database alerts table.
        // Wait, we can fetch the snapshot texts in JavaScript and run a simple JS diff, OR
        // we can fetch the snapshots directly.
        // Let's check: how can we fetch specific snapshots in JS?
        // We can just call `GET /assets/{asset_id}/snapshots` and find the matching snapshots in JS!
        // Let's see: `alert.asset_id` is available.
        // So we can call `GET /assets/${alert.asset_id}/snapshots`.
        // Then we can find the snapshot with `id === alert.snapshot_id_before` and `id === alert.snapshot_id_after`.
        // Then we can run a text diff in JS, or we can add a small endpoint `GET /snapshots/{id}`.
        // Wait! Let's check if adding a `GET /snapshots/{id}` or `GET /alerts/{alert_id}/diff` in `main.py` is better.
        // Yes! Adding a route in `main.py` is extremely simple, and we can do it in a minute!
        // Let's see: what if we add:
        // @app.get("/snapshots/{snapshot_id}")
        // and return the snapshot row? That is super useful!
        // Let's verify if we can do that. Yes, absolutely!
        // Let's write the code to fetch snapshot details in app.js.
        // Let's check how we can do it.
    } catch (e) {
        console.error(e);
    }
}

// Let's write the real Javascript for loadTextDiff:
async function loadTextDiff(alertId, beforeId, afterId) {
    try {
        const pre = document.getElementById(`text-diff-pre-${alertId}`);
        if (!pre) return;
        
        // Fetch specific snapshots text from backend
        // We'll add GET /snapshots/{id} endpoint to main.py to make this work perfectly.
        const resBefore = await apiFetch(`/snapshots/${beforeId}`);
        const snapBefore = await resBefore.json();
        
        const resAfter = await apiFetch(`/snapshots/${afterId}`);
        const snapAfter = await resAfter.json();
        
        // Run a simple diff in JS, or since we have a python diff engine, we can fetch it,
        // or we can add a GET /alerts/{alert_id}/diff endpoint to main.py!
        // Yes! Let's add GET /alerts/{alert_id}/diff to main.py! It's much cleaner!
        const resDiff = await apiFetch(`/alerts/${alertId}/diff`);
        const diffData = await resDiff.json();
        
        renderDiffText(pre, diffData.diff);
    } catch (e) {
        const pre = document.getElementById(`text-diff-pre-${alertId}`);
        if (pre) pre.innerText = "Error loading text diff content.";
    }
}

function renderDiffText(preElement, diffText) {
    preElement.innerHTML = "";
    if (!diffText) {
        preElement.innerText = "No differences in text DOM content.";
        return;
    }
    
    const lines = diffText.split("\n");
    lines.forEach(line => {
        const span = document.createElement("span");
        if (line.startsWith("+")) {
            span.className = "diff-added";
            span.innerText = line + "\n";
        } else if (line.startsWith("-")) {
            span.className = "diff-removed";
            span.innerText = line + "\n";
        } else if (line.startsWith("@@")) {
            span.className = "diff-header";
            span.innerText = line + "\n";
        } else {
            span.innerText = line + "\n";
        }
        preElement.appendChild(span);
    });
}

function toggleTextDiff(alertId) {
    const el = document.getElementById(`text-diff-body-${alertId}`);
    if (el.style.display === "none") {
        el.style.display = "block";
    } else {
        el.style.display = "none";
    }
}

function toggleVisualOverlay(alertId) {
    const sideBySide = document.getElementById(`visual-compare-${alertId}`);
    const overlay = document.getElementById(`visual-diff-overlay-view-${alertId}`);
    const btn = document.getElementById(`toggle-overlay-btn-${alertId}`);
    
    if (sideBySide.style.display === "none") {
        sideBySide.style.display = "grid";
        overlay.style.display = "none";
        btn.innerText = "Toggle Visual Diff Overlay";
    } else {
        sideBySide.style.display = "none";
        overlay.style.display = "grid";
        btn.innerText = "Show Side-by-Side Screenshots";
    }
}

function filterAlerts(filter) {
    alertsFilter = filter;
    document.querySelectorAll(".filter-tab").forEach(tab => tab.classList.remove("active"));
    
    if (filter === "all") document.getElementById("filter-all-btn").classList.add("active");
    if (filter === "open") document.getElementById("filter-open-btn").classList.add("active");
    if (filter === "resolved") document.getElementById("filter-resolved-btn").classList.add("active");
    
    updateAlertsFeed();
}

function formatRemediation(remediationText) {
    if (!remediationText) return "<li>No specific actions suggested. Verify site logs.</li>";
    
    // Split by semicolons, bullet points, or newlines
    const steps = remediationText.split(/[;\n•]/);
    let html = "";
    steps.forEach(step => {
        const trimmed = step.trim();
        if (trimmed) {
            html += `<li>${escapeHtml(trimmed)}</li>`;
        }
    });
    return html || `<li>${escapeHtml(remediationText)}</li>`;
}

function formatTime(timestampStr) {
    try {
        // Handle timezone formats from SQLite
        const date = new Date(timestampStr.replace(" ", "T"));
        return date.toLocaleString();
    } catch (e) {
        return timestampStr;
    }
}

function getFilename(snapId, fullPath) {
    if (!fullPath) return "";
    return fullPath.split("/").pop();
}

function escapeHtml(str) {
    if (!str) return "";
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Modal zoom
function zoomImage(title, src) {
    const modal = document.getElementById("details-modal");
    const mTitle = document.getElementById("modal-title");
    const mBody = document.getElementById("modal-body");
    
    mTitle.innerText = title;
    mBody.innerHTML = `<img src="${src}" onerror="this.src='https://placehold.co/1200x800/png?text=Image+Load+Error'" style="width:100%; border-radius:4px;">`;
    modal.style.display = "block";
}

function closeModal() {
    document.getElementById("details-modal").style.display = "none";
}

// Close modal if clicked outside
window.onclick = function(event) {
    const modal = document.getElementById("details-modal");
    if (event.target === modal) {
        modal.style.display = "none";
    }
}

// Toast alerts
function showToast(title, body, type = "info") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    
    toast.innerHTML = `
        <div class="toast-title">${title}</div>
        <div class="toast-body">${body}</div>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
