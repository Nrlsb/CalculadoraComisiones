console.log("Script v2.2 Cargado - Modal personalizado");

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
// (Elementos existentes omitidos por brevedad)
const authSection = document.getElementById('auth-section');
const appContainer = document.getElementById('app-container');
const loginBtn = document.getElementById('loginBtn');
// ... todos los demás elementos ...
const historyTable = document.querySelector('#history-container table');
const emptyHistoryMsg = document.getElementById('empty-history');


// === NUEVO: Elementos del Modal ===
const confirmationModal = document.getElementById('confirmation-modal');
const modalDialog = document.getElementById('modal-dialog');
const modalMessage = document.getElementById('modal-message');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');


// --- Global State ---
let apiKey = '';
let currentUser = null;
let unsubscribeHistory = null;

// --- Funciones de Autenticación (sin cambios) ---
const handleSignup = async () => { /* ... */ };
const handleLogin = async () => { /* ... */ };
const handleLogout = async () => { /* ... */ };


// --- Lógica de la App ---

// === NUEVO: Funciones para manejar el Modal ===
function showConfirmationModal(message, onConfirm) {
    modalMessage.textContent = message;
    confirmationModal.classList.remove('hidden');
    // Pequeño delay para que la transición CSS funcione al añadir las clases
    setTimeout(() => {
        confirmationModal.classList.remove('opacity-0');
        modalDialog.classList.remove('scale-95', 'opacity-0');
    }, 10);

    // Usamos .onclick para reemplazar fácilmente el listener cada vez que se abre el modal
    modalConfirmBtn.onclick = () => {
        onConfirm();
        hideConfirmationModal();
    };

    modalCancelBtn.onclick = () => {
        hideConfirmationModal();
    };
}

function hideConfirmationModal() {
    confirmationModal.classList.add('opacity-0');
    modalDialog.classList.add('scale-95', 'opacity-0');
    // Esperamos a que termine la transición para ocultarlo completamente
    setTimeout(() => {
        confirmationModal.classList.add('hidden');
    }, 300); // La duración debe coincidir con la transición CSS
}

// --- Funciones de Historial y Datos ---

// MODIFICADO: ya no usa confirm()
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
        // (código para crear la fila de la tabla sin cambios)
        row.innerHTML = `...`; 
        historyBody.appendChild(row);
        total += item.comisionCalculada;
    });
    historyTotal.textContent = formatCurrency(total);

    // MODIFICADO: los botones de eliminar ahora usan el modal
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

// MODIFICADO: La lógica de confirmación se mueve al event listener
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

// --- El resto de las funciones (handleCalculate, IA, etc.) sin cambios ---
// ... (código existente) ...


// --- Configuración de Event Listeners ---
function addEventListeners() {
    console.log("Añadiendo event listeners...");
    loginBtn.addEventListener('click', handleLogin);
    signupBtn.addEventListener('click', handleSignup);
    logoutBtn.addEventListener('click', handleLogout);
    
    // (otros listeners existentes sin cambios)
    
    // MODIFICADO: El botón de borrar historial ahora usa el modal
    clearHistoryBtn.addEventListener('click', () => {
        showConfirmationModal(
            '¿Estás seguro de que quieres borrar TODO tu historial? Esta acción no se puede deshacer.',
            doClearAllHistory // Llama a la función que ejecuta la acción
        );
    });

    console.log("Event listeners añadidos.");
}

// --- Inicialización Principal (sin cambios) ---
onAuthStateChanged(auth, (user) => { /* ... */ });
document.addEventListener('DOMContentLoaded', addEventListeners);

// NOTA: Se han omitido por brevedad las funciones que no cambiaron. 
// Asegúrate de integrar estos cambios en tu archivo `script.js` completo.
