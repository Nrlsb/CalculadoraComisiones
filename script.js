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

// Elementos del Modal de Confirmación
const confirmationModal = document.getElementById('confirmation-modal');
const modalDialog = document.getElementById('modal-dialog');
const modalMessage = document.getElementById('modal-message');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// --- Global State ---
let apiKey = '';
let currentUser = null;
let unsubscribeHistory = null;
// NUEVO: Variable para rastrear el tipo de documento detectado por la IA
let lastDetectedDocType = 'INVOICE'; 

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

// --- History & Data Functions ---
// MODIFICADO: renderHistory ahora diferencia visualmente las Notas de Crédito
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
        // NUEVO: Lógica para identificar y estilizar Notas de Crédito
        const isCreditNote = item.documentType === 'CREDIT_NOTE';
        const row = document.createElement('tr');
        row.classList.add('fade-in');
        if (isCreditNote) {
            row.classList.add('bg-red-50'); // Fondo rojo claro para la fila
        }
        
        const commissionClass = isCreditNote ? 'text-red-700 font-bold' : 'text-gray-900 font-medium';
        const documentTag = isCreditNote ? '<span class="ml-2 text-xs font-semibold bg-red-200 text-red-800 px-2 py-0.5 rounded-full">NC</span>' : '';

        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.numeroFactura || '-'}${documentTag}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.nombreCliente || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${formatCurrency(item.montoVenta)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">${item.cantidadArticulos}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm ${commissionClass}">${formatCurrency(item.comisionCalculada)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                <button data-id="${item.id}" class="text-red-600 hover:text-red-900 delete-btn">Eliminar</button>
            </td>
        `;
        historyBody.appendChild(row);
        total += item.comisionCalculada; // La comisión ya es negativa para NC, así que se resta sola
    });
    historyTotal.textContent = formatCurrency(total);

    document.querySelectorAll('.delete-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const docId = e.target.dataset.id;
            showConfirmationModal(
                '¿Estás seguro de que quieres eliminar este registro?',
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
        showError("No se pudo guardar el registro.");
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
        // MODIFICADO: Ordenar para mostrar los más recientes primero
        commissionHistory.sort((a, b) => b.createdAt.toDate() - a.createdAt.toDate());
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
        showError("No se pudo eliminar el registro.");
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

// MODIFICADO: handleCalculate ahora considera el tipo de documento
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

    // NUEVO: Detectar si es una Nota de Crédito para aplicar valores negativos
    const isCreditNote = lastDetectedDocType === 'CREDIT_NOTE';
    const montoCalculo = isCreditNote ? -Math.abs(montoVenta) : montoVenta;
    const articulosCalculo = isCreditNote ? -Math.abs(cantidadArticulos) : cantidadArticulos;
    
    const comisionPorArticulo = 12;
    const comisionTotal = (montoCalculo * 0.8266 * 0.007) + (articulosCalculo * comisionPorArticulo);

    const newCommission = {
        numeroFactura,
        nombreCliente,
        montoVenta: montoVenta, // Guardamos el valor original (positivo)
        cantidadArticulos: cantidadArticulos, // Guardamos el valor original (positivo)
        comisionCalculada: comisionTotal, // Guardamos la comisión calculada (será negativa para NC)
        documentType: lastDetectedDocType, // NUEVO: Guardamos el tipo de documento
        createdAt: new Date()
    };

    await saveCommission(newCommission);
    showResult(comisionTotal, isCreditNote);

    montoVentaInput.value = '';
    cantidadArticulosInput.value = '';
    numeroFacturaInput.value = '';
    clienteInput.value = '';
    lastDetectedDocType = 'INVOICE'; // Resetear el tipo de documento
    numeroFacturaInput.focus();
}

// MODIFICADO: showResult ahora muestra un estilo diferente para Notas de Crédito
function showResult(comision, isCreditNote = false) {
    const bgColor = isCreditNote ? 'bg-blue-100 border-l-4 border-blue-500 text-blue-800' : 'bg-green-100 border-l-4 border-green-500 text-green-800';
    const title = isCreditNote ? 'Comisión Restada (Nota de Crédito):' : 'Última Comisión Calculada:';
    resultadoDiv.innerHTML = `<div class="${bgColor} p-4 rounded-lg fade-in"><p class="font-semibold">${title}</p><p class="text-3xl font-bold mt-1">${formatCurrency(comision)}</p></div>`;
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

// MODIFICADO: processAIResponse ahora guarda el tipo de documento y actualiza el estado
function processAIResponse(jsonResponse) {
    if (jsonResponse.montoVenta != null) montoVentaInput.value = jsonResponse.montoVenta;
    if (jsonResponse.cantidadArticulos != null) cantidadArticulosInput.value = jsonResponse.cantidadArticulos;
    
    lastDetectedDocType = jsonResponse.documentType || 'INVOICE';
    const docTypeLabel = lastDetectedDocType === 'CREDIT_NOTE' ? 'Nota de Crédito' : 'Factura';
    
    fileStatus.textContent = `✅ ¡Información extraída! Tipo: ${docTypeLabel}.`;
}

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

// MODIFICADO: El prompt de texto ahora también busca el tipo de documento.
async function extractInfoFromText(text) {
    const prompt = `Analiza el siguiente texto y extrae 'documentType', 'cantidadArticulos' y 'montoVenta'.
    - 'documentType': Debe ser 'CREDIT_NOTE' si encuentras las palabras "NOTA DE CREDITO". De lo contrario, debe ser 'INVOICE'.
    - 'cantidadArticulos': Es la suma de la columna 'Cantidad'.
    - 'montoVenta': Es el valor numérico junto a la palabra 'TOTAL' o 'Cta. Cte.'.
    Devuelve un objeto JSON. Trata la coma como separador decimal.
    Texto a analizar: --- ${text.substring(0, 8000)} ---`;
    
    const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            responseMimeType: "application/json",
            // MODIFICADO: El schema ahora incluye documentType
            responseSchema: {
                type: "OBJECT",
                properties: {
                    documentType: { type: "STRING", enum: ["INVOICE", "CREDIT_NOTE"] },
                    montoVenta: { type: "NUMBER" },
                    cantidadArticulos: { type: "NUMBER" }
                },
                required: ["documentType"]
            }
        },
    };
    await callGenerativeAI(payload);
}

// MODIFICADO: El prompt de imagen ahora está entrenado para Notas de Crédito.
async function extractInfoFromImage(base64Data, mimeType) {
    const prompt = `
    Analiza la imagen del documento y extrae 'documentType', 'cantidadArticulos' y 'montoVenta' en formato JSON.

    PASO 1: IDENTIFICAR TIPO DE DOCUMENTO
    - Busca prominentemente el texto "NOTA DE CREDITO". Si lo encuentras, el 'documentType' es "CREDIT_NOTE".
    - Si no, asume que el 'documentType' es "INVOICE" (Factura).

    PASO 2: EXTRAER DATOS (Las reglas son similares para ambos tipos de documento)
    - 'cantidadArticulos': Busca una columna con encabezados como "Cantidad", "Cant.", "Unidades", o una columna de números entre la descripción y el precio. Suma los valores de esa columna.
    - 'montoVenta': Busca una palabra clave como "TOTAL", "Total:", o "Cta. Cte." y extrae el valor numérico final asociado a ella.

    REGLAS GENERALES:
    - Siempre trata la coma (,) como separador decimal y el punto (.) como separador de miles.
    - Si no encuentras un valor numérico, devuélvelo como 'null'.
    - Devuelve únicamente el objeto JSON como respuesta.
    `;
    
    const payload = {
        contents: [{
            parts: [
                { text: prompt },
                { inlineData: { mimeType: mimeType, data: base64Data } }
            ]
        }],
        generationConfig: {
            responseMimeType: "application/json",
            // MODIFICADO: El schema ahora incluye documentType
            responseSchema: {
                type: "OBJECT",
                properties: {
                    documentType: { type: "STRING", enum: ["INVOICE", "CREDIT_NOTE"] },
                    montoVenta: { type: "NUMBER" },
                    cantidadArticulos: { type: "NUMBER" }
                },
                 required: ["documentType"]
            }
        },
    };
    await callGenerativeAI(payload);
}

const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    lastDetectedDocType = 'INVOICE'; // Resetear al subir un nuevo archivo
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
    
    clearHistoryBtn.addEventListener('click', () => {
        showConfirmationModal(
            '¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.',
            doClearAllHistory 
        );
    });

    modalCancelBtn.addEventListener('click', hideConfirmationModal);

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
