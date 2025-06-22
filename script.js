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
    onSnapshot
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// --- Firebase Initialization ---
// The 'firebaseConfig' variable is now loaded from the 'firebase-config.js' file.
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
const cantidadArticulosInput = document.getElementById('cantidadArticulos');
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

// --- Global State ---
let apiKey = '';
let currentUser = null;
let unsubscribeHistory = null;

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


// --- App Logic ---

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

function formatCurrency(value) {
    return value.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS'
    });
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
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.cantidadArticulos}</td>
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
            if (confirm('¿Estás seguro de que quieres eliminar esta comisión?')) {
                deleteCommission(docId);
            }
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

async function clearAllHistory() {
    if (!currentUser || !confirm('¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.')) return;

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
    const cantidadArticulos = parseInt(cantidadArticulosInput.value, 10);
    const numeroFactura = numeroFacturaInput.value.trim();
    const nombreCliente = clienteInput.value.trim();

    if (isNaN(montoVenta) || montoVenta <= 0) {
        showError('Ingresa un monto de venta válido.');
        return;
    }
    if (isNaN(cantidadArticulos) || cantidadArticulos < 0) {
        showError('Ingresa una cantidad de artículos válida.');
        return;
    }

    const comisionTotal = (montoVenta * 0.8266 * 0.007) + (cantidadArticulos * 20);

    const newCommission = {
        numeroFactura,
        nombreCliente,
        montoVenta,
        cantidadArticulos,
        comisionCalculada: comisionTotal,
        createdAt: new Date()
    };

    await saveCommission(newCommission);
    showResult(comisionTotal);

    montoVentaInput.value = '';
    cantidadArticulosInput.value = '';
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


/**
 * Extracts text from the first page of a PDF file.
 * @param {File} file The PDF file object.
 * @returns {Promise<string>} A promise that resolves with the extracted text.
 */
async function extractTextFromPdf(file) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                if (pdf.numPages === 0) {
                    return reject(new Error("El PDF no tiene páginas."));
                }
                const page = await pdf.getPage(1);
                const textContent = await page.getTextContent();
                resolve(textContent.items.map(item => item.str).join(' '));
            } catch (error) {
                reject(error);
            }
        };
        fileReader.onerror = () => reject(new Error("Error al leer el archivo."));
        fileReader.readAsArrayBuffer(file);
    });
}

/**
 * Common function to process the JSON response from the AI.
 * @param {object} jsonResponse The parsed JSON object from the AI.
 */
function processAIResponse(jsonResponse) {
    if (jsonResponse.montoVenta != null) montoVentaInput.value = jsonResponse.montoVenta;
    if (jsonResponse.cantidadArticulos != null) cantidadArticulosInput.value = jsonResponse.cantidadArticulos;
    fileStatus.textContent = '✅ ¡Información extraída con éxito!';
}

/**
 * Generic function to call the Google AI API with a given payload.
 * @param {object} payload The payload for the API call.
 */
async function callGenerativeAI(payload) {
    if (!apiKey) {
        showError("No hay una API Key configurada para la IA.");
        return;
    }
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
        
        const result = await response.json();
        
        if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
            const jsonResponse = JSON.parse(result.candidates[0].content.parts[0].text);
            processAIResponse(jsonResponse);
        } else {
            throw new Error("La respuesta de la IA no tuvo el formato esperado.");
        }
    } catch (error) {
        console.error("Error llamando a la IA:", error);
        showError("La IA no pudo extraer los datos. Revisa tu API Key y el formato del archivo.");
        fileStatus.textContent = "Error en el análisis.";
    }
}

/**
 * Prepares the payload for text-based AI extraction and calls the AI.
 * @param {string} text The text extracted from the PDF.
 */
async function extractInfoFromText(text) {
    const prompt = `Analiza el siguiente texto de una factura y extrae los campos 'cantidadArticulos' y 'montoVenta'. Devuelve un objeto JSON. 'cantidadArticulos' es la suma de la columna 'Cantidad'. 'montoVenta' es el valor numérico junto a la palabra 'TOTAL'. Trata la coma como separador decimal. Texto a analizar: --- ${text.substring(0, 8000)} ---`;
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    montoVenta: { type: "NUMBER" },
                    cantidadArticulos: { type: "NUMBER" }
                }
            }
        },
    };
    await callGenerativeAI(payload);
}

/**
 * Prepares the payload for image-based AI extraction and calls the AI.
 * @param {string} base64Data The Base64 encoded image data.
 * @param {string} mimeType The MIME type of the image.
 */
async function extractInfoFromImage(base64Data, mimeType) {
    const prompt = `Analiza la siguiente imagen de una factura y extrae los campos 'cantidadArticulos' y 'montoVenta'. Devuelve un objeto JSON. 'cantidadArticulos' es la suma de la columna 'Cantidad'. 'montoVenta' es el valor numérico junto a la palabra 'TOTAL'. Trata la coma como separador decimal.`;
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
                    montoVenta: { type: "NUMBER" },
                    cantidadArticulos: { type: "NUMBER" }
                }
            }
        },
    };
    await callGenerativeAI(payload);
}

/**
 * Handles the file upload event, detecting file type and routing appropriately.
 * @param {Event} event The change event from the file input.
 */
const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const fileType = file.type;
    fileStatus.textContent = `📖 Leyendo ${file.name}...`;
    resultadoDiv.innerHTML = '';

    try {
        if (fileType === 'application/pdf') {
            const pdfText = await extractTextFromPdf(file);
            fileStatus.textContent = '🧠 Analizando texto del PDF...';
            await extractInfoFromText(pdfText);
        } else if (fileType.startsWith('image/')) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Data = reader.result.split(',')[1];
                fileStatus.textContent = '🧠 Analizando imagen...';
                await extractInfoFromImage(base64Data, fileType);
            };
            reader.onerror = () => {
                throw new Error("Error al leer el archivo de imagen.");
            };
            reader.readAsDataURL(file);
        } else {
            showError("Formato de archivo no soportado. Por favor, sube un PDF o una imagen.");
            fileStatus.textContent = "Archivo no soportado.";
        }
    } catch (error) {
        console.error('Error procesando el archivo:', error);
        showError('No se pudo procesar el archivo.');
        fileStatus.textContent = 'Error al procesar.';
    } finally {
        event.target.value = '';
    }
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
        }
    });

    saveApiBtn.addEventListener('click', saveApiKey);
    fileUploadInput.addEventListener('change', handleFileUpload);
    calcularBtn.addEventListener('click', handleCalculate);
    clearHistoryBtn.addEventListener('click', clearAllHistory);

    cantidadArticulosInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') calcularBtn.click();
    });
}

// --- Main Initialization ---
onAuthStateChanged(auth, (user) => {
    const isAuthenticated = !!user;
    
    authSection.classList.toggle('hidden', isAuthenticated);
    appContainer.classList.toggle('hidden', !isAuthenticated);

    if (user) {
        currentUser = user;
        userEmailSpan.textContent = user.email;
        checkApiKey();
        loadHistory();
    } else {
        currentUser = null;
        if (unsubscribeHistory) unsubscribeHistory();
        renderHistory([]);
    }
});

document.addEventListener('DOMContentLoaded', addEventListeners);
