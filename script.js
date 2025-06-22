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

// Your web app's Firebase configuration
// IMPORTANT: Replace with your actual Firebase config object
const firebaseConfig = {
    apiKey: "AIzaSyBogsJTYqw8x8pV6DSVMTdROF-88hGZDGk",
    authDomain: "calculadora-comisiones-29213.firebaseapp.com",
    projectId: "calculadora-comisiones-29213",
    storageBucket: "calculadora-comisiones-29213.firebasestorage.app",
    messagingSenderId: "989161312785",
    appId: "1:989161312785:web:1096db83de55a53eb797b0",
    measurementId: "G-FVKKH6YB0W"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM Elements ---
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
const pdfUploadInput = document.getElementById('pdfUpload');
const pdfUploadLabel = document.getElementById('pdfUploadLabel');
const pdfStatus = document.getElementById('pdf-status');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const apiKeyInput = document.getElementById('apiKey');
const saveApiBtn = document.getElementById('saveApiBtn');
const historyBody = document.getElementById('history-body');
const historyTotal = document.getElementById('history-total');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyTable = document.querySelector('#history-container table');
const emptyHistoryMsg = document.getElementById('empty-history');

let apiKey = '';
let currentUser = null;
let unsubscribeHistory = null; // To detach the listener on logout

// --- Auth Functions ---
signupBtn.addEventListener('click', async () => {
    try {
        authError.textContent = '';
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        // User will be automatically logged in by onAuthStateChanged
    } catch (error) {
        console.error("Signup error:", error);
        authError.textContent = "Error al registrar: " + error.message;
    }
});

loginBtn.addEventListener('click', async () => {
    try {
        authError.textContent = '';
        await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
        // User will be automatically logged in by onAuthStateChanged
    } catch (error) {
        console.error("Login error:", error);
        authError.textContent = "Error al iniciar sesión: " + error.message;
    }
});

logoutBtn.addEventListener('click', async () => {
    await signOut(auth);
});

onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        authSection.classList.add('hidden');
        appContainer.classList.remove('hidden');
        userEmailSpan.textContent = user.email;
        checkApiKey();
        loadHistory(); // Load user-specific history
    } else {
        // User is signed out
        currentUser = null;
        if (unsubscribeHistory) unsubscribeHistory(); // Detach old listener
        authSection.classList.remove('hidden');
        appContainer.classList.add('hidden');
        renderHistory([]); // Clear the visible history
    }
});

// --- App Logic ---
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js`;

function formatCurrency(value) {
    return value.toLocaleString('es-AR', {
        style: 'currency',
        currency: 'ARS'
    });
}

function renderHistory(commissionHistory) {
    historyBody.innerHTML = '';
    if (commissionHistory.length === 0) {
        historyTable.classList.add('hidden');
        emptyHistoryMsg.classList.remove('hidden');
        historyTotal.textContent = formatCurrency(0);
        return;
    }
    historyTable.classList.remove('hidden');
    emptyHistoryMsg.classList.add('hidden');
    let total = 0;
    commissionHistory.forEach(item => {
        const row = document.createElement('tr');
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

    // Add event listeners to new delete buttons
    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', async (e) => {
            const docId = e.target.dataset.id;
            if (confirm('¿Estás seguro de que quieres eliminar esta comisión?')) {
                await deleteCommission(docId);
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
        mostrarError("No se pudo guardar la comisión.");
    }
}

function loadHistory() {
    if (!currentUser) return;
    if (unsubscribeHistory) unsubscribeHistory(); // Detach previous listener if exists

    const userHistoryCollection = collection(db, 'users', currentUser.uid, 'history');
    unsubscribeHistory = onSnapshot(query(userHistoryCollection), (snapshot) => {
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
        mostrarError("No se pudo eliminar la comisión.");
    }
}

clearHistoryBtn.addEventListener('click', async () => {
    if (!currentUser || !confirm('¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.')) return;

    const userHistoryCollection = collection(db, 'users', currentUser.uid, 'history');
    const snapshot = await getDocs(userHistoryCollection);
    // Firestore doesn't have a bulk delete for collections from the client-side, so we delete one by one.
    snapshot.docs.forEach(async (document) => {
        await deleteDoc(doc(db, 'users', currentUser.uid, 'history', document.id));
    });
});

async function calcularComision() {
    resultadoDiv.innerHTML = '';
    const montoVenta = parseFloat(montoVentaInput.value);
    const cantidadArticulos = parseInt(cantidadArticulosInput.value, 10);
    const numeroFactura = numeroFacturaInput.value.trim();
    const nombreCliente = clienteInput.value.trim();

    if (isNaN(montoVenta) || montoVenta <= 0) {
        mostrarError('Ingresa un monto de venta válido.');
        return;
    }
    if (isNaN(cantidadArticulos) || cantidadArticulos < 0) {
        mostrarError('Ingresa una cantidad de artículos válida.');
        return;
    }

    const comisionTotal = (montoVenta * 0.8266 * 0.007) + (cantidadArticulos * 20);

    const newCommission = {
        numeroFactura: numeroFactura,
        nombreCliente: nombreCliente,
        montoVenta: montoVenta,
        cantidadArticulos: cantidadArticulos,
        comisionCalculada: comisionTotal,
        createdAt: new Date() // Store timestamp for potential sorting
    };

    await saveCommission(newCommission);
    // The onSnapshot listener will automatically re-render the history

    mostrarResultado(comisionTotal);

    montoVentaInput.value = '';
    cantidadArticulosInput.value = '';
    numeroFacturaInput.value = '';
    clienteInput.value = '';
    numeroFacturaInput.focus();
}

function mostrarResultado(comision) {
    resultadoDiv.innerHTML = `<div class="bg-green-100 border-l-4 border-green-500 text-green-800 p-4 rounded-lg fade-in"><p class="font-semibold">Última Comisión Calculada:</p><p class="text-3xl font-bold mt-1">${formatCurrency(comision)}</p></div>`;
}

function mostrarError(mensaje) {
    resultadoDiv.innerHTML = `<div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded-lg fade-in"><p class="font-semibold">Error</p><p>${mensaje}</p></div>`;
}

function checkApiKey() {
    apiKey = localStorage.getItem('googleApiKey');
    if (apiKey) {
        pdfUploadInput.disabled = false;
        pdfUploadLabel.classList.remove('opacity-50', 'cursor-not-allowed');
        pdfUploadLabel.classList.add('hover:bg-gray-900');
        pdfStatus.textContent = 'IA lista para analizar PDFs.';
    } else {
        pdfUploadInput.disabled = true;
        pdfUploadLabel.classList.add('opacity-50', 'cursor-not-allowed');
        pdfUploadLabel.classList.remove('hover:bg-gray-900');
        pdfStatus.textContent = 'Se necesita una API Key para usar la IA. Ve a ⚙️.';
    }
}

settingsBtn.addEventListener('click', () => {
    settingsPanel.classList.toggle('hidden');
    if (!settingsPanel.classList.contains('hidden')) apiKeyInput.value = localStorage.getItem('googleApiKey') || '';
});

saveApiBtn.addEventListener('click', () => {
    const newApiKey = apiKeyInput.value.trim();
    if (newApiKey) {
        localStorage.setItem('googleApiKey', newApiKey);
        pdfStatus.textContent = '✅ Clave guardada. ¡IA activada!';
    } else {
        localStorage.removeItem('googleApiKey');
        pdfStatus.textContent = 'Clave eliminada. La IA está desactivada.';
    }
    checkApiKey();
    settingsPanel.classList.add('hidden');
});

pdfUploadInput.addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') return;
    pdfStatus.textContent = '📖 Leyendo PDF...';
    resultadoDiv.innerHTML = '';
    try {
        const pdfText = await extractTextFromPdf(file);
        pdfStatus.textContent = '🧠 Analizando información...';
        await extractInfoWithAI(pdfText);
    } catch (error) {
        console.error('Error procesando el PDF:', error);
        mostrarError('No se pudo leer el archivo PDF.');
        pdfStatus.textContent = 'Error al leer el PDF.';
    }
});

async function extractTextFromPdf(file) {
    const fileReader = new FileReader();
    return new Promise((resolve, reject) => {
        fileReader.onload = async function() {
            const typedarray = new Uint8Array(this.result);
            try {
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                if (pdf.numPages === 0) {
                    reject(new Error("El PDF no tiene páginas."));
                    return;
                }
                const page = await pdf.getPage(1);
                const textContent = await page.getTextContent();
                resolve(textContent.items.map(item => item.str).join(' '));
            } catch (error) {
                reject(error);
            }
        };
        fileReader.readAsArrayBuffer(file);
    });
}

async function extractInfoWithAI(text) {
    if (!apiKey) {
        mostrarError("No hay una API Key configurada para la IA.");
        return;
    }

    const prompt = `
        Analiza el siguiente texto de una factura para extraer 2 campos específicos. Sigue estas reglas al pie de la letra:

        1.  **cantidadArticulos**: Busca la tabla de productos que contiene una columna llamada "Cantidad". Debes sumar todos los números que aparezcan en esa columna. Por ejemplo, si bajo "Cantidad" hay un "1" y en otra fila otro "1", el total es 2.

        2.  **montoVenta**: Al final del documento, en la sección de totales, busca la palabra "TOTAL" en mayúsculas. El valor que necesitas es el importe numérico que está en la misma línea que esa palabra. Ejemplo: "TOTAL 13227,71". El monto es 13227.71. Asegúrate de tratar la coma como separador decimal.

        Devuelve un objeto JSON con las claves "cantidadArticulos" y "montoVenta". Si algún dato no se encuentra, su valor debe ser null.

        Texto de la factura para analizar:
        ---
        ${text.substring(0, 8000)}
        ---
    `;

    const payload = {
        contents: [{
            role: "user",
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    montoVenta: {
                        type: "NUMBER"
                    },
                    cantidadArticulos: {
                        type: "NUMBER"
                    }
                }
            }
        },
    };
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`Error en la API: ${response.status} ${response.statusText}`);
        const result = await response.json();
        if (result.candidates && result.candidates[0].content && result.candidates[0].content.parts[0]) {
            const jsonResponse = JSON.parse(result.candidates[0].content.parts[0].text);
            if (jsonResponse.montoVenta != null) montoVentaInput.value = jsonResponse.montoVenta;
            if (jsonResponse.cantidadArticulos != null) cantidadArticulosInput.value = jsonResponse.cantidadArticulos;
            pdfStatus.textContent = '✅ ¡Información extraída con éxito!';
        } else {
            throw new Error("La respuesta de la IA no tuvo el formato esperado.");
        }
    } catch (error) {
        console.error("Error llamando a la IA:", error);
        mostrarError("La IA no pudo extraer los datos. Revisa tu API Key y el formato del PDF.");
        pdfStatus.textContent = "Error en el análisis.";
    }
}

// --- Initial Event Listeners ---
calcularBtn.addEventListener('click', calcularComision);
cantidadArticulosInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') calcularBtn.click();
});
