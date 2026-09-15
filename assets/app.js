const supabaseClient = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
let currentUser = null;
let currentProfile = null;
const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[char]));
const formatDate = value => value ? new Date(value).toLocaleString() : "-";
const badge = value => `<span class="badge ${String(value).toLowerCase()}">${esc(value)}</span>`;
const roles = ["Administrator", "Laboratory Staff", "Requester / Viewer"];

async function init() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) await loadUser(session.user); else showLogin();
    supabaseClient.auth.onAuthStateChange(async (_event, nextSession) => nextSession ? loadUser(nextSession.user) : showLogin());
}
async function loadUser(user) {
    currentUser = user;
    const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", user.id).single();
    if (error || !data) {
        $("loginMessage").textContent = "Profile not found. Run sql/fix_missing_profiles.sql in Supabase SQL Editor.";
        await supabaseClient.auth.signOut();
        return;
    }
    currentProfile = data;
    $("loginView").classList.add("hidden");
    $("dashboardView").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");
    $("userInfo").textContent = `${data.full_name} • ${data.role}`;
    renderNav();
    openPage("dashboard");
}
function showLogin() {
    $("loginView").classList.remove("hidden");
    $("dashboardView").classList.add("hidden");
    $("logoutBtn").classList.add("hidden");
    $("userInfo").textContent = "Please sign in.";
}
function renderNav() {
    const pages = ["dashboard", "equipment"];
    if (currentProfile.role === "Administrator") pages.push("requests", "maintenance", "users", "audit");
    if (currentProfile.role === "Laboratory Staff") pages.push("requests", "returns", "maintenance");
    if (currentProfile.role === "Requester / Viewer") pages.push("myrequests");
    const labels = { dashboard: "Dashboard", equipment: "Equipment", requests: "Borrowing Requests", myrequests: "My Requests", returns: "Returns", maintenance: "Maintenance", users: "Manage Users", audit: "Audit Logs" };
    $("nav").innerHTML = pages.map(page => `<button data-page="${page}">${labels[page]}</button>`).join("");
    $("nav").querySelectorAll("button").forEach(button => button.onclick = () => openPage(button.dataset.page));
}
function deny() { $("content").innerHTML = "<div class=\"card\"><h2>Access Denied</h2></div>"; }
async function openPage(page) {
    $("nav").querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.page === page));
    const allowed = { Administrator: ["dashboard", "equipment", "requests", "maintenance", "users", "audit"], "Laboratory Staff": ["dashboard", "equipment", "requests", "returns", "maintenance"], "Requester / Viewer": ["dashboard", "equipment", "myrequests"] };
    if (!allowed[currentProfile.role]?.includes(page)) return deny();
    return ({ dashboard, equipment, requests, myrequests: myRequests, returns: returnsPage, maintenance, users, audit }[page])();
}
async function dashboard() {
    const [{ data: equipmentData = [] }, { data: requestData = [] }] = await Promise.all([supabaseClient.from("equipment").select("id,status"), supabaseClient.from("borrowing_requests").select("id,status")]);
    $("content").innerHTML = `<div class="card"><h2>Dashboard</h2><div class="grid"><div class="stat">Equipment<strong>${equipmentData.length}</strong></div><div class="stat">Available<strong>${equipmentData.filter(item => item.status === "Available").length}</strong></div><div class="stat">Pending Requests<strong>${requestData.filter(item => item.status === "Pending").length}</strong></div><div class="stat">Borrowed<strong>${equipmentData.filter(item => item.status === "Borrowed").length}</strong></div></div></div>`;
}
async function equipment() {
    const { data = [], error } = await supabaseClient.from("equipment").select("*").order("id");
    if (error) return showError(error);
    const admin = currentProfile.role === "Administrator";
    const addForm = admin ? `<div class="card"><h3>Add Equipment</h3><form id="equipmentForm"><div class="form-row"><label>ID<input id="equipmentId" required></label><label>Name<input id="equipmentName" required></label></div><div class="form-row"><label>Condition<select id="equipmentCondition"><option>Good</option><option>For Repair</option><option>Damaged</option><option>Unserviceable</option></select></label><label>Status<select id="equipmentStatus"><option>Available</option><option>Maintenance</option><option>Unserviceable</option></select></label></div><button>Add Equipment</button></form></div>` : "";
    const editForm = admin ? `<div class="card hidden" id="editEquipmentCard"><h3>Edit Equipment</h3><form id="editEquipmentForm"><div class="form-row"><label>ID<input id="editEquipmentId" readonly></label><label>Name<input id="editEquipmentName" required></label></div><div class="form-row"><label>Condition<select id="editEquipmentCondition"><option>Good</option><option>For Repair</option><option>Damaged</option><option>Unserviceable</option></select></label><label>Status<select id="editEquipmentStatus"><option>Available</option><option>Borrowed</option><option>Maintenance</option><option>Unserviceable</option></select></label></div><button class="success">Save Changes</button> <button type="button" class="secondary" onclick="cancelEditEquipment()">Cancel</button></form></div>` : "";
    const rows = data.map(item => `<tr><td>${esc(item.id)}</td><td>${esc(item.name)}</td><td>${esc(item.condition)}</td><td>${badge(item.status)}</td>${admin ? `<td><button onclick="editEquipment('${esc(item.id)}')">Edit</button> <button class="danger" onclick="deleteEquipment('${esc(item.id)}')">Delete</button></td>` : ""}</tr>`).join("");
    $("content").innerHTML = `${addForm}${editForm}<div class="card"><h2>Equipment</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Name</th><th>Condition</th><th>Status</th>${admin ? "<th>Action</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
    if ($("equipmentForm")) $("equipmentForm").onsubmit = async event => { event.preventDefault(); const { error: insertError } = await supabaseClient.from("equipment").insert({ id: $("equipmentId").value.trim(), name: $("equipmentName").value.trim(), condition: $("equipmentCondition").value, status: $("equipmentStatus").value }); if (insertError) return alert(insertError.message); await logAction("CREATED", "Equipment", $("equipmentId").value, "Created equipment"); equipment(); };
    if ($("editEquipmentForm")) $("editEquipmentForm").onsubmit = async event => { event.preventDefault(); const id = $("editEquipmentId").value; const { error: updateError } = await supabaseClient.from("equipment").update({ name: $("editEquipmentName").value.trim(), condition: $("editEquipmentCondition").value, status: $("editEquipmentStatus").value }).eq("id", id); if (updateError) return alert(updateError.message); await logAction("UPDATED", "Equipment", id, "Updated equipment"); equipment(); };
}
async function editEquipment(id) {
    const { data, error } = await supabaseClient.from("equipment").select("*").eq("id", id).single();
    if (error) return alert(error.message);
    $("editEquipmentId").value = data.id;
    $("editEquipmentName").value = data.name;
    $("editEquipmentCondition").value = data.condition;
    $("editEquipmentStatus").value = data.status;
    $("editEquipmentCard").classList.remove("hidden");
    $("editEquipmentCard").scrollIntoView({ behavior: "smooth", block: "start" });
}
function cancelEditEquipment() { $("editEquipmentCard").classList.add("hidden"); }
async function deleteEquipment(id) { if (!confirm(`Delete ${id}?`)) return; const { error } = await supabaseClient.from("equipment").delete().eq("id", id); if (error) return alert(error.message); await logAction("DELETED", "Equipment", id, "Deleted equipment"); equipment(); }
async function availableEquipment() { const { data = [] } = await supabaseClient.from("equipment").select("id,name").eq("status", "Available").order("id"); return data; }
async function requests() {
    const { data = [], error } = await supabaseClient.from("borrowing_requests").select("*, equipment(name,id), requester:profiles!requester_id(full_name)").order("created_at", { ascending: false });
    if (error) return showError(error);
    const rowsWithActions = data.map(request => { let action = ""; if (currentProfile.role === "Administrator" && request.status === "Pending") action = `<button class="success" onclick="changeRequest(${request.id},'Approved')">Approve</button> <button class="danger" onclick="changeRequest(${request.id},'Rejected')">Reject</button>`; if (currentProfile.role === "Laboratory Staff" && request.status === "Approved") action = `<button onclick="changeRequest(${request.id},'Released')">Release</button>`; return { request, action }; });
    const hasActions = rowsWithActions.some(row => row.action);
    const rows = rowsWithActions.map(({ request, action }) => `<tr><td>${request.id}</td><td>${esc(request.equipment?.id)} - ${esc(request.equipment?.name)}</td><td>${esc(request.requester?.full_name)}</td><td>${esc(request.purpose)}</td><td>${formatDate(request.due_at)}</td><td>${badge(request.status)}</td>${hasActions ? `<td>${action}</td>` : ""}</tr>`).join("");
    $("content").innerHTML = `<div class="card"><h2>Borrowing Requests</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Equipment</th><th>Requester</th><th>Details</th><th>Due</th><th>Status</th>${hasActions ? "<th>Action</th>" : ""}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
async function myRequests() {
    const [{ data = [], error }, available] = await Promise.all([supabaseClient.from("borrowing_requests").select("*, equipment(name,id)").eq("requester_id", currentUser.id).order("created_at", { ascending: false }), availableEquipment()]);
    if (error) return showError(error);
    $("content").innerHTML = `<div class="card"><h2>Submit Borrowing Request</h2><form id="requestForm"><label>Equipment<select id="requestEquipment" required>${available.map(item => `<option value="${esc(item.id)}">${esc(item.id)} - ${esc(item.name)}</option>`).join("")}</select></label><label>Purpose / Details<textarea id="requestPurpose" required></textarea></label><label>Return Date and Time<input id="requestDue" type="datetime-local" required></label><button>Submit Request</button></form></div><div class="card"><h2>My Borrowing History</h2><div class="table-wrap"><table><thead><tr><th>ID</th><th>Equipment</th><th>Details</th><th>Due</th><th>Status</th><th>Submitted</th></tr></thead><tbody>${data.map(request => `<tr><td>${request.id}</td><td>${esc(request.equipment?.id)} - ${esc(request.equipment?.name)}</td><td>${esc(request.purpose)}</td><td>${formatDate(request.due_at)}</td><td>${badge(request.status)}</td><td>${formatDate(request.created_at)}</td></tr>`).join("")}</tbody></table></div></div>`;
    $("requestForm").onsubmit = async event => { event.preventDefault(); const { data: request, error: insertError } = await supabaseClient.from("borrowing_requests").insert({ requester_id: currentUser.id, equipment_id: $("requestEquipment").value, purpose: $("requestPurpose").value.trim(), due_at: new Date($("requestDue").value).toISOString(), status: "Pending" }).select().single(); if (insertError) return alert(insertError.message); await logAction("SUBMITTED", "Borrowing", request.id, "Submitted borrowing request"); myRequests(); };
}
async function changeRequest(id, status) {
    const { data: request, error } = await supabaseClient.from("borrowing_requests").select("*").eq("id", id).single();
    if (error) return alert(error.message);
    if (["Approved", "Rejected"].includes(status) && (currentProfile.role !== "Administrator" || request.status !== "Pending")) return deny();
    if (status === "Released" && (currentProfile.role !== "Laboratory Staff" || request.status !== "Approved")) return deny();
    const update = status === "Approved" ? { status, approved_by: currentUser.id, approved_at: new Date().toISOString() } : { status };
    const { error: updateError } = await supabaseClient.from("borrowing_requests").update(update).eq("id", id);
    if (updateError) return alert(updateError.message);
    if (status === "Released") { const { error: equipmentError } = await supabaseClient.from("equipment").update({ status: "Borrowed" }).eq("id", request.equipment_id); if (equipmentError) return alert(equipmentError.message); }
    await logAction(status.toUpperCase(), "Borrowing", id, `${status} request for ${request.equipment_id}`); requests();
}
async function returnsPage() {
    const { data = [], error } = await supabaseClient.from("borrowing_requests").select("*, equipment(name,id)").eq("status", "Released").order("created_at");
    if (error) return showError(error);
    $("content").innerHTML = `<div class="card"><h2>Process Returns</h2><div class="table-wrap"><table><thead><tr><th>Request</th><th>Equipment</th><th>Due</th><th>Action</th></tr></thead><tbody>${data.map(request => `<tr><td>${request.id}</td><td>${esc(request.equipment?.id)} - ${esc(request.equipment?.name)}</td><td>${formatDate(request.due_at)}</td><td><button class="success" onclick="returnItem(${request.id},'${esc(request.equipment_id)}')">Process Return</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
async function returnItem(requestId, equipmentId) {
    const condition = prompt("Return condition: Good or Damaged", "Good");
    if (!["Good", "Damaged"].includes(condition)) return alert("Choose Good or Damaged.");
    const { error: requestError } = await supabaseClient.from("borrowing_requests").update({ status: "Returned", returned_at: new Date().toISOString() }).eq("id", requestId).eq("status", "Released");
    if (requestError) return alert(requestError.message);
    const { error: equipmentError } = await supabaseClient.from("equipment").update({ status: condition === "Damaged" ? "Maintenance" : "Available", condition }).eq("id", equipmentId).eq("status", "Borrowed");
    if (equipmentError) return alert(equipmentError.message);
    await logAction("RETURNED", "Borrowing", requestId, `Returned ${equipmentId}; condition ${condition}`); returnsPage();
}
async function maintenance() {
    const { data = [], error } = await supabaseClient.from("maintenance_requests").select("*, equipment(name,id), requester:profiles!requester_id(full_name)").order("created_at", { ascending: false });
    if (error) return showError(error);
    const { data: equipmentData = [], error: equipmentError } = await supabaseClient.from("equipment").select("id,name,status").order("id");
    if (equipmentError) return showError(equipmentError);
    const equipmentOptions = equipmentData.map(item => `<option value="${esc(item.id)}">${esc(item.id)} - ${esc(item.name)} (${esc(item.status)})</option>`).join("");
    const form = currentProfile.role === "Laboratory Staff" ? `<form id="maintenanceForm"><label>Equipment<select id="maintenanceEquipment" required>${equipmentOptions}</select></label><label>Issue Description<textarea id="maintenanceDescription" required></textarea></label><button ${equipmentData.length ? "" : "disabled"}>Submit Maintenance Request</button>${equipmentData.length ? "" : "<p class=\"message\">No equipment records are available.</p>"}</form>` : "";
    const maintenanceRows = data.map(item => `<tr><td>${item.id}</td><td>${esc(item.equipment?.id)} - ${esc(item.equipment?.name)}</td><td>${esc(item.requester?.full_name)}</td><td>${esc(item.description)}</td><td>${esc(item.status)}</td>${currentProfile.role === "Administrator" ? `<td><select id="maintenanceStatus-${item.id}"><option ${item.status === "Pending" ? "selected" : ""}>Pending</option><option ${item.status === "In Progress" ? "selected" : ""}>In Progress</option><option ${item.status === "Completed" ? "selected" : ""}>Completed</option><option ${item.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select><button onclick="updateMaintenance(${item.id})">Save</button></td>` : ""}</tr>`).join("");
    $("content").innerHTML = `<div class="card"><h2>Maintenance Requests</h2>${form}</div><div class="card"><div class="table-wrap"><table><thead><tr><th>ID</th><th>Equipment</th><th>Requester</th><th>Description</th><th>Status</th>${currentProfile.role === "Administrator" ? "<th>Action</th>" : ""}</tr></thead><tbody>${maintenanceRows}</tbody></table></div></div>`;
    if ($("maintenanceForm")) $("maintenanceForm").onsubmit = async event => { event.preventDefault(); const equipmentId = $("maintenanceEquipment").value; const { data: equipmentRecord, error: equipmentLookupError } = await supabaseClient.from("equipment").select("id").eq("id", equipmentId).maybeSingle(); if (equipmentLookupError) return alert(equipmentLookupError.message); if (!equipmentRecord) return alert("Please choose an existing equipment record."); const { data: request, error: insertError } = await supabaseClient.from("maintenance_requests").insert({ equipment_id: equipmentRecord.id, requester_id: currentUser.id, description: $("maintenanceDescription").value.trim() }).select().single(); if (insertError) return alert(insertError.message); const { error: equipmentUpdateError } = await supabaseClient.from("equipment").update({ status: "Maintenance", condition: "For Repair" }).eq("id", equipmentRecord.id); if (equipmentUpdateError) return alert(equipmentUpdateError.message); await logAction("SUBMITTED", "Maintenance", request.id, "Submitted maintenance request; equipment set to Maintenance"); maintenance(); };
}
async function updateMaintenance(id) { const status = $(`maintenanceStatus-${id}`).value; const { data: request, error: requestError } = await supabaseClient.from("maintenance_requests").select("equipment_id").eq("id", id).single(); if (requestError) return alert(requestError.message); const { error } = await supabaseClient.from("maintenance_requests").update({ status }).eq("id", id); if (error) return alert(error.message); const equipmentUpdate = status === "Completed" ? { status: "Available", condition: "Good" } : status === "Cancelled" ? { status: "Available" } : { status: "Maintenance", condition: "For Repair" }; const { error: equipmentError } = await supabaseClient.from("equipment").update(equipmentUpdate).eq("id", request.equipment_id); if (equipmentError) return alert(equipmentError.message); await logAction("UPDATED", "Maintenance", id, `Set maintenance status to ${status}; equipment updated`); maintenance(); }
async function users() {
    const { data = [], error } = await supabaseClient.from("profiles").select("*").order("created_at");
    if (error) return showError(error);
    $("content").innerHTML = `<div class="card"><h2>Manage Users</h2><p class="muted">Create accounts in Supabase Authentication, then assign roles here.</p><div class="table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Action</th></tr></thead><tbody>${data.map(profile => `<tr><td>${esc(profile.full_name)}</td><td><select id="role-${profile.id}">${roles.map(role => `<option ${role === profile.role ? "selected" : ""}>${role}</option>`).join("")}</select></td><td><button onclick="updateUser('${profile.id}')">Save</button></td></tr>`).join("")}</tbody></table></div></div>`;
}
async function updateUser(id) { const { error } = await supabaseClient.from("profiles").update({ role: $(`role-${id}`).value }).eq("id", id); if (error) return alert(error.message); await logAction("UPDATED", "Users", id, "Updated user role"); users(); }
async function audit() { const { data = [], error } = await supabaseClient.from("audit_logs").select("*, profiles(full_name)").order("created_at", { ascending: false }); if (error) return showError(error); $("content").innerHTML = `<div class="card"><h2>Audit Logs</h2><div class="table-wrap"><table><thead><tr><th>Date</th><th>User</th><th>Action</th><th>Module</th><th>Description</th></tr></thead><tbody>${data.map(item => `<tr><td>${formatDate(item.created_at)}</td><td>${esc(item.profiles?.full_name)}</td><td>${esc(item.action)}</td><td>${esc(item.module)}</td><td>${esc(item.description)}</td></tr>`).join("")}</tbody></table></div></div>`; }
async function logAction(action, module, recordId, description) { await supabaseClient.from("audit_logs").insert({ user_id: currentUser.id, action, module, record_id: String(recordId), description }); }
function showError(error) { $("content").innerHTML = `<div class="card"><p class="message">Error: ${esc(error.message)}</p></div>`; }
$("loginForm").onsubmit = async event => { event.preventDefault(); $("loginMessage").textContent = "Signing in..."; const { error } = await supabaseClient.auth.signInWithPassword({ email: $("email").value, password: $("password").value }); $("loginMessage").textContent = error ? error.message : ""; };
$("logoutBtn").onclick = () => supabaseClient.auth.signOut();
init();
