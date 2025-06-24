// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    query,
    onSnapshot,
    setDoc,
    getDoc
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Initialization ---
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Element Selection ---
const authSection = document.getElementById('auth-section');
const appContainer = document.getElementById('app-container');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('loginBtn');
const signupBtn = document.getElementById('signupBtn');
const logoutBtn = document.getElementById('logoutBtn');
const authError = document.getElementById('auth-error');
const userEmailSpan = document.getElementById('user-email');

const montoVentaInput = document.getElementById('montoVenta');
const numeroFacturaInput = document.getElementById('numeroFacturaInput');
const clienteInput = document.getElementById('clienteInput');
const calcularBtn = document.getElementById('calcularBtn');
const resultadoDiv = document.getElementById('resultado');
const fileUploadInput = document.getElementById('fileUpload');
const fileUploadLabel = document.getElementById('fileUploadLabel');
const fileStatus = document.getElementById('file-status');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('apiKey');
const saveApiBtn = document.getElementById('saveApiBtn');
const historyBody = document.getElementById('history-body');
const historyTotal = document.getElementById('history-total');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyTable = document.querySelector('#history-container table');
const emptyHistoryMsg = document.getElementById('empty-history');

// New elements for Remuneracion Total
const remuneracionTotalInput = document.getElementById('remuneracionTotalInput');
const saveRemuneracionBtn = document.getElementById('saveRemuneracionBtn');

// Confirmation Modal Elements
const confirmationModal = document.getElementById('confirmation-modal');
const modalDialog = document.getElementById('modal-dialog');
const modalMessage = document.getElementById('modal-message');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// --- Global State ---
let apiKey = '';
let currentUser = null;
let unsubscribeHistory = null;
let currentUserSettings = { remuneracionTotal: 0 }; // Default settings

// --- Auth Functions ---
const handleSignup = async () => {
    try {
        authError.textContent = '';
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    } catch (error) {
        console.error("Signup error:", error);
        authError.textContent = "Error al registrar: " + error.message;
    }
};

const handleLogin = async () => {
    try {
        authError.textContent = '';
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    } catch (error) {
        console.error("Login error:", error);
        authError.textContent = "Error al iniciar sesión: " + error.message;
    }
};

const handleLogout = async () => {
    await signOut(auth);
};

// --- Modal Logic ---
function showConfirmationModal(message, onConfirmCallback) {
    modalMessage.textContent = message;
    modalConfirmBtn.onclick = () => {
        onConfirmCallback();
        hideConfirmationModal();
    };
    confirmationModal.classList.remove('hidden');
    setTimeout(() => {
        confirmationModal.classList.remove('opacity-0');
        modalDialog.classList.remove('scale-95');
    }, 10);
}

function hideConfirmationModal() {
    confirmationModal.classList.add('opacity-0');
    modalDialog.classList.add('scale-95');
    setTimeout(() => {
        confirmationModal.classList.add('hidden');
    }, 300);
}

// --- App Logic ---
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

function formatCurrency(value) {
    if (typeof value !== 'number') return '$0.00';
    return value.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS'
    });
}

// --- User Settings ---
async function saveUserSettings() {
    if (!currentUser) return;
    const newRemuneracion = parseFloat(remuneracionTotalInput.value);
    if (isNaN(newRemuneracion) || newRemuneracion < 0) {
        showError("Por favor, ingresa un valor de remuneración válido.");
        return;
    }
    
    try {
        const settingsRef = doc(db, 'userSettings', currentUser.uid);
        await setDoc(settingsRef, { remuneracionTotal: newRemuneracion }, { merge: true });
        currentUserSettings.remuneracionTotal = newRemuneracion;
        alert('¡Remuneración guardada con éxito!'); // Simple feedback
        settingsPanel.classList.add('hidden');
    } catch (error) {
        console.error("Error saving settings:", error);
        showError("No se pudo guardar la configuración.");
    }
}

async function loadUserSettings() {
    if (!currentUser) return;
    const settingsRef = doc(db, 'userSettings', currentUser.uid);
    const docSnap = await getDoc(settingsRef);

    if (docSnap.exists()) {
        currentUserSettings = docSnap.data();
    } else {
        // Use default if no settings found
        currentUserSettings = { remuneracionTotal: 0 };
    }
    remuneracionTotalInput.value = currentUserSettings.remuneracionTotal || 0;
}


// --- History & Data Functions ---
function renderHistory(commissionHistory) {
    historyBody.innerHTML = '';
    const hasHistory = commissionHistory.length > 0;
    historyTable.classList.toggle('hidden', !hasHistory);
    emptyHistoryMsg.classList.toggle('hidden', hasHistory);
    
    if (!hasHistory) {
        historyTotal.textContent = formatCurrency(0);
        return;
    }

    let total = 0;
    commissionHistory.forEach(item => {
        const row = document.createElement('tr');
        row.classList.add('fade-in');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.numeroFactura || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.nombreCliente || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${formatCurrency(item.montoVenta)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${formatCurrency(item.remuneracionTotal)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">${formatCurrency(item.comisionCalculada)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                <button data-id="${item.id}" class="text-red-600 hover:text-red-900 delete-btn">Eliminar</button>
            </td>
        `;
        historyBody.appendChild(row);
        total += item.comisionCalculada;
    });
    historyTotal.textContent = formatCurrency(total);

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            showConfirmationModal(
                '¿Estás seguro de que quieres eliminar esta comisión?',
                () => deleteCommission(docId)
            );
        });
    });
}

async function saveCommission(commissionData) {
    if (!currentUser) return;
    try {
        const userHistoryCollection = collection(db, 'users', currentUser.uid, 'history');
        await addDoc(userHistoryCollection, commissionData);
    } catch (error) {
        console.error("Error saving commission: ", error);
        showError("No se pudo guardar la comisión.");
    }
}

function loadHistory() {
    if (!currentUser) return;
    if (unsubscribeHistory) unsubscribeHistory();

    const userHistoryCollection = collection(db, 'users', currentUser.uid, 'history');
    const q = query(userHistoryCollection);

    unsubscribeHistory = onSnapshot(q, (snapshot) => {
        const commissionHistory = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        renderHistory(commissionHistory);
    });
}

async function deleteCommission(docId) {
    if (!currentUser) return;
    try {
        const docRef = doc(db, 'users', currentUser.uid, 'history', docId);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("Error deleting commission:", error);
        showError("No se pudo eliminar la comisión.");
    }
}

async function doClearAllHistory() {
    if (!currentUser) return;
    try {
        const userHistoryCollection = collection(db, 'users', currentUser.uid, 'history');
        const snapshot = await getDocs(userHistoryCollection);
        const deletePromises = snapshot.docs.map(document => 
            deleteDoc(doc(db, 'users', currentUser.uid, 'history', document.id))
        );
        await Promise.all(deletePromises);
    } catch (error) {
        console.error("Error clearing history:", error);
        showError("Ocurrió un error al borrar el historial.");
    }
}

async function handleCalculate() {
    resultadoDiv.innerHTML = '';
    const montoVenta = parseFloat(montoVentaInput.value);
    const numeroFactura = numeroFacturaInput.value.trim();
    const nombreCliente = clienteInput.value.trim();
    const remuneracionTotal = currentUserSettings.remuneracionTotal || 0;

    if (isNaN(montoVenta) || montoVenta <= 0) {
        showError('Ingresa un monto de venta válido.');
        return;
    }
    
    if (remuneracionTotal <= 0) {
        showError('No has configurado una "Remuneración Total" en los ajustes (⚙️).');
        return;
    }

    // New Formula Calculation
    const comisionPorVenta = montoVenta * 0.8266 * 0.007;
    const comisionAdicional = (remuneracionTotal * 0.0025) * 0.005;
    const comisionTotal = comisionPorVenta + comisionAdicional;

    const newCommission = {
        numeroFactura,
        nombreCliente,
        montoVenta,
        remuneracionTotal: remuneracionTotal, // Save the remuneration used for this calculation
        comisionCalculada: comisionTotal,
        createdAt: new Date()
    };

    await saveCommission(newCommission);
    showResult(comisionTotal);

    montoVentaInput.value = '';
    numeroFacturaInput.value = '';
    clienteInput.value = '';
    numeroFacturaInput.focus();
}

function showResult(comision) {
    resultadoDiv.innerHTML = `<div class="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg fade-in"><p class="font-semibold">Última Comisión Calculada:</p><p class="text-3xl font-bold mt-1">${formatCurrency(comision)}</p></div>`;
}

function showError(message) {
    resultadoDiv.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg fade-in"><p class="font-semibold">Error</p><p>${message}</p></div>`;
}

// --- Settings & API Key Functions ---
function checkApiKey() {
    apiKey = localStorage.getItem('googleApiKey');
    const hasApiKey = !!apiKey;

    fileUploadInput.disabled = !hasApiKey;
    fileUploadLabel.classList.toggle('opacity-50', !hasApiKey);
    fileUploadLabel.classList.toggle('cursor-not-allowed', !hasApiKey);
    fileUploadLabel.classList.toggle('hover:bg-gray-900', hasApiKey);
    fileStatus.textContent = hasApiKey 
        ? 'IA lista para analizar archivos.' 
        : 'Se necesita una API Key para usar la IA. Ve a ⚙️.';
}

function saveApiKey() {
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey) {
        localStorage.setItem('googleApiKey', newApiKey);
        fileStatus.textContent = '✅ Clave guardada. ¡IA activada!';
    } else {
        localStorage.removeItem('googleApiKey');
        fileStatus.textContent = 'Clave eliminada. La IA está desactivada.';
    }
    checkApiKey();
    settingsPanel.classList.add('hidden');
}

// --- AI & File Processing Functions ---
async function extractTextFromPdf(file) {
    // ... (This function remains the same)
}

function processAIResponse(jsonResponse) {
    if (jsonResponse.montoVenta != null) montoVentaInput.value = jsonResponse.montoVenta;
    // Removed quantity of articles as it's no longer in the form
    fileStatus.textContent = '✅ ¡Información extraída con éxito!';
}

async function callGenerativeAI(payload) {
    // ... (This function remains the same, but will be called with a new schema)
}

async function extractInfoFromText(text) {
    const prompt = `Analiza el siguiente texto de una factura y extrae el campo 'montoVenta'. Devuelve un objeto JSON. 'montoVenta' es el valor numérico junto a la palabra 'TOTAL'. Trata la coma como separador decimal. Texto a analizar: --- ${text.substring(0, 8000)} ---`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    montoVenta: { type: "NUMBER" }
                }
            }
        },
    };
    await callGenerativeAI(payload);
}

async function extractInfoFromImage(base64Data, mimeType) {
    const prompt = `Analiza la siguiente imagen de una factura y extrae el campo 'montoVenta'. Devuelve un objeto JSON. 'montoVenta' es el valor numérico junto a la palabra 'TOTAL'. Trata la coma como separador decimal.`;
    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    montoVenta: { type: "NUMBER" }
                }
            }
        },
    };
    await callGenerativeAI(payload);
}

const handleFileUpload = async (event) => {
    // ... (This function remains largely the same, but the AI calls inside will use the new logic)
};


// --- Event Listeners Setup ---
function addEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    signupBtn.addEventListener('click', handleSignup);
    logoutBtn.addEventListener('click', handleLogout);
    
    settingsBtn.addEventListener('click', () => {
        settingsPanel.classList.toggle('hidden');
        if (!settingsPanel.classList.contains('hidden')) {
            apiKeyInput.value = localStorage.getItem('googleApiKey') || '';
            remuneracionTotalInput.value = currentUserSettings.remuneracionTotal || 0;
        }
    });

    saveApiBtn.addEventListener('click', saveApiKey);
    saveRemuneracionBtn.addEventListener('click', saveUserSettings); // New listener
    fileUploadInput.addEventListener('change', handleFileUpload);
    calcularBtn.addEventListener('click', handleCalculate);
    
    clearHistoryBtn.addEventListener('click', () => {
        showConfirmationModal(
            '¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.',
            doClearAllHistory 
        );
    });

    modalCancelBtn.addEventListener('click', hideConfirmationModal);

    montoVentaInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') calcularBtn.click();
    });
}

// --- Main Initialization ---
onAuthStateChanged(auth, async (user) => {
    const isAuthenticated = !!user;
    
    authSection.classList.toggle('hidden', isAuthenticated);
    appContainer.classList.toggle('hidden', !isAuthenticated);

    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;
        checkApiKey();
        await loadUserSettings(); // Load user-specific settings
        loadHistory();
    } else {
        currentUser = null;
        if (unsubscribeHistory) unsubscribeHistory();
        renderHistory([]);
        currentUserSettings = { remuneracionTotal: 0 }; // Reset settings on logout
    }
});

document.addEventListener('DOMContentLoaded', addEventListeners);
